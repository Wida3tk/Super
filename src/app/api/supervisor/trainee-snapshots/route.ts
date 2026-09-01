import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';

export async function GET(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const traineeId = searchParams.get('traineeId');
  if (!traineeId) return NextResponse.json({ error: 'Missing traineeId' }, { status: 400 });

  const snap = await adminDb.collection('monthlySnapshots')
    .where('supervisorId', '==', supervisor.id)
    .where('traineeId', '==', traineeId)
    .orderBy('month', 'desc')
    .get();

  const snapshots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ snapshots });
}
