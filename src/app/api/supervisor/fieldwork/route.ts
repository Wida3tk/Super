export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';

export async function GET() {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const snap = await adminDb.collection('fieldworkActivities')
    .where('supervisorId', '==', supervisor.id).limit(300).get();
  return NextResponse.json({ activities: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).filter(a => a.status === 'submitted') });
}

export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, action, note } = await req.json();
  const statuses: Record<string, string> = { approve: 'approved', revision: 'revision_requested', reject: 'rejected' };
  if (!id || !statuses[action]) return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
  const ref = adminDb.collection('fieldworkActivities').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.supervisorId !== supervisor.id || snap.data()?.status !== 'submitted') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const lockSnap=await adminDb.collection('monthlyApprovals').doc(`${snap.data()?.traineeId}_${snap.data()?.month}`).get();
  if(lockSnap.exists&&lockSnap.data()?.locked)return NextResponse.json({error:'MONTH_LOCKED'},{status:409});
  await ref.update({
    status: statuses[action], reviewerNote: String(note || '').trim().slice(0, 1000),
    reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), reviewedBy: supervisor.id,
  });
  return NextResponse.json({ success: true });
}
