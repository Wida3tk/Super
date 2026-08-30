import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

const clean = (value: unknown, max = 4000) =>
  String(value || "")
    .trim()
    .slice(0, max);

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const traineeId = clean(request.nextUrl.searchParams.get("traineeId"), 100);
  if (!traineeId)
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const [agreement, assignments] = await Promise.all([
    adminDb.collection("supervisionAgreements").doc(traineeId).get(),
    adminDb
      .collection("assignments")
      .where("traineeId", "==", traineeId)
      .limit(50)
      .get(),
  ]);
  const rows = assignments.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];
  const ids = [...new Set(rows.map((row) => row.supervisorId).filter(Boolean))];
  const supervisorDocs = ids.length
    ? await adminDb.getAll(
        ...ids.map((id) => adminDb.collection("supervisors").doc(String(id))),
      )
    : [];
  const names = new Map(
    supervisorDocs.map((doc) => [doc.id, doc.data()?.name || doc.id]),
  );
  return NextResponse.json({
    agreement: agreement.exists
      ? { id: agreement.id, ...agreement.data() }
      : null,
    assignments: rows
      .map((row) => ({
        ...row,
        supervisorName: names.get(row.supervisorId) || row.supervisorId,
      }))
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))),
  });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json();
  const traineeId = clean(body.traineeId, 100);
  const durationMonths = Number(body.durationMonths);
  const plannedSupervisionHours = Number(body.plannedSupervisionHours);
  const carriedSupervisionHours = Number(body.carriedSupervisionHours || 0);
  if (
    !traineeId ||
    !clean(body.signedAt, 10) ||
    !clean(body.effectiveFrom, 10) ||
    !Number.isFinite(durationMonths) ||
    durationMonths < 1 ||
    durationMonths > 60 ||
    !Number.isFinite(plannedSupervisionHours) ||
    plannedSupervisionHours < 1 ||
    !Number.isFinite(carriedSupervisionHours) ||
    carriedSupervisionHours < 0
  )
    return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const trainee = await adminDb.collection("trainees").doc(traineeId).get();
  if (!trainee.exists)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ref = adminDb.collection("supervisionAgreements").doc(traineeId);
  const existing = await ref.get();
  const now = new Date().toISOString();
  const status = [
    "draft",
    "active",
    "paused",
    "completed",
    "terminated",
  ].includes(body.status)
    ? body.status
    : "draft";
  await ref.set(
    {
      traineeId,
      currentSupervisorId: trainee.data()?.currentSupervisorId || "",
      signedAt: clean(body.signedAt, 10),
      effectiveFrom: clean(body.effectiveFrom, 10),
      durationMonths,
      financialTermMonths: Math.min(
        60,
        Math.max(1, Number(body.financialTermMonths) || durationMonths),
      ),
      plannedSupervisionHours,
      carriedSupervisionHours,
      noticeDays: Math.min(90, Math.max(0, Number(body.noticeDays) || 30)),
      status,
      notes: clean(body.notes),
      createdAt: existing.data()?.createdAt || now,
      updatedAt: now,
      updatedBy: admin.uid,
    },
    { merge: true },
  );
  await adminDb.collection("activityLogs").add({
    type: "agreement_updated",
    traineeId,
    actorId: admin.uid,
    message: "تم تحديث بطاقة اتفاقية الإشراف من الإدارة",
    createdAt: now,
  });
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json();
  const traineeId = clean(body.traineeId, 100);
  const reason = clean(body.reason, 3000);
  const endDate = clean(body.endDate, 10);
  if (
    body.action !== "terminate" ||
    !traineeId ||
    reason.length < 10 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  )
    return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const traineeRef = adminDb.collection("trainees").doc(traineeId);
  const trainee = await traineeRef.get();
  if (!trainee.exists)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const assignments = await adminDb
    .collection("assignments")
    .where("traineeId", "==", traineeId)
    .get();
  const now = new Date().toISOString();
  const batch = adminDb.batch();
  batch.update(traineeRef, {
    status: "withdrawn",
    terminatedAt: now,
    terminationReason: reason,
    updatedAt: now,
  });
  batch.set(
    adminDb.collection("supervisionAgreements").doc(traineeId),
    {
      status: "terminated",
      terminatedAt: now,
      terminationReason: reason,
      updatedAt: now,
      updatedBy: admin.uid,
    },
    { merge: true },
  );
  assignments.docs
    .filter((doc) => !doc.data().endDate)
    .forEach((doc) =>
      batch.update(doc.ref, {
        endDate,
        notes: "إنهاء إداري للعلاقة الإشرافية",
      }),
    );
  batch.set(adminDb.collection("traineeStatusHistory").doc(), {
    traineeId,
    action: "terminated",
    reason,
    endDate,
    actorId: admin.uid,
    createdAt: now,
  });
  await batch.commit();
  return NextResponse.json({ success: true });
}
