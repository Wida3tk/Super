import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const supervisor = await getAuthenticatedSupervisor();
    if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    const snap = await adminDb.collection('availability')
      .where('supervisorId', '==', supervisor.id)
      .where('date', '>=', today)
      .orderBy('date', 'asc')
      .get();

    const slots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json({ slots: [], error: 'Failed' }, { status: 500 });
  }
}
