import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/serverAuth";

function generateSlots(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const slots: string[] = [];
  for (let current = startHour * 60 + startMinute; current + 30 <= endHour * 60 + endMinute; current += 30) {
    slots.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
  }
  return slots;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supervisorId = new URL(request.url).searchParams.get("supervisorId");
  if (!supervisorId) return NextResponse.json({ error: "Missing supervisorId" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  const [supervisor, slots] = await Promise.all([
    adminDb.collection("supervisors").doc(supervisorId).get(),
    adminDb.collection("availability").where("supervisorId", "==", supervisorId).where("date", ">=", today).orderBy("date", "asc").get(),
  ]);
  if (!supervisor.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ supervisor: { id: supervisor.id, ...supervisor.data() }, slots: slots.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const supervisorRef = adminDb.collection("supervisors").doc(body.supervisorId || "");
  const supervisor = await supervisorRef.get();
  if (!supervisor.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.action === "seats") {
    const seats = Number(body.seats);
    if (!Number.isInteger(seats) || seats < 0 || seats > 10000) return NextResponse.json({ error: "Invalid seats" }, { status: 400 });
    await supervisorRef.update({ availableSeats: seats, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  }
  if (body.action === "availability") {
    const today = new Date().toISOString().slice(0, 10);
    if (!body.date || body.date < today) return NextResponse.json({ error: "DATE_IN_PAST" }, { status: 400 });
    const times = generateSlots(body.startTime, body.endTime);
    if (!times.length) return NextResponse.json({ error: "INVALID_TIME_RANGE" }, { status: 400 });
    const existing = await adminDb.collection("availability").where("supervisorId", "==", body.supervisorId).where("date", "==", body.date).get();
    const existingTimes = new Set(existing.docs.map((doc) => doc.data().time));
    const batch = adminDb.batch();
    let created = 0;
    times.forEach((time) => { if (!existingTimes.has(time)) { batch.set(adminDb.collection("availability").doc(), { supervisorId: body.supervisorId, date: body.date, time, isBooked: false }); created++; } });
    await batch.commit();
    return NextResponse.json({ success: true, created });
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slotId, supervisorId } = await request.json();
  const slot = await adminDb.collection("availability").doc(slotId || "").get();
  if (!slot.exists || slot.data()?.supervisorId !== supervisorId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (slot.data()?.isBooked) return NextResponse.json({ error: "SLOT_BOOKED" }, { status: 409 });
  await slot.ref.delete();
  return NextResponse.json({ success: true });
}
