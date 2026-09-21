import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';
import { getInterviewSeatDelta } from '@/lib/validation/booking';

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

  try {
    await adminDb.runTransaction(async (transaction) => {
      const ref = adminDb.collection('bookings').doc(bookingId);
      const supervisorRef = adminDb.collection('supervisors').doc(supervisor.id);
      const [current, supervisorSnapshot] = await Promise.all([
        transaction.get(ref),
        transaction.get(supervisorRef),
      ]);
      if (!current.exists) throw new Error('NOT_FOUND');
      if (current.data()?.supervisorId !== supervisor.id) throw new Error('FORBIDDEN');

      const previousStatus = current.data()?.meetingStatus || 'pending';
      const seatDelta = getInterviewSeatDelta(
        previousStatus,
        meetingStatus,
        current.data()?.bookingType || 'initial_interview',
      );
      transaction.update(ref, {
        meetingStatus,
        meetingStatusUpdatedAt: new Date().toISOString(),
      });
      if (seatDelta !== 0 && supervisorSnapshot.exists) {
        const availableSeats = Number(
          supervisorSnapshot.data()?.availableSeats || 0,
        );
        transaction.update(supervisorRef, {
          availableSeats: Math.max(0, availableSeats + seatDelta),
        });
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'NOT_FOUND')
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (code === 'FORBIDDEN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw error;
  }

  return NextResponse.json({ success: true });
}
