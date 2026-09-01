export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee } from "@/lib/auth/serverAuth";

export async function PATCH(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!trainee.currentSupervisorId || trainee.status !== "active")
    return NextResponse.json({ error: "ASSIGNMENT_REQUIRED" }, { status: 403 });
  const body = await req.json();
  if (body.entity === "meeting") {
    const ref = adminDb.collection("meetingMinutes").doc(String(body.id || ""));
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.traineeId !== trainee.id)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (body.action === "acknowledge") {
      await ref.update({
        acknowledgedByTrainee: true,
        acknowledgedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }
    if (body.action === "complete_task") {
      const tasks = Array.isArray(snap.data()?.tasks) ? snap.data()!.tasks : [];
      const updated = tasks.map((t: any) =>
        t.id === body.taskId
          ? {
              ...t,
              status: "completed",
              completedAt: new Date().toISOString(),
              completedBy: "trainee",
            }
          : t,
      );
      await ref.update({ tasks: updated, updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }
  }
  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}
