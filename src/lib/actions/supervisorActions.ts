// src/lib/actions/supervisorActions.ts
'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';
import { AvailabilitySlot } from '@/types';

/**
 * توليد شرائح زمنية تلقائية بفترات 30 دقيقة
 */
function generateSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + 30 <= endMinutes) {
    const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
    const m = (currentMinutes % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMinutes += 30;
  }

  return slots;
}

/**
 * إضافة أوقات متاحة للمشرف
 */
export async function addAvailability(
  supervisorId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ success: boolean; slotsCreated: number; error?: string }> {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) {
    return { success: false, slotsCreated: 0, error: 'UNAUTHORIZED' };
  }
  if (supervisor.id !== supervisorId) {
    return { success: false, slotsCreated: 0, error: 'FORBIDDEN' };
  }

  // التحقق من التاريخ
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) {
    return { success: false, slotsCreated: 0, error: 'DATE_IN_PAST' };
  }

  const slots = generateSlots(startTime, endTime);
  if (slots.length === 0) {
    return { success: false, slotsCreated: 0, error: 'INVALID_TIME_RANGE' };
  }

  const batch = adminDb.batch();
  let count = 0;

  for (const time of slots) {
    // التحقق من عدم وجود شريحة مكررة
    const existing = await adminDb
      .collection('availability')
      .where('supervisorId', '==', supervisorId)
      .where('date', '==', date)
      .where('time', '==', time)
      .get();

    if (existing.empty) {
      const slotRef = adminDb.collection('availability').doc();
      const slotData: Omit<AvailabilitySlot, 'id'> = {
        supervisorId,
        date,
        time,
        isBooked: false,
      };
      batch.set(slotRef, slotData);
      count++;
    }
  }

  await batch.commit();
  return { success: true, slotsCreated: count };
}

/**
 * جلب الشرائح المتاحة لمشرف في تاريخ معين
 */
export async function getAvailableSlots(supervisorId: string, date: string) {
  const snap = await adminDb
    .collection('availability')
    .where('supervisorId', '==', supervisorId)
    .where('date', '==', date)
    .where('isBooked', '==', false)
    .orderBy('time', 'asc')
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AvailabilitySlot));
}

/**
 * جلب الجلسات القادمة للمشرف
 */
export async function getSupervisorUpcomingBookings(supervisorId: string) {
  const today = new Date().toISOString().split('T')[0];

  const snap = await adminDb
    .collection('bookings')
    .where('supervisorId', '==', supervisorId)
    .where('status', '==', 'confirmed')
    .where('date', '>=', today)
    .orderBy('date', 'asc')
    .orderBy('time', 'asc')
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * جلب جميع المشرفين النشطين
 */
export async function getActiveSupervisors() {
  const snap = await adminDb
    .collection('supervisors')
    .where('isActive', '==', true)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * حذف موعد متاح
 */
export async function deleteAvailability(slotId: string): Promise<{ success: boolean }> {
  try {
    const supervisor = await getAuthenticatedSupervisor();
    if (!supervisor) return { success: false };

    const slot = await adminDb.collection('availability').doc(slotId).get();
    if (!slot.exists || slot.data()?.supervisorId !== supervisor.id || slot.data()?.isBooked) {
      return { success: false };
    }

    await slot.ref.delete();
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * جلب جميع المواعيد المتاحة لمشرف (للإدارة)
 */
export async function getSupervisorAllSlots(supervisorId: string) {
  const today = new Date().toISOString().split('T')[0];
  const snap = await adminDb
    .collection('availability')
    .where('supervisorId', '==', supervisorId)
    .where('date', '>=', today)
    .orderBy('date', 'asc')
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
