export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee, hasActiveTraineeService } from "@/lib/auth/serverAuth";

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
  const now = new Date().toISOString();
  await ref.update({
    traineeAcknowledgedAt: now,
    traineeName: trainee.name,
    locked: true,
    lockedAt: now,
  });
  return NextResponse.json({ success: true });
}
