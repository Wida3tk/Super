import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

async function getAuthenticatedSupervisor() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const email = decoded.email?.toLowerCase() || '';
    const allSnap = await adminDb.collection('supervisors').get();
    const match = allSnap.docs.find(d => (d.data().email || '').toLowerCase() === email);
    if (!match) return null;
    return { id: match.id, ...match.data() } as any;
  } catch { return null; }
}

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
