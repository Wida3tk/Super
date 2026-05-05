import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supervisorId = searchParams.get('supervisorId');
  if (!supervisorId) return NextResponse.json({ slots: [] });

  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const today = new Date().toISOString().split('T')[0];

    const snap = await adminDb.collection('availability')
      .where('supervisorId', '==', supervisorId)
      .where('date', '>=', today)
      .orderBy('date', 'asc')
      .get();

    const slots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json({ slots: [], error: 'Failed' }, { status: 500 });
  }
}
