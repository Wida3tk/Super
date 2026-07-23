import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const supervisor = await getAuthenticatedSupervisor();
    if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { seats } = await request.json();
    const parsedSeats = typeof seats === 'number' ? seats : Number(seats);
    if (!Number.isInteger(parsedSeats) || parsedSeats < 0 || parsedSeats > 10000) {
      return NextResponse.json({ error: 'INVALID_SEATS' }, { status: 400 });
    }

    await adminDb.collection('supervisors').doc(supervisor.id).update({
      availableSeats: parsedSeats,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update seats error:', error);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
