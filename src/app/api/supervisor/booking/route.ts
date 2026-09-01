import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';
import { FieldValue } from 'firebase-admin/firestore';

export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bookingId, meetingStatus } = await req.json();
  if (!bookingId || !['pending', 'completed', 'missed'].includes(meetingStatus)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const bookingSnap = await adminDb.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const booking = bookingSnap.data() as any;
  if (booking.supervisorId !== supervisor.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await adminDb.runTransaction(async (transaction) => {
    const ref = adminDb.collection('bookings').doc(bookingId);
    const current = await transaction.get(ref);
    if (!current.exists || current.data()?.supervisorId !== supervisor.id) throw new Error('FORBIDDEN');
    const previousStatus = current.data()?.meetingStatus || 'pending';
    transaction.update(ref, { meetingStatus, meetingStatusUpdatedAt: new Date().toISOString() });
    if (meetingStatus === 'missed' && previousStatus !== 'missed' && (current.data()?.bookingType || 'initial_interview') === 'initial_interview') {
      transaction.update(adminDb.collection('supervisors').doc(supervisor.id), {
        availableSeats: FieldValue.increment(1),
      });
    }
  });

  return NextResponse.json({ success: true });
}
