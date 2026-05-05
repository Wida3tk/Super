'use server';

import { adminDb } from '@/lib/firebase/admin';
import { sendBookingConfirmationEmail, sendCancellationEmail } from '@/lib/email/emailService';
import { CreateBookingPayload, Booking, BookingStatus } from '@/types';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

export async function createBooking(
  payload: CreateBookingPayload,
  locale: 'ar' | 'en' = 'ar'
): Promise<{ success: boolean; bookingId?: string; managementToken?: string; error?: string }> {

  if (!payload.studentName?.trim()) return { success: false, error: 'MISSING_NAME' };
  if (!payload.studentEmail?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return { success: false, error: 'INVALID_EMAIL' };
  if (!payload.studentPhone?.match(/^\+?[\d\s\-]{8,15}$/)) return { success: false, error: 'INVALID_PHONE' };

  const managementToken = randomBytes(32).toString('hex');

  try {
    // التحقق من عدم وجود حجز مؤكد لنفس البريد
    const existingBookingsSnap = await adminDb
      .collection('bookings')
      .where('studentEmail', '==', payload.studentEmail.toLowerCase().trim())
      .where('status', '==', 'confirmed')
      .get();

    if (!existingBookingsSnap.empty) {
      return { success: false, error: 'ALREADY_HAS_BOOKING' };
    }

    // جلب بيانات المشرف
    const supervisorSnap = await adminDb.collection('supervisors').doc(payload.supervisorId).get();
    if (!supervisorSnap.exists) return { success: false, error: 'SUPERVISOR_NOT_FOUND' };
    const supervisor = supervisorSnap.data()!;

    // إنشاء سجل الحجز
    const bookingRef = adminDb.collection('bookings').doc();
    const bookingData: Omit<Booking, 'id'> = {
      studentName: payload.studentName.trim(),
      studentEmail: payload.studentEmail.toLowerCase().trim(),
      studentPhone: payload.studentPhone.trim(),
      supervisorId: payload.supervisorId,
      date: payload.date,
      time: payload.time,
      meetLink: '',
      googleEventId: '',
      status: 'confirmed',
      managementToken,
      createdAt: new Date().toISOString(),
    };

    await bookingRef.set(bookingData);

    // تحديث إحصائيات المشرف
    await adminDb.collection('supervisors').doc(payload.supervisorId).update({
      totalSessions: FieldValue.increment(1)
    });

    // إرسال بريد التأكيد
    try {
      await sendBookingConfirmationEmail({
        studentName: bookingData.studentName,
        studentEmail: bookingData.studentEmail,
        supervisorName: supervisor.name,
        date: payload.date,
        time: payload.time,
        meetLink: '',
        managementToken,
        locale,
      });
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr);
    }

    return { success: true, bookingId: bookingRef.id, managementToken };

  } catch (error: any) {
    console.error('Booking creation error:', error);
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
    };
  }
}

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

    const sessionDate = new Date(`${booking.date}T${booking.time}`);
    if (sessionDate < new Date()) {
      return { success: false, error: 'SESSION_ALREADY_PASSED' };
    }

    await bookingDoc.ref.update({ status: 'cancelled' as BookingStatus });

    try {
      await sendCancellationEmail(
        booking.studentEmail,
        booking.studentName,
        booking.date,
        booking.time,
        locale
      );
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr);
    }

    return { success: true };
  } catch (error) {
    console.error('Cancel booking error:', error);
    return { success: false, error: 'UNKNOWN_ERROR' };
  }
}

export async function getBookingByToken(token: string): Promise<Booking | null> {
  try {
    const snap = await adminDb
      .collection('bookings')
      .where('managementToken', '==', token)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data();

    const supervisorSnap = await adminDb.collection('supervisors').doc(data.supervisorId).get();
    const supervisorName = supervisorSnap.exists ? supervisorSnap.data()!.name : '';

    return { id: doc.id, ...data, supervisorName } as Booking;
  } catch (error) {
    console.error('getBookingByToken error:', error);
    return null;
  }
}
