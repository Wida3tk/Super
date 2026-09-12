// src/app/api/admin/supervisor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/auth/serverAuth';

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { supervisorId, isActive } = await request.json();

  if (!supervisorId || typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const ref = adminDb.collection('supervisors').doc(supervisorId);
  const supervisor = await ref.get();
  if (!supervisor.exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const email = String(supervisor.data()?.email || '').trim().toLowerCase();
  if (!isActive && email === process.env.ADMIN_EMAIL?.trim().toLowerCase())
    return NextResponse.json({ error: 'ADMIN_PROTECTED' }, { status: 409 });
  let authUid = String(supervisor.data()?.authUid || supervisorId);
  try {
    const authUser = email ? await adminAuth.getUserByEmail(email) : await adminAuth.getUser(authUid);
    authUid = authUser.uid;
    await adminAuth.updateUser(authUid, { disabled: !isActive });
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }
  await ref.update({ isActive, authUid, updatedAt: new Date().toISOString() });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supervisorId, confirmation } = await request.json();
  if (!supervisorId || confirmation !== 'DELETE_SUPERVISOR')
    return NextResponse.json({ error: 'INVALID_CONFIRMATION' }, { status: 400 });
  const ref = adminDb.collection('supervisors').doc(String(supervisorId));
  const supervisor = await ref.get();
  if (!supervisor.exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const data = supervisor.data() || {};
  const email = String(data.email || '').trim().toLowerCase();
  if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase())
    return NextResponse.json({ error: 'ADMIN_PROTECTED' }, { status: 409 });

  const today = new Date().toISOString().slice(0, 10);
  const [trainees, bookings, availability] = await Promise.all([
    adminDb.collection('trainees').where('currentSupervisorId', '==', supervisorId).limit(1).get(),
    adminDb.collection('bookings').where('supervisorId', '==', supervisorId).get(),
    adminDb.collection('availability').where('supervisorId', '==', supervisorId).get(),
  ]);
  if (!trainees.empty)
    return NextResponse.json({ error: 'HAS_ASSIGNED_TRAINEES' }, { status: 409 });
  const hasUpcomingBooking = bookings.docs.some((doc) => {
    const booking = doc.data();
    return booking.status === 'confirmed' && String(booking.date || '') >= today;
  });
  if (hasUpcomingBooking)
    return NextResponse.json({ error: 'HAS_UPCOMING_BOOKINGS' }, { status: 409 });

  for (let index = 0; index < availability.docs.length; index += 400) {
    const batch = adminDb.batch();
    availability.docs.slice(index, index + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await ref.delete();

  try {
    const user = email
      ? await adminAuth.getUserByEmail(email)
      : await adminAuth.getUser(String(data.authUid || supervisorId));
    await adminAuth.deleteUser(user.uid);
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }
  return NextResponse.json({ success: true });
}
