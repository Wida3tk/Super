import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { adminDb, adminAuth } = await import('@/lib/firebase/admin');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await adminAuth.verifySessionCookie(sessionCookie, true);

    const { supervisorId, seats } = await request.json();
    if (!supervisorId || seats === undefined) return NextResponse.json({ error: 'MISSING' }, { status: 400 });

    await adminDb.collection('supervisors').doc(supervisorId).update({
      availableSeats: Math.max(0, parseInt(seats)),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
