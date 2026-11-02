export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee, hasActiveTraineeService } from "@/lib/auth/serverAuth";
import { ackState } from "@/lib/supervision/sessionAcknowledgment";
import type { FieldworkActivity } from "@/types";

export async function POST(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasActiveTraineeService(trainee))
    return NextResponse.json({ error: "ASSIGNMENT_REQUIRED" }, { status: 403 });
  const { month, attestation } = await req.json();
  if (!/^\d{4}-\d{2}$/.test(String(month)) || attestation !== true)
    return NextResponse.json(
      { error: "ATTESTATION_REQUIRED" },
      { status: 400 },
    );
  const ref = adminDb
    .collection("monthlyApprovals")
    .doc(`${trainee.id}_${month}`);
  const snap = await ref.get();
  if (
    !snap.exists ||
    snap.data()?.traineeId !== trainee.id ||
    !snap.data()?.supervisorApprovedAt
  )
    return NextResponse.json(
      { error: "SUPERVISOR_APPROVAL_REQUIRED" },
      { status: 409 },
    );
  const monthRows = await adminDb
    .collection("fieldworkActivities")
    .where("traineeId", "==", trainee.id)
    .where("month", "==", month)
    .get();
  const rows = monthRows.docs.map((d) => ({ id: d.id, ...d.data() }) as FieldworkActivity);
  if (rows.some((row) => ackState(row) === "disputed"))
    return NextResponse.json({ error: "SESSION_DISPUTED" }, { status: 409 });
  const now = new Date().toISOString();
  // Acknowledging the month confirms the sessions not yet confirmed one by one.
  const pending = rows.filter((row) => ackState(row) === "pending");
  if (pending.length) {
    const batch = adminDb.batch();
    for (const row of pending)
      batch.update(adminDb.collection("fieldworkActivities").doc(row.id), {
        traineeAcknowledgment: { status: "confirmed", at: now, note: null, via: "monthly" },
        updatedAt: now,
      });
    await batch.commit();
  }
  await ref.update({
    traineeAcknowledgedAt: now,
    traineeName: trainee.name,
    locked: true,
    lockedAt: now,
  });
  return NextResponse.json({ success: true });
}
