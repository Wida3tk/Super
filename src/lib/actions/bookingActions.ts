"use server";

import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  sendBookingConfirmationEmail,
  sendCancellationEmail,
  sendSupervisorBookingNotification,
} from "@/lib/email/emailService";
import type { Booking, BookingStatus, CreateBookingPayload } from "@/types";
import { getSessionUser } from "@/lib/auth/serverAuth";
import {
  isManagementToken,
  validateBookingPayload,
} from "@/lib/validation/booking";
import {
  cancelCalendarEvent,
  createCalendarEvent,
} from "@/lib/calendar/googleCalendar";

type BookingResult = {
  success: boolean;
  bookingId?: string;
  managementToken?: string;
  referenceNumber?: string;
  error?: string;
};

const BOOKING_ERRORS = new Set([
  "ALREADY_HAS_BOOKING",
  "SUPERVISOR_NOT_FOUND",
  "NO_SEATS_AVAILABLE",
  "INVALID_SLOT",
  "SLOT_NOT_AVAILABLE",
  "ACCOUNT_EXISTS",
]);

export async function createBooking(
  payload: CreateBookingPayload,
  locale: "ar" | "en" = "ar",
): Promise<BookingResult> {
  const validationError = validateBookingPayload(payload);
  if (validationError) return { success: false, error: validationError };

  const normalizedEmail = payload.studentEmail.toLowerCase().trim();
  const bookingType =
    payload.bookingType === "consultation"
      ? "consultation"
      : "initial_interview";
  const consultationType =
    bookingType === "consultation" ? payload.consultationType : undefined;
  const managementToken = randomBytes(32).toString("hex");
  const referenceNumber =
    `SUL-${Math.random().toString(36).substring(2, 6).toUpperCase()}-` +
    Date.now().toString(36).slice(-4).toUpperCase();

  const bookingRef = adminDb.collection("bookings").doc();
  const supervisorRef = adminDb
    .collection("supervisors")
    .doc(payload.supervisorId);
  const slotRef = adminDb
    .collection("availability")
    .doc(payload.availabilitySlotId);
  const existingBookingQuery = adminDb
    .collection("bookings")
    .where("studentEmail", "==", normalizedEmail)
    .where("status", "==", "confirmed");

  const bookingData: Omit<Booking, "id"> = {
    studentName: payload.studentName.trim(),
    studentEmail: normalizedEmail,
    studentPhone: payload.studentPhone.trim(),
    supervisorId: payload.supervisorId,
    date: payload.date,
    time: payload.time,
    meetLink: "",
    googleEventId: "",
    status: "confirmed",
    referenceNumber,
    managementToken,
    availabilitySlotId: payload.availabilitySlotId,
    createdAt: new Date().toISOString(),
    bookingType,
    ...(consultationType ? { consultationType } : {}),
  };
  let createdAuthUid = "";

  try {
    const sessionUser = await getSessionUser();
    const bookingFromOwnAccount =
      sessionUser?.email?.trim().toLowerCase() === normalizedEmail;
    try {
      await adminAuth.getUserByEmail(normalizedEmail);
      if (!bookingFromOwnAccount) throw new Error("ACCOUNT_EXISTS");
    } catch (error: any) {
      if (error?.message === "ACCOUNT_EXISTS") throw error;
      if (error?.code !== "auth/user-not-found") throw error;
    }
    if (!bookingFromOwnAccount) {
      const account = await adminAuth.createUser({
        email: normalizedEmail,
        password: payload.password,
        displayName: bookingData.studentName,
      });
      createdAuthUid = account.uid;
      await adminDb.collection("clients").doc(account.uid).set({
        name: bookingData.studentName,
        email: normalizedEmail,
        phone: bookingData.studentPhone,
        createdAt: new Date().toISOString(),
      });
    }
    const supervisor = await adminDb.runTransaction(async (transaction) => {
      const [existingBookings, supervisorSnap, slotSnap] = await Promise.all([
        transaction.get(existingBookingQuery),
        transaction.get(supervisorRef),
        transaction.get(slotRef),
      ]);

      if (
        existingBookings.docs.some(
          (doc) =>
            (doc.data().bookingType || "initial_interview") === bookingType,
        )
      )
        throw new Error("ALREADY_HAS_BOOKING");
      if (!supervisorSnap.exists) throw new Error("SUPERVISOR_NOT_FOUND");
      if (!slotSnap.exists) throw new Error("INVALID_SLOT");

      const supervisorData = supervisorSnap.data()!;
      const slot = slotSnap.data()!;

      if (supervisorData.isActive === false)
        throw new Error("SUPERVISOR_NOT_FOUND");
      if (
        bookingType === "initial_interview" &&
        (supervisorData.availableSeats ?? 0) <= 0
      )
        throw new Error("NO_SEATS_AVAILABLE");
      if (
        slot.isBooked ||
        slot.supervisorId !== payload.supervisorId ||
        slot.date !== payload.date ||
        slot.time !== payload.time
      ) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      const sessionDate = new Date(`${payload.date}T${payload.time}:00`);
      if (Number.isNaN(sessionDate.getTime()) || sessionDate <= new Date()) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      transaction.set(bookingRef, bookingData);
      transaction.update(slotRef, { isBooked: true, bookingId: bookingRef.id });
      transaction.update(
        supervisorRef,
        bookingType === "initial_interview"
          ? {
              totalSessions: FieldValue.increment(1),
              availableSeats: FieldValue.increment(-1),
            }
          : { totalSessions: FieldValue.increment(1) },
      );

      return supervisorData;
    });

    let meetLink = "";
    try {
      const startDateTime = `${payload.date}T${payload.time}:00+03:00`;
      const end = new Date(new Date(startDateTime).getTime() + 30 * 60 * 1000);
      const calendarEvent = await createCalendarEvent({
        summary: `${bookingType === "consultation" ? "استشارة" : "مقابلة إشراف أولية"} — ${bookingData.studentName}`,
        description: `موعد عبر منصة سلوكيرا مع ${supervisor.name}. رقم الحجز: ${referenceNumber}`,
        startDateTime,
        endDateTime: end.toISOString(),
        attendeeEmails: supervisor.email
          ? [bookingData.studentEmail, supervisor.email]
          : [bookingData.studentEmail],
        timeZone: "Asia/Riyadh",
      });
      meetLink = calendarEvent.meetLink;
      await bookingRef.update({
        meetLink,
        googleEventId: calendarEvent.googleEventId,
      });
    } catch (error) {
      console.error("Google Calendar event error:", error);
    }

    try {
      await sendBookingConfirmationEmail({
        studentName: bookingData.studentName,
        studentEmail: bookingData.studentEmail,
        supervisorName: supervisor.name,
        date: payload.date,
        time: payload.time,
        meetLink,
        managementToken,
        locale,
      });
    } catch (error) {
      console.error("Booking confirmation email error:", error);
    }

    if (supervisor.email) {
      try {
        await sendSupervisorBookingNotification({
          studentName: bookingData.studentName,
          studentEmail: bookingData.studentEmail,
          supervisorName: supervisor.name,
          supervisorEmail: supervisor.email,
          date: payload.date,
          time: payload.time,
          meetLink,
          managementToken,
          referenceNumber,
          locale: "ar",
        });
      } catch (error) {
        console.error("Supervisor notification error:", error);
      }
    }

    return {
      success: true,
      bookingId: bookingRef.id,
      managementToken,
      referenceNumber,
    };
  } catch (error) {
    if (createdAuthUid) {
      await Promise.allSettled([
        adminAuth.deleteUser(createdAuthUid),
        adminDb.collection("clients").doc(createdAuthUid).delete(),
      ]);
    }
    console.error("Booking creation error:", error);
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: BOOKING_ERRORS.has(message) ? message : "UNKNOWN_ERROR",
    };
  }
}

