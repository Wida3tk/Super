import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const supervisor = await getAuthenticatedSupervisor();
    if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { slotId } = await request.json();
    if (typeof slotId !== 'string' || !slotId.trim()) {
      return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });
    }

    const slot = await adminDb.collection('availability').doc(slotId).get();
    if (!slot.exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (slot.data()?.supervisorId !== supervisor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (slot.data()?.isBooked) return NextResponse.json({ error: 'SLOT_BOOKED' }, { status: 400 });

    await slot.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete availability error:', error);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
