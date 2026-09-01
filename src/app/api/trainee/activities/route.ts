export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee } from "@/lib/auth/serverAuth";
import type { FieldworkActivityType } from "@/types";

const TYPES = new Set<FieldworkActivityType>([
  "direct",
  "indirect",
  "supervision_direct",
  "supervision_indirect",
]);
const CATEGORIES = new Set([
  "service_delivery",
  "data_collection",
  "data_analysis",
  "assessment",
  "program_development",
  "reporting_graphing",
  "stakeholder_training",
  "fidelity_monitoring",
  "person_centered_meeting",
  "research_programming",
  "other_aba",
]);
const clean = (value: unknown, max = 2000) =>
  String(value || "")
    .trim()
    .slice(0, max);

function durationBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return Math.round(((eh * 60 + em - (sh * 60 + sm)) / 60) * 100) / 100;
}

export async function GET() {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!trainee.currentSupervisorId || trainee.status !== "active")
    return NextResponse.json({ error: "ASSIGNMENT_REQUIRED" }, { status: 403 });
  const snap = await adminDb
    .collection("fieldworkActivities")
    .where("traineeId", "==", trainee.id)
    .get();
  const activities = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee || !trainee.currentSupervisorId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const {
    date,
    startTime,
    endTime,
    activityType,
    setting,
    format,
    observedWithClient,
    description,
    saveAsDraft,
    activityCategory,
    centerName,
    clientCode,
    planGoalId,
    evidenceNote,
  } = body;
  if (
    !date ||
    !startTime ||
    !endTime ||
    !TYPES.has(activityType) ||
    typeof description !== "string"
  ) {
    return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  }
  const duration = durationBetween(startTime, endTime);
  if (duration <= 0 || duration > 16)
    return NextResponse.json({ error: "INVALID_DURATION" }, { status: 400 });
  const isSupervision = activityType.startsWith("supervision_");
  if (!isSupervision && !CATEGORIES.has(activityCategory))
    return NextResponse.json(
      { error: "ACTIVITY_CATEGORY_REQUIRED" },
      { status: 400 },
    );
  if (
    isSupervision &&
    (!["in_person", "video"].includes(setting) ||
      !["individual", "group"].includes(format))
  ) {
    return NextResponse.json(
      { error: "SUPERVISION_DETAILS_REQUIRED" },
      { status: 400 },
    );
  }
  const approvalSnap = await adminDb
    .collection("monthlyApprovals")
    .doc(`${trainee.id}_${date.slice(0, 7)}`)
    .get();
  if (approvalSnap.exists && approvalSnap.data()?.locked)
    return NextResponse.json({ error: "MONTH_LOCKED" }, { status: 409 });
  const fieldworkStart = clean((trainee as any).fieldworkStartDate, 10);
  const courseworkStart = clean((trainee as any).courseworkStartDate, 10);
  if (!fieldworkStart || !courseworkStart)
    return NextResponse.json({ error: "ELIGIBILITY_DATES_REQUIRED" }, { status: 409 });
  if (
    (fieldworkStart && date < fieldworkStart) ||
    (courseworkStart && date < courseworkStart)
  )
    return NextResponse.json(
      { error: "BEFORE_ELIGIBLE_START" },
      { status: 400 },
    );
  const sameDay = await adminDb
    .collection("fieldworkActivities")
    .where("traineeId", "==", trainee.id)
    .where("date", "==", date)
    .limit(100)
    .get();
  const overlaps = sameDay.docs.some((d) => {
    const x = d.data();
    return (
      x.status !== "rejected" && startTime < x.endTime && endTime > x.startTime
    );
  });
  if (overlaps)
    return NextResponse.json({ error: "TIME_OVERLAP" }, { status: 409 });
  const now = new Date().toISOString();
  const ref = adminDb.collection("fieldworkActivities").doc();
  await ref.set({
    traineeId: trainee.id,
    supervisorId: trainee.currentSupervisorId,
    date,
    month: date.slice(0, 7),
    startTime,
    endTime,
    duration,
    activityType,
    setting: isSupervision ? setting : null,
    format: isSupervision ? format : null,
    observedWithClient: isSupervision ? Boolean(observedWithClient) : false,
    description: description.trim().slice(0, 2000),
    activityCategory: isSupervision ? null : activityCategory,
    centerName: clean(centerName, 200),
    clientCode: clean(clientCode, 80),
    planGoalId: clean(planGoalId, 100),
    evidenceNote: clean(evidenceNote, 1000),
    status: saveAsDraft ? "draft" : "submitted",
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ success: true, id: ref.id });
}

