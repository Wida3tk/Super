import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supervisorId = searchParams.get('supervisorId');
  const date = searchParams.get('date');

  if (!supervisorId || !date) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const snap = await adminDb.collection('availability').get();

    const slots = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((s: any) => 
        s.supervisorId === supervisorId && 
        s.date === date && 
        s.isBooked === false
      );

    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Availability error:', error);
    return NextResponse.json({ slots: [], error: String(error) });
  }
}
