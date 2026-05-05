import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supervisorId = searchParams.get('supervisorId');
  const date = searchParams.get('date');

  if (!supervisorId || !date) {
    return NextResponse.json({ slots: [] });
  }

  try {
    const { adminDb } = await import('@/lib/firebase/admin');

    const snap = await adminDb
      .collection('availability')
      .where('supervisorId', '==', supervisorId)
      .where('date', '==', date)
      .where('isBooked', '==', false)
      .orderBy('time', 'asc')
      .get();

    const slots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Availability API error:', error);
    return NextResponse.json({ slots: [], error: 'Failed to fetch slots' }, { status: 500 });
  }
}
