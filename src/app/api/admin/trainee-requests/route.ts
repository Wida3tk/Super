import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json();
  const id = String(body.id || "");
  const decision = String(body.decision || "");
  const adminNote = String(body.adminNote || "")
    .trim()
    .slice(0, 1000);
  if (!id || !["approved", "rejected"].includes(decision))
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const ref = adminDb.collection("traineeRequests").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.status !== "pending")
    return NextResponse.json({ error: "NOT_PENDING" }, { status: 409 });
  const data = snapshot.data()!;
  const batch = adminDb.batch();
  batch.update(ref, {
    status: decision,
    adminNote,
    reviewedAt: new Date().toISOString(),
    reviewedBy: admin.uid,
    updatedAt: new Date().toISOString(),
  });
  if (decision === "approved" && data.type === "defer")
    batch.update(adminDb.collection("trainees").doc(data.traineeId), {
      status: "paused",
      pauseStartDate: data.startDate,
      expectedReturnDate: data.returnDate,
      updatedAt: new Date().toISOString(),
    });
  if (decision === "approved" && data.type === "withdraw")
    batch.update(adminDb.collection("trainees").doc(data.traineeId), {
      status: "withdrawn",
      withdrawnAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  await batch.commit();
  return NextResponse.json({ success: true });
}
