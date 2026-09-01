import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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
  const supervisors = await adminDb.collection("supervisors").where("email", "==", email).limit(1).get();
  const supervisorDoc = supervisors.docs[0];
  const isSupervisor = supervisorDoc?.id === booking.supervisorId;
  const isTrainee = String(booking.studentEmail || "").toLowerCase() === email;
  if (!isSupervisor && !isTrainee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const trainees = await adminDb.collection("trainees").where("email", "==", String(booking.studentEmail || "").toLowerCase()).limit(1).get();
  const traineeDoc = trainees.docs[0];
  if (!traineeDoc) return NextResponse.json({ error: "Trainee account not found" }, { status: 404 });

  const intentField = isSupervisor ? "supervisorContinuationIntent" : "traineeContinuationIntent";
  const otherField = isSupervisor ? "traineeContinuationIntent" : "supervisorContinuationIntent";
  const otherDecision = booking[otherField] || traineeDoc.data()[otherField] || "pending";
  const bothContinue = decision === "continue" && otherDecision === "continue";
  const declined = decision === "decline" || otherDecision === "decline";
  const stage = declined
    ? "interview_declined"
    : bothContinue ? "admin_review" : "awaiting_decisions";
  const now = new Date().toISOString();
  const batch = adminDb.batch();
  batch.update(bookingRef, {
    [intentField]: decision,
    continuationUpdatedAt: now,
    ...(declined ? { status: "closed", closedReason: "continuation_declined", closedAt: now } : {}),
  });
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
  if (declined && booking.status !== "closed" && booking.seatReleased !== true) {
    batch.update(bookingRef, { seatReleased: true });
    batch.update(adminDb.collection("supervisors").doc(booking.supervisorId), {
      availableSeats: FieldValue.increment(1),
    });
  }
  await batch.commit();
  return NextResponse.json({ success: true, stage, bothContinue });
}
