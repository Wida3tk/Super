import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

async function getAuthenticatedSupervisor() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const email = decoded.email?.toLowerCase() || '';
    const allSnap = await adminDb.collection('supervisors').get();
    const match = allSnap.docs.find(d => (d.data().email || '').toLowerCase() === email);
    if (!match) return null;
    return { id: match.id, ...match.data() } as any;
  } catch { return null; }
}

export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bookingId, meetingStatus } = await req.json();
  if (!bookingId || !meetingStatus) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const bookingSnap = await adminDb.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const booking = bookingSnap.data() as any;
  if (booking.supervisorId !== supervisor.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await adminDb.collection('bookings').doc(bookingId).update({
    meetingStatus,
    meetingStatusUpdatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
