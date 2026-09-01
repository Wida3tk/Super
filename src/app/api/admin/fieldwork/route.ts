export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { buildCompliance } from "@/lib/qaba/compliance";
import { syncTraineeFieldworkTotals } from "@/lib/fieldwork/syncTotals";
import type { FieldworkActivity } from "@/types";
import { logActivity } from "@/lib/activityLog";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json();
  const activityId = String(body.activityId || "");
  const status = String(body.status || "");
  if (!activityId || !["approved", "revision_requested", "rejected"].includes(status))
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const reference = adminDb.collection("fieldworkActivities").doc(activityId);
  const activity = await reference.get();
  if (!activity.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const approval = await adminDb.collection("monthlyApprovals")
    .doc(`${activity.data()?.traineeId}_${activity.data()?.month}`).get();
  if (approval.data()?.locked && body.force !== true)
    return NextResponse.json({ error: "MONTH_LOCKED", canForce: true }, { status: 409 });
  const now = new Date().toISOString();
  await reference.update({
    status,
    reviewerNote: String(body.note || "").trim().slice(0, 1000),
    reviewedAt: now,
    reviewedBy: admin.uid,
    reviewedByRole: "admin",
    adminOverride: true,
    updatedAt: now,
  });
  const totals = await syncTraineeFieldworkTotals(String(activity.data()?.traineeId));
  await logActivity({
    type: "admin_fieldwork_review",
    message: `راجعت الإدارة سجل ساعات بالحالة ${status}`,
    traineeId: String(activity.data()?.traineeId || ""),
    supervisorId: String(activity.data()?.supervisorId || ""),
    meta: { activityId, status, adminOverride: true },
  });
  return NextResponse.json({ success: true, totals });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json();
  if (body.action === "syncAllTotals") {
    const trainees = await adminDb.collection("trainees").limit(500).get();
    let synced = 0;
    for (let index = 0; index < trainees.docs.length; index += 10) {
      const chunk = trainees.docs.slice(index, index + 10);
      await Promise.all(chunk.map((document) => syncTraineeFieldworkTotals(document.id)));
      synced += chunk.length;
    }
    return NextResponse.json({ success: true, synced });
  }
  const traineeId = String(body.traineeId || "");
  if (!traineeId) return NextResponse.json({ error: "TRAINEE_REQUIRED" }, { status: 400 });
  if (body.action === "syncTotals") {
    return NextResponse.json({ success: true, totals: await syncTraineeFieldworkTotals(traineeId) });
  }
  if (body.action !== "finalizeMonth" || !/^\d{4}-\d{2}$/.test(String(body.month || "")))
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });

  const [traineeSnapshot, activitiesSnapshot] = await Promise.all([
    adminDb.collection("trainees").doc(traineeId).get(),
    adminDb.collection("fieldworkActivities").where("traineeId", "==", traineeId)
      .where("month", "==", body.month).get(),
  ]);
  if (!traineeSnapshot.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const trainee = traineeSnapshot.data() as any;
  const activities = activitiesSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as FieldworkActivity[];
  const compliance = buildCompliance(activities, trainee.license || "QASP-S", trainee.fieldworkStartDate);
  const summary = compliance.months.find((item) => item.month === body.month);
  if (!summary) return NextResponse.json({ error: "NO_APPROVED_HOURS" }, { status: 409 });
  const now = new Date().toISOString();
  await adminDb.collection("monthlyApprovals").doc(`${traineeId}_${body.month}`).set({
    traineeId,
    supervisorId: trainee.currentSupervisorId || null,
    month: body.month,
    locked: true,
    adminApprovedAt: now,
    traineeAcknowledgedAt: now,
    lockedAt: now,
    lockedBy: "admin",
    adminOverride: true,
    overrideReason: String(body.reason || "اعتماد إداري").trim().slice(0, 500),
    summary: {
      fieldwork: summary.fieldwork,
      supervision: summary.supervision,
      group: summary.group,
      direct: summary.direct,
      indirect: summary.indirect,
      directRate: summary.directRate,
      indirectRate: summary.indirectRate,
    },
    updatedAt: now,
  }, { merge: true });
  await syncTraineeFieldworkTotals(traineeId);
  await logActivity({
    type: "admin_month_finalized",
    message: `اعتمدت الإدارة شهر ${body.month}`,
    traineeId,
    supervisorId: trainee.currentSupervisorId || "",
    meta: { month: body.month, adminOverride: true },
  });
  return NextResponse.json({ success: true, compliance: summary });
}
