import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee } from "@/lib/auth/serverAuth";

const TYPES = new Set(["defer", "withdraw", "change_supervisor"]);
const clean = (value: unknown, max = 1000) =>
  String(value || "")
    .trim()
    .slice(0, max);

export async function POST(request: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!trainee.currentSupervisorId || trainee.status !== "active")
    return NextResponse.json({ error: "ASSIGNMENT_REQUIRED" }, { status: 403 });
  const body = await request.json();
  const type = clean(body.type, 30);
  const reason = clean(body.reason);
  const startDate = clean(body.startDate, 10);
  const returnDate = clean(body.returnDate, 10);
  if (!TYPES.has(type) || reason.length < 10)
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  if (
    type === "defer" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(returnDate) ||
      returnDate < startDate)
  ) {
    return NextResponse.json({ error: "INVALID_DATES" }, { status: 400 });
  }
  if (type === "defer") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${returnDate}T00:00:00`);
    const noticeDays = Math.ceil(
      (start.getTime() - today.getTime()) / 86400000,
    );
    const deferDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    if (noticeDays < 14)
      return NextResponse.json({ error: "NOTICE_TOO_SHORT" }, { status: 400 });
    if (deferDays > 30)
      return NextResponse.json({ error: "DEFER_TOO_LONG" }, { status: 400 });
  }
  const pending = await adminDb
    .collection("traineeRequests")
    .where("traineeId", "==", trainee.id)
    .where("type", "==", type)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!pending.empty)
    return NextResponse.json({ error: "PENDING_EXISTS" }, { status: 409 });
  const now = new Date().toISOString();
  const ref = await adminDb.collection("traineeRequests").add({
    traineeId: trainee.id,
    traineeName: trainee.name,
    traineeEmail: trainee.email,
    supervisorId: trainee.currentSupervisorId || "",
    type,
    reason,
    startDate: type === "defer" ? startDate : "",
    returnDate: type === "defer" ? returnDate : "",
    status: "pending",
    adminNote: "",
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({
    success: true,
    request: {
      id: ref.id,
      type,
      reason,
      startDate,
      returnDate,
      status: "pending",
      createdAt: now,
    },
  });
}
