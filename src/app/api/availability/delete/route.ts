import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { adminDb, adminAuth } = await import('@/lib/firebase/admin');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await adminAuth.verifySessionCookie(sessionCookie, true);

    const { slotId } = await request.json();
    if (!slotId) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });

    const slot = await adminDb.collection('availability').doc(slotId).get();
    if (!slot.exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (slot.data()?.isBooked) return NextResponse.json({ error: 'SLOT_BOOKED' }, { status: 400 });

    await adminDb.collection('availability').doc(slotId).delete();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
