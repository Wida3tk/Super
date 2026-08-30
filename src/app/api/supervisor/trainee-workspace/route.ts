export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";

const COLLECTIONS = {
  document: "supervisionDocuments",
  meeting: "meetingMinutes",
  assessment: "competencyAssessments",
} as const;

async function ownsTrainee(supervisorId: string, traineeId: string) {
  const snap = await adminDb.collection("trainees").doc(traineeId).get();
  return snap.exists && snap.data()?.currentSupervisorId === supervisorId;
}

const clean = (value: unknown, max = 4000) =>
  String(value || "")
    .trim()
    .slice(0, max);
const PAPER_APPROVALS = new Set([
  "guardian_consent",
  "center_approval",
  "observation_consent",
  "video_consent",
  "data_consent",
]);

export async function GET(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const traineeId = req.nextUrl.searchParams.get("traineeId");
  if (!traineeId || !(await ownsTrainee(supervisor.id, traineeId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const [
    documents,
    meetings,
    assessments,
    plan,
    activities,
    agreement,
    assignments,
  ] = await Promise.all([
    adminDb
      .collection("supervisionDocuments")
      .where("traineeId", "==", traineeId)
      .limit(100)
      .get(),
    adminDb
      .collection("meetingMinutes")
      .where("traineeId", "==", traineeId)
      .limit(100)
      .get(),
    adminDb
      .collection("competencyAssessments")
      .where("traineeId", "==", traineeId)
      .limit(50)
      .get(),
    adminDb.collection("supervisionPlans").doc(traineeId).get(),
    adminDb
      .collection("fieldworkActivities")
      .where("traineeId", "==", traineeId)
      .limit(1000)
      .get(),
    adminDb.collection("supervisionAgreements").doc(traineeId).get(),
    adminDb
      .collection("assignments")
      .where("traineeId", "==", traineeId)
      .limit(50)
      .get(),
  ]);
  const map = (snap: FirebaseFirestore.QuerySnapshot) =>
    snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const assignmentRows = map(assignments) as any[];
  const supervisorIds = [
    ...new Set(assignmentRows.map((item) => item.supervisorId).filter(Boolean)),
  ];
  const supervisorDocs = supervisorIds.length
    ? await adminDb.getAll(
        ...supervisorIds.map((id) =>
          adminDb.collection("supervisors").doc(String(id)),
        ),
      )
    : [];
  const supervisorNames = new Map(
    supervisorDocs.map((doc) => [doc.id, String(doc.data()?.name || doc.id)]),
  );
  return NextResponse.json({
    documents: map(documents).sort((a: any, b: any) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    ),
    meetings: map(meetings).sort((a: any, b: any) =>
      String(b.date).localeCompare(String(a.date)),
    ),
    assessments: map(assessments).sort((a: any, b: any) =>
      String(b.date).localeCompare(String(a.date)),
    ),
    plan: plan.exists
      ? { id: plan.id, ...plan.data() }
      : { traineeId, goals: [] },
    activities: map(activities),
    agreement: agreement.exists
      ? { id: agreement.id, ...agreement.data() }
      : null,
    assignments: assignmentRows
      .map((item) => ({
        ...item,
        supervisorName:
          supervisorNames.get(item.supervisorId) || item.supervisorId,
      }))
      .sort((a: any, b: any) =>
        String(b.startDate).localeCompare(String(a.startDate)),
      ),
  });
}

export async function POST(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const traineeId = clean(body.traineeId, 100);
  if (!traineeId || !(await ownsTrainee(supervisor.id, traineeId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const now = new Date().toISOString();

  if (body.entity === "document") {
    if (
      !clean(body.type, 50) ||
      !clean(body.title, 200) ||
      !clean(body.issuedAt, 10)
    )
      return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    const ref = adminDb.collection(COLLECTIONS.document).doc();
    const type = clean(body.type, 50);
    await ref.set({
      traineeId,
      supervisorId: supervisor.id,
      type,
      title: clean(body.title, 200),
      centerName: clean(body.centerName, 200),
      clientCode: clean(body.clientCode, 80),
      issuedAt: clean(body.issuedAt, 10),
      expiresAt: PAPER_APPROVALS.has(type)
        ? null
        : clean(body.expiresAt, 10) || null,
      status: "uploaded",
      fileName: clean(body.fileName, 250),
      fileUrl: clean(body.fileUrl, 2000),
      notes: clean(body.notes),
      createdAt: now,
      createdBy: supervisor.id,
    });
    return NextResponse.json({ success: true, id: ref.id });
  }

  if (body.entity === "meeting") {
    if (
      !clean(body.date, 10) ||
      !clean(body.startTime, 5) ||
      !clean(body.endTime, 5) ||
      !clean(body.agenda)
    )
      return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    const ref = adminDb.collection(COLLECTIONS.meeting).doc();
    const actionItems = clean(body.actionItems, 10000);
    const tasks = actionItems
      ? actionItems
          .split("\n")
          .map((title: string, index: number) => ({
            id: `task-${Date.now()}-${index}`,
            title: title.trim(),
            owner: "trainee",
            dueDate: clean(body.taskDueDate, 10) || null,
            status: "open",
          }))
          .filter((t: any) => t.title)
          .slice(0, 30)
      : [];
    await ref.set({
      traineeId,
      supervisorId: supervisor.id,
      date: clean(body.date, 10),
      startTime: clean(body.startTime, 5),
      endTime: clean(body.endTime, 5),
      format: body.format === "group" ? "group" : "individual",
      setting: body.setting === "in_person" ? "in_person" : "video",
      observedWithClient: Boolean(body.observedWithClient),
      agenda: clean(body.agenda),
      discussion: clean(body.discussion, 10000),
      decisions: clean(body.decisions, 10000),
      actionItems,
      tasks,
      competencyIds: Array.isArray(body.competencyIds)
        ? body.competencyIds.slice(0, 50).map((x: unknown) => clean(x, 100))
        : [],
      planGoalIds: Array.isArray(body.planGoalIds)
        ? body.planGoalIds.slice(0, 50).map((x: unknown) => clean(x, 100))
        : [],
      acknowledgedByTrainee: false,
      createdAt: now,
      updatedAt: now,
      createdBy: supervisor.id,
    });
    return NextResponse.json({ success: true, id: ref.id });
  }

  if (body.entity === "assessment") {
    const scores = Array.isArray(body.scores)
      ? body.scores
          .filter(
            (s: any) =>
              clean(s.competencyId, 100) &&
              Number(s.score) >= 1 &&
              Number(s.score) <= 5,
          )
          .map((s: any) => ({
            competencyId: clean(s.competencyId, 100),
            score: Number(s.score),
            observationMethod: [
              "live",
              "role_play",
              "discussion",
              "work_product",
            ].includes(s.observationMethod)
              ? s.observationMethod
              : "discussion",
            note: clean(s.note, 1000),
          }))
      : [];
    if (!clean(body.date, 10) || !scores.length)
      return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    const ref = adminDb.collection(COLLECTIONS.assessment).doc();
    const assessmentDate = new Date(`${clean(body.date, 10)}T00:00:00Z`);
    assessmentDate.setUTCMonth(assessmentDate.getUTCMonth() + 3);
    await ref.set({
      traineeId,
      supervisorId: supervisor.id,
      date: clean(body.date, 10),
      nextDueDate: assessmentDate.toISOString().slice(0, 10),
      period: body.period === "initial" ? "initial" : "quarterly",
      scores,
      strengths: clean(body.strengths),
      developmentPriorities: clean(body.developmentPriorities),
      recommendation: clean(body.recommendation),
      suggestedCompetencyIds: scores
        .filter((s: any) => s.score < 3)
        .map((s: any) => s.competencyId),
      totalScore: scores.reduce((n: number, s: any) => n + s.score, 0),
      maxScore: scores.length * 5,
      createdAt: now,
      createdBy: supervisor.id,
    });
    return NextResponse.json({ success: true, id: ref.id });
  }
  return NextResponse.json({ error: "INVALID_ENTITY" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const traineeId = clean(body.traineeId, 100);
  if (!traineeId || !(await ownsTrainee(supervisor.id, traineeId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (body.entity === "agreement") {
    const durationMonths = Number(body.durationMonths);
    const plannedSupervisionHours = Number(body.plannedSupervisionHours);
    const carriedSupervisionHours = Number(body.carriedSupervisionHours || 0);
    if (
      !clean(body.signedAt, 10) ||
      !clean(body.effectiveFrom, 10) ||
      !Number.isFinite(durationMonths) ||
      durationMonths < 1 ||
      durationMonths > 60 ||
      !Number.isFinite(plannedSupervisionHours) ||
      plannedSupervisionHours < 1 ||
      plannedSupervisionHours > 500 ||
      !Number.isFinite(carriedSupervisionHours) ||
      carriedSupervisionHours < 0
    )
      return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    const status = [
      "draft",
      "active",
      "paused",
      "completed",
      "terminated",
    ].includes(body.status)
      ? body.status
      : "draft";
    const ref = adminDb.collection("supervisionAgreements").doc(traineeId);
    const existing = await ref.get();
    await ref.set(
      {
        traineeId,
        currentSupervisorId: supervisor.id,
        signedAt: clean(body.signedAt, 10),
        effectiveFrom: clean(body.effectiveFrom, 10),
        durationMonths,
        plannedSupervisionHours,
        carriedSupervisionHours,
        financialTermMonths: Math.min(
          60,
          Math.max(1, Number(body.financialTermMonths) || durationMonths),
        ),
        noticeDays: Math.min(90, Math.max(0, Number(body.noticeDays) || 30)),
        status,
        notes: clean(body.notes, 4000),
        updatedAt: new Date().toISOString(),
        updatedBy: supervisor.id,
        createdAt: existing.data()?.createdAt || new Date().toISOString(),
      },
      { merge: true },
    );
    return NextResponse.json({ success: true });
  }
  if (body.entity !== "plan")
    return NextResponse.json({ error: "INVALID_ENTITY" }, { status: 400 });
  const goals = Array.isArray(body.goals)
    ? body.goals.slice(0, 100).map((g: any, index: number) => ({
        id: clean(g.id, 100) || `goal-${Date.now()}-${index}`,
        domain: clean(g.domain, 150),
        title: clean(g.title, 1000),
        startDate: clean(g.startDate, 10) || null,
        dueDate: clean(g.dueDate, 10) || null,
        masteryCriterion: clean(g.masteryCriterion, 1000),
        status: ["not_started", "in_progress", "achieved", "retrain"].includes(
          g.status,
        )
          ? g.status
          : "not_started",
        supervisorNote: clean(g.supervisorNote, 2000),
        order: index,
      }))
    : [];
  const currentPlan = await adminDb
    .collection("supervisionPlans")
    .doc(traineeId)
    .get();
  if (currentPlan.exists)
    await adminDb.collection("supervisionPlanVersions").add({
      ...currentPlan.data(),
      traineeId,
      archivedAt: new Date().toISOString(),
      archivedBy: supervisor.id,
    });
  await adminDb.collection("supervisionPlans").doc(traineeId).set(
    {
      traineeId,
      supervisorId: supervisor.id,
      goals,
      versionUpdatedAt: new Date().toISOString(),
      updatedBy: supervisor.id,
    },
    { merge: true },
  );
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const traineeId = clean(body.traineeId, 100);
  if (!traineeId || !(await ownsTrainee(supervisor.id, traineeId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (body.entity === "document") {
    const ref = adminDb
      .collection("supervisionDocuments")
      .doc(clean(body.id, 100));
    const snap = await ref.get();
    if (
      !snap.exists ||
      snap.data()?.traineeId !== traineeId ||
      snap.data()?.supervisorId !== supervisor.id
    )
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const status = ["uploaded", "reviewed", "replace_required"].includes(
      body.status,
    )
      ? body.status
      : null;
    if (!status)
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    await ref.update({
      status,
      reviewNote: clean(body.note, 1000),
      reviewedAt: status === "reviewed" ? new Date().toISOString() : null,
      reviewedBy: supervisor.id,
    });
    return NextResponse.json({ success: true });
  }
  if (body.entity === "meeting_task") {
    const ref = adminDb.collection("meetingMinutes").doc(clean(body.id, 100));
    const snap = await ref.get();
    if (
      !snap.exists ||
      snap.data()?.traineeId !== traineeId ||
      snap.data()?.supervisorId !== supervisor.id
    )
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const tasks = Array.isArray(snap.data()?.tasks) ? snap.data()!.tasks : [];
    const updated = tasks.map((t: any) =>
      t.id === body.taskId
        ? {
            ...t,
            status: body.status === "completed" ? "completed" : "open",
            completedAt:
              body.status === "completed" ? new Date().toISOString() : null,
          }
        : t,
    );
    await ref.update({ tasks: updated, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "INVALID_ENTITY" }, { status: 400 });
}
