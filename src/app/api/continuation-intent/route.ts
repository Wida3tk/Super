import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  continuationOutcome,
  shouldReleaseInterviewSeat,
  type ContinuationDecision,
} from "@/lib/validation/continuation";

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
  const now = new Date().toISOString();
  let result: ReturnType<typeof continuationOutcome>;
  try {
    result = await adminDb.runTransaction(async (transaction) => {
      const [currentBooking, currentTrainee] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(traineeDoc.ref),
      ]);
      if (!currentBooking.exists) throw new Error("BOOKING_NOT_FOUND");
      if (!currentTrainee.exists) throw new Error("TRAINEE_NOT_FOUND");

      const current = currentBooking.data()!;
      if (current.meetingStatus !== "completed" || current.bookingType === "consultation")
        throw new Error("INTERVIEW_NOT_COMPLETED");
      if (current.status === "closed") throw new Error("INTERVIEW_CLOSED");
      const currentEmail = String(current.studentEmail || "").toLowerCase();
      if (
        (isSupervisor && current.supervisorId !== supervisorDoc.id) ||
        (!isSupervisor && currentEmail !== email)
      ) throw new Error("FORBIDDEN");

      const otherDecision =
        current[otherField] || currentTrainee.data()?.[otherField] || "pending";
      const outcome = continuationOutcome(
        decision as ContinuationDecision,
        otherDecision,
      );
      const releaseSeat = shouldReleaseInterviewSeat(
        outcome.declined,
        String(current.status || ""),
        current.seatReleased === true,
      );

      transaction.update(bookingRef, {
        [intentField]: decision,
        continuationUpdatedAt: now,
        ...(outcome.declined
          ? {
              status: "closed",
              closedReason: "continuation_declined",
              closedAt: now,
              ...(releaseSeat ? { seatReleased: true } : {}),
            }
          : {}),
      });
      transaction.update(traineeDoc.ref, {
        [intentField]: decision,
        interviewSupervisorId: current.supervisorId,
        interviewBookingId: bookingId,
        onboardingStage: outcome.stage,
        updatedAt: now,
      });
      if (outcome.bothContinue && !current.continuationCompletedAt) {
        transaction.update(bookingRef, { continuationCompletedAt: now });
        transaction.set(adminDb.collection("notifications").doc(), {
          type: "reminder",
          targetType: "admin",
          message: `اكتملت موافقة الطرفين للمتدرب ${currentTrainee.data()?.name || current.studentName}. الطلب جاهز للمراجعة والتعاقد.`,
          traineeId: traineeDoc.id,
          supervisorId: current.supervisorId,
          read: false,
          createdAt: now,
        });
      }
      if (releaseSeat) {
        transaction.update(adminDb.collection("supervisors").doc(current.supervisorId), {
          availableSeats: FieldValue.increment(1),
        });
      }
      return outcome;
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const statusByCode: Record<string, number> = {
      BOOKING_NOT_FOUND: 404,
      TRAINEE_NOT_FOUND: 404,
      INTERVIEW_NOT_COMPLETED: 409,
      INTERVIEW_CLOSED: 409,
      FORBIDDEN: 403,
    };
    if (statusByCode[code])
      return NextResponse.json({ error: code }, { status: statusByCode[code] });
    throw error;
  }
  const { stage, bothContinue } = result;
  return NextResponse.json({ success: true, stage, bothContinue });
}
