import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

async function sessionUser() {
  const session = (await cookies()).get("__session")?.value;
  if (!session) return null;
  try {
    return await adminAuth.verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await sessionUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { bookingId, decision } = await req.json();
  if (!bookingId || !["continue", "decline"].includes(decision))
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const bookingRef = adminDb.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const booking = bookingSnap.data() as any;
  if (booking.meetingStatus !== "completed" || booking.bookingType === "consultation")
    return NextResponse.json({ error: "Interview not completed" }, { status: 409 });

  const email = user.email.toLowerCase();
  const supervisors = await adminDb.collection("supervisors").get();
  const supervisorDoc = supervisors.docs.find((doc) => String(doc.data().email || "").toLowerCase() === email);
  const isSupervisor = supervisorDoc?.id === booking.supervisorId;
  const isTrainee = String(booking.studentEmail || "").toLowerCase() === email;
  if (!isSupervisor && !isTrainee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const trainees = await adminDb.collection("trainees").get();
  const traineeDoc = trainees.docs.find((doc) => String(doc.data().email || "").toLowerCase() === String(booking.studentEmail || "").toLowerCase());
  if (!traineeDoc) return NextResponse.json({ error: "Trainee account not found" }, { status: 404 });

  const intentField = isSupervisor ? "supervisorContinuationIntent" : "traineeContinuationIntent";
  const otherField = isSupervisor ? "traineeContinuationIntent" : "supervisorContinuationIntent";
  const otherDecision = booking[otherField] || traineeDoc.data()[otherField] || "pending";
  const bothContinue = decision === "continue" && otherDecision === "continue";
  const stage = decision === "decline" || otherDecision === "decline"
    ? "awaiting_decisions"
    : bothContinue ? "admin_review" : "awaiting_decisions";
  const now = new Date().toISOString();
  const batch = adminDb.batch();
  batch.update(bookingRef, { [intentField]: decision, continuationUpdatedAt: now });
  batch.update(traineeDoc.ref, {
    [intentField]: decision,
    interviewSupervisorId: booking.supervisorId,
    interviewBookingId: bookingId,
    onboardingStage: stage,
    updatedAt: now,
  });
  if (bothContinue) {
    const notificationRef = adminDb.collection("notifications").doc();
    batch.set(notificationRef, {
      type: "reminder",
      targetType: "admin",
      message: `اكتملت موافقة الطرفين للمتدرب ${traineeDoc.data().name || booking.studentName}. الطلب جاهز للمراجعة والتعاقد.`,
      traineeId: traineeDoc.id,
      supervisorId: booking.supervisorId,
      read: false,
      createdAt: now,
    });
  }
  await batch.commit();
  return NextResponse.json({ success: true, stage, bothContinue });
}
