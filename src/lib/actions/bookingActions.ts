// src/lib/actions/bookingActions.ts
'use server';

import { adminDb } from '@/lib/firebase/admin';
import { createCalendarEvent, cancelCalendarEvent, updateCalendarEvent } from '@/lib/calendar/googleCalendar';
import { sendBookingConfirmationEmail, sendCancellationEmail } from '@/lib/email/emailService';
import { CreateBookingPayload, Booking, BookingStatus } from '@/types';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * إنشاء حجز جديد — مع منع التعارض عبر Transaction
 */
export async function createBooking(
  payload: CreateBookingPayload,
  locale: 'ar' | 'en' = 'ar'
): Promise<{ success: boolean; bookingId?: string; managementToken?: string; error?: string }> {

  // --- التحقق من المدخلات ---
  if (!payload.studentName?.trim()) return { success: false, error: 'MISSING_NAME' };
  if (!payload.studentEmail?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return { success: false, error: 'INVALID_EMAIL' };
  if (!payload.studentPhone?.match(/^\+?[\d\s\-]{8,15}$/)) return { success: false, error: 'INVALID_PHONE' };

  const managementToken = randomBytes(32).toString('hex');

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. التحقق من عدم وجود حجز مؤكد لنفس البريد
      const existingBookingsSnap = await adminDb
        .collection('bookings')
        .where('studentEmail', '==', payload.studentEmail)
        .where('status', '==', 'confirmed')
        .get();

      if (!existingBookingsSnap.empty) {
        throw new Error('ALREADY_HAS_BOOKING');
      }

      // 2. التحقق من أن الشريحة الزمنية متاحة (غير محجوزة)
      const slotRef = adminDb.collection('availability').doc(payload.availabilitySlotId);
      const slotSnap = await transaction.get(slotRef);

      if (!slotSnap.exists) throw new Error('SLOT_NOT_FOUND');
      const slotData = slotSnap.data()!;
      if (slotData.isBooked) throw new Error('SLOT_TAKEN');

      // 3. جلب بيانات المشرف
      const supervisorSnap = await adminDb.collection('supervisors').doc(payload.supervisorId).get();
      if (!supervisorSnap.exists) throw new Error('SUPERVISOR_NOT_FOUND');
      const supervisor = supervisorSnap.data()!;

      // 4. حجز الشريحة فوراً في نفس الـ transaction (منع race condition)
      const bookingRef = adminDb.collection('bookings').doc();
      transaction.update(slotRef, { isBooked: true, bookingId: bookingRef.id });

      // 5. إنشاء سجل الحجز
      const bookingData: Omit<Booking, 'id'> = {
        studentName: payload.studentName.trim(),
        studentEmail: payload.studentEmail.toLowerCase().trim(),
        studentPhone: payload.studentPhone.trim(),
        supervisorId: payload.supervisorId,
        date: payload.date,
        time: payload.time,
        meetLink: '',           // سيُحدَّث بعد إنشاء Google Calendar
        googleEventId: '',
        status: 'confirmed',
        managementToken,
        createdAt: new Date().toISOString(),
      };

      transaction.set(bookingRef, bookingData);

      // 6. تحديث إحصائيات المشرف
      const supervisorRef = adminDb.collection('supervisors').doc(payload.supervisorId);
      transaction.update(supervisorRef, { totalSessions: FieldValue.increment(1) });

      return { bookingRef, bookingData, supervisor, slotData };
    });

    // --- خارج الـ Transaction: إنشاء Google Calendar Event ---
    const { bookingRef, bookingData, supervisor } = result;

    const startISO = `${payload.date}T${payload.time}:00`;
    const endDate = new Date(`${payload.date}T${payload.time}:00`);
    endDate.setMinutes(endDate.getMinutes() + 30);
    const endISO = endDate.toISOString().slice(0, 19);

    let meetLink = '';
    let googleEventId = '';

    try {
      const calendarEvent = await createCalendarEvent({
        summary: locale === 'ar'
          ? `جلسة إشراف — ${payload.studentName} مع ${supervisor.name}`
          : `Supervision Session — ${payload.studentName} with ${supervisor.name}`,
        description: locale === 'ar'
          ? `جلسة إشراف أكاديمي\nالطالب: ${payload.studentName}\nالمشرف: ${supervisor.name}`
          : `Academic supervision session\nStudent: ${payload.studentName}\nSupervisor: ${supervisor.name}`,
        startDateTime: startISO,
        endDateTime: endISO,
        attendeeEmails: [payload.studentEmail, supervisor.email],
      });

      meetLink = calendarEvent.meetLink;
      googleEventId = calendarEvent.googleEventId;

      // تحديث الحجز برابط Meet و معرف الحدث
      await bookingRef.update({ meetLink, googleEventId });
    } catch (calErr) {
      console.error('Google Calendar error (non-fatal):', calErr);
      // الحجز يكمل حتى لو فشل Calendar
    }

    // --- إرسال بريد التأكيد ---
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

    return { success: true, bookingId: bookingRef.id, managementToken };

  } catch (error: any) {
    console.error('Booking creation error:', error);
    const knownErrors = ['ALREADY_HAS_BOOKING', 'SLOT_TAKEN', 'SLOT_NOT_FOUND', 'SUPERVISOR_NOT_FOUND'];
    return {
      success: false,
      error: knownErrors.includes(error.message) ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * إلغاء الحجز عبر التوكن
 */
export async function cancelBookingByToken(
  token: string,
  locale: 'ar' | 'en' = 'ar'
): Promise<{ success: boolean; error?: string }> {
  try {
    const snap = await adminDb
      .collection('bookings')
      .where('managementToken', '==', token)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get();

    if (snap.empty) return { success: false, error: 'BOOKING_NOT_FOUND' };

    const bookingDoc = snap.docs[0];
    const booking = bookingDoc.data() as Booking;

    // تحقق من أن الموعد لم يمر بعد
    const sessionDate = new Date(`${booking.date}T${booking.time}`);
    if (sessionDate < new Date()) {
      return { success: false, error: 'SESSION_ALREADY_PASSED' };
    }

    await adminDb.runTransaction(async (tx) => {
      // 1. تحديث حالة الحجز
      tx.update(bookingDoc.ref, { status: 'cancelled' as BookingStatus });

      // 2. تحرير الشريحة الزمنية
      if (booking.googleEventId) {
        const slotSnap = await adminDb
          .collection('availability')
          .where('bookingId', '==', bookingDoc.id)
          .limit(1)
          .get();

        if (!slotSnap.empty) {
          tx.update(slotSnap.docs[0].ref, { isBooked: false, bookingId: null });
        }
      }
    });

    // إلغاء حدث Google Calendar
    if (booking.googleEventId) {
      try {
        await cancelCalendarEvent(booking.googleEventId);
      } catch (calErr) {
        console.error('Calendar cancellation error (non-fatal):', calErr);
      }
    }

    // بريد الإلغاء
    await sendCancellationEmail(
      booking.studentEmail,
      booking.studentName,
      booking.date,
      booking.time,
      locale
    );

    return { success: true };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, error: 'UNKNOWN_ERROR' };
  }
}

/**
 * جلب حجز الطالب عبر التوكن (للصفحة manage-booking)
 */
export async function getBookingByToken(token: string): Promise<Booking | null> {
  const snap = await adminDb
    .collection('bookings')
    .where('managementToken', '==', token)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data();

  // جلب اسم المشرف
  const supervisorSnap = await adminDb.collection('supervisors').doc(data.supervisorId).get();
  const supervisorName = supervisorSnap.exists ? supervisorSnap.data()!.name : '';

  return { id: doc.id, ...data, supervisorName } as Booking;
}