export async function PATCH(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, action } = body;
  if (!id || !["submit", "update"].includes(action))
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  const ref = adminDb.collection("fieldworkActivities").doc(id);
  const snap = await ref.get();
  if (
    !snap.exists ||
    snap.data()?.traineeId !== trainee.id ||
    !["draft", "revision_requested"].includes(snap.data()?.status)
  ) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const locked = await adminDb
    .collection("monthlyApprovals")
    .doc(`${trainee.id}_${snap.data()?.month}`)
    .get();
  if (locked.exists && locked.data()?.locked)
    return NextResponse.json({ error: "MONTH_LOCKED" }, { status: 409 });
  if (action === "update") {
    const date = clean(body.date, 10);
    const startTime = clean(body.startTime, 5);
    const endTime = clean(body.endTime, 5);
    const duration = durationBetween(
      startTime,
      endTime,
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || duration <= 0 || duration > 16 || !TYPES.has(body.activityType))
      return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    const isSupervision = String(body.activityType).startsWith("supervision_");
    if (!isSupervision && !CATEGORIES.has(body.activityCategory))
      return NextResponse.json({ error: "ACTIVITY_CATEGORY_REQUIRED" }, { status: 400 });
    if (isSupervision && (!['in_person', 'video'].includes(body.setting) || !['individual', 'group'].includes(body.format)))
      return NextResponse.json({ error: "SUPERVISION_DETAILS_REQUIRED" }, { status: 400 });
    const targetMonthApproval = await adminDb.collection("monthlyApprovals")
      .doc(`${trainee.id}_${date.slice(0, 7)}`).get();
    if (targetMonthApproval.exists && targetMonthApproval.data()?.locked)
      return NextResponse.json({ error: "MONTH_LOCKED" }, { status: 409 });
    const fieldworkStart = clean((trainee as any).fieldworkStartDate, 10);
    const courseworkStart = clean((trainee as any).courseworkStartDate, 10);
    if (!fieldworkStart || !courseworkStart)
      return NextResponse.json({ error: "ELIGIBILITY_DATES_REQUIRED" }, { status: 409 });
    if (date < fieldworkStart || date < courseworkStart)
      return NextResponse.json({ error: "BEFORE_ELIGIBLE_START" }, { status: 400 });
    const sameDay = await adminDb.collection("fieldworkActivities")
      .where("traineeId", "==", trainee.id).where("date", "==", date).limit(100).get();
    const overlaps = sameDay.docs.some((doc) => {
      if (doc.id === id || doc.data().status === "rejected") return false;
      const row = doc.data();
      return startTime < row.endTime && endTime > row.startTime;
    });
    if (overlaps) return NextResponse.json({ error: "TIME_OVERLAP" }, { status: 409 });
    await ref.update({
      date,
      month: date.slice(0, 7),
      startTime,
      endTime,
      duration,
      activityType: body.activityType,
      activityCategory: !isSupervision && CATEGORIES.has(body.activityCategory)
        ? body.activityCategory
        : null,
      setting: isSupervision ? body.setting : null,
      format: isSupervision ? body.format : null,
      observedWithClient: isSupervision ? Boolean(body.observedWithClient) : false,
      centerName: clean(body.centerName, 200),
      clientCode: clean(body.clientCode, 80),
      planGoalId: clean(body.planGoalId, 100),
      evidenceNote: clean(body.evidenceNote, 1000),
      description: clean(body.description),
      status: "submitted",
      reviewerNote: null,
      updatedAt: new Date().toISOString(),
    });
  } else
    await ref.update({
      status: "submitted",
      reviewerNote: null,
      updatedAt: new Date().toISOString(),
    });
  return NextResponse.json({ success: true });
}
