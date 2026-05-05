'use server';

import { adminDb } from '@/lib/firebase/admin';
import { sendBookingConfirmationEmail, sendCancellationEmail, sendSupervisorBookingNotification } from '@/lib/email/emailService';
import { CreateBookingPayload, Booking, BookingStatus } from '@/types';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

export async function createBooking(
  payload: CreateBookingPayload,
  locale: 'ar' | 'en' = 'ar'
): Promise<{ success: boolean; bookingId?: string; managementToken?: string; referenceNumber?: string; error?: string }> {

  if (!payload.studentName?.trim()) return { success: false, error: 'MISSING_NAME' };
  if (!payload.studentEmail?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return { success: false, error: 'INVALID_EMAIL' };
  if (!payload.studentPhone?.match(/^\+?[\d\s\-]{8,15}$/)) return { success: false, error: 'INVALID_PHONE' };

  const managementToken = randomBytes(32).toString('hex');
  const referenceNumber = 'SUL-' + Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase();

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

    // التحقق من وجود مقاعد متاحة
    const availableSeats = supervisor.availableSeats ?? 0;
    if (availableSeats <= 0) {
      return { success: false, error: 'NO_SEATS_AVAILABLE' };
    }

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
      referenceNumber,
      managementToken,
      availabilitySlotId: payload.availabilitySlotId,
      createdAt: new Date().toISOString(),
    };

    await bookingRef.set(bookingData);

    // تحديث إحصائيات المشرف وتخفيض المقاعد
    await adminDb.collection('supervisors').doc(payload.supervisorId).update({
      totalSessions: FieldValue.increment(1),
      availableSeats: FieldValue.increment(-1),
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

    // إشعار المشرف
    try {
      const supervisorSnap2 = await adminDb.collection('supervisors').doc(payload.supervisorId).get();
      const supervisorEmail = supervisorSnap2.data()?.email;
      if (supervisorEmail) {
        await sendSupervisorBookingNotification({
          studentName: payload.studentName,
          studentEmail: payload.studentEmail,
          supervisorName: supervisor.name,
          supervisorEmail,
          date: payload.date,
          time: payload.time,
          meetLink: '',
          managementToken,
          referenceNumber,
          locale: 'ar',
        });
      }
    } catch (notifErr) {
      console.error('Supervisor notification error (non-fatal):', notifErr);
    }

    return { success: true, bookingId: bookingRef.id, managementToken, referenceNumber };

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

    // تحديث الحجز + إرجاع الموعد + رجوع المقعد دفعة وحدة
    const batch = adminDb.batch();

    // إلغاء الحجز
    batch.update(bookingDoc.ref, { status: 'cancelled' as BookingStatus });

    // إرجاع المقعد للمشرف
    const supervisorRef = adminDb.collection('supervisors').doc(booking.supervisorId);
    batch.update(supervisorRef, { availableSeats: FieldValue.increment(1) });

    // إرجاع الموعد لـ availability (isBooked = false)
    if (booking.availabilitySlotId) {
      const slotRef = adminDb.collection('availability').doc(booking.availabilitySlotId);
      batch.update(slotRef, { isBooked: false, bookingId: null });
    }

    await batch.commit();

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