export async function cancelBookingByToken(
  token: string,
  locale: "ar" | "en" = "ar",
): Promise<{ success: boolean; error?: string }> {
  if (!isManagementToken(token)) {
    return { success: false, error: "BOOKING_NOT_FOUND" };
  }

  const bookingQuery = adminDb
    .collection("bookings")
    .where("managementToken", "==", token)
    .where("status", "==", "confirmed")
    .limit(1);

  try {
    const booking = await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(bookingQuery);
      if (snap.empty) throw new Error("BOOKING_NOT_FOUND");

      const bookingDoc = snap.docs[0];
      const data = bookingDoc.data() as Booking;
      const sessionDate = new Date(`${data.date}T${data.time}:00`);
      if (sessionDate <= new Date()) throw new Error("SESSION_ALREADY_PASSED");

      transaction.update(bookingDoc.ref, {
        status: "cancelled" as BookingStatus,
        cancelledAt: new Date().toISOString(),
      });
      if ((data.bookingType || "initial_interview") === "initial_interview") {
        transaction.update(
          adminDb.collection("supervisors").doc(data.supervisorId),
          {
            availableSeats: FieldValue.increment(1),
          },
        );
      }

      if (data.availabilitySlotId) {
        transaction.update(
          adminDb.collection("availability").doc(data.availabilitySlotId),
          {
            isBooked: false,
            bookingId: null,
          },
        );
      }

      return data;
    });

    if (booking.googleEventId) {
      try {
        await cancelCalendarEvent(booking.googleEventId);
      } catch (error) {
        console.error("Calendar cancellation error:", error);
      }
    }

    try {
      await sendCancellationEmail(
        booking.studentEmail,
        booking.studentName,
        booking.date,
        booking.time,
        locale,
      );
    } catch (error) {
      console.error("Cancellation email error:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("Cancel booking error:", error);
    const message = error instanceof Error ? error.message : "";
    return {
      success: false,
      error: ["BOOKING_NOT_FOUND", "SESSION_ALREADY_PASSED"].includes(message)
        ? message
        : "UNKNOWN_ERROR",
    };
  }
}

export async function getBookingByToken(
  token: string,
): Promise<Booking | null> {
  if (!isManagementToken(token)) return null;

  try {
    const snap = await adminDb
      .collection("bookings")
      .where("managementToken", "==", token)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data();
    const supervisorSnap = await adminDb
      .collection("supervisors")
      .doc(data.supervisorId)
      .get();
    const supervisorName = supervisorSnap.exists
      ? supervisorSnap.data()!.name
      : "";

    return { id: doc.id, ...data, supervisorName } as Booking;
  } catch (error) {
    console.error("Get booking by token error:", error);
    return null;
  }
}
