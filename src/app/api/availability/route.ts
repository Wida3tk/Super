// src/app/api/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supervisorId = searchParams.get('supervisorId');
  const date = searchParams.get('date');

  if (!supervisorId || !date) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const snap = await adminDb
    .collection('availability')
    .where('supervisorId', '==', supervisorId)
    .where('date', '==', date)
    .where('isBooked', '==', false)
    .orderBy('time', 'asc')
    .get();

  const slots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ slots });
}
