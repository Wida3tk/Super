export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee, hasActiveTraineeService } from "@/lib/auth/serverAuth";
import { DISPUTE_NOTE_MIN, needsAcknowledgment } from "@/lib/supervision/sessionAcknowledgment";
import type { FieldworkActivity } from "@/types";

/**
 * The trainee confirms or disputes one supervision session the supervisor
 * logged. Hours are not changed here; a dispute only flags the session and
 * notifies the supervisor and the administration.
 */
export async function POST(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasActiveTraineeService(trainee)) return NextResponse.json({ error: "ASSIGNMENT_REQUIRED" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const activityId = typeof body.activityId === "string" ? body.activityId : "";
  const action = body.action;
  const note = String(body.note || "").trim().slice(0, 1000);
  if (!activityId || activityId.includes("/") || !["confirm", "dispute"].includes(action))
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  if (action === "dispute" && note.length < DISPUTE_NOTE_MIN)
    return NextResponse.json({ error: "NOTE_REQUIRED" }, { status: 400 });

  const now = new Date().toISOString();
  const ref = adminDb.collection("fieldworkActivities").doc(activityId);
  let row: FieldworkActivity;
  try {
    row = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? ({ id: snap.id, ...snap.data() } as FieldworkActivity) : null;
      if (!data || data.traineeId !== trainee.id) throw new Error("NOT_FOUND");
      if (!needsAcknowledgment(data)) throw new Error("NOT_ACKNOWLEDGEABLE");
      const approval = await tx.get(adminDb.collection("monthlyApprovals").doc(`${trainee.id}_${data.month}`));
      if (approval.data()?.locked) throw new Error("MONTH_LOCKED");
      const traineeAcknowledgment = action === "confirm"
        ? { status: "confirmed", at: now, note: null, via: "session" }
        : { status: "disputed", at: now, note, via: "session" };
      tx.update(ref, { traineeAcknowledgment, updatedAt: now });
      return { ...data, traineeAcknowledgment } as FieldworkActivity;
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: code }, { status: 404 });
    if (code === "NOT_ACKNOWLEDGEABLE" || code === "MONTH_LOCKED") return NextResponse.json({ error: code }, { status: 409 });
    throw error;
  }

  const label = `${row.date} · ${row.duration} ساعة · ${row.format === "group" ? "جماعية" : "فردية"}`;
  await Promise.all([
    adminDb.collection("activityLog").add({
      type: action === "confirm" ? "session_acknowledged" : "session_disputed",
      traineeId: trainee.id, supervisorId: row.supervisorId, activityId,
      message: action === "confirm"
        ? `أقرّ ${trainee.name} بجلسة الإشراف (${label})`
        : `اعترض ${trainee.name} على جلسة إشراف (${label})`,
      createdAt: now,
    }),
    ...(action === "dispute" ? [
      adminDb.collection("notifications").add({
        targetType: "supervisor", supervisorId: row.supervisorId, traineeId: trainee.id, read: false,
        type: "session_disputed", title: "اعتراض على جلسة إشراف",
        message: `${trainee.name} اعترض على جلسة ${label}: ${note}`, createdAt: now,
      }),
      adminDb.collection("notifications").add({
        targetType: "admin", traineeId: trainee.id, supervisorId: row.supervisorId, read: false,
        type: "session_disputed", title: "اعتراض متدرب على جلسة إشراف",
        message: `${trainee.name} اعترض على جلسة ${label}`, createdAt: now,
      }),
    ] : []),
  ]);
  return NextResponse.json({ success: true, activity: row });
}
