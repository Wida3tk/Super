export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedTrainee } from '@/lib/auth/serverAuth';
import type { FieldworkActivityType } from '@/types';

const TYPES = new Set<FieldworkActivityType>(['direct', 'indirect', 'supervision_direct', 'supervision_indirect']);

function durationBetween(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return Math.round((((eh * 60 + em) - (sh * 60 + sm)) / 60) * 100) / 100;
}

export async function GET() {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const snap = await adminDb.collection('fieldworkActivities')
    .where('traineeId', '==', trainee.id).limit(300).get();
  const activities = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee || !trainee.currentSupervisorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { date, startTime, endTime, activityType, setting, format, observedWithClient, description, saveAsDraft } = body;
  if (!date || !startTime || !endTime || !TYPES.has(activityType) || typeof description !== 'string') {
    return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 });
  }
  const duration = durationBetween(startTime, endTime);
  if (duration <= 0 || duration > 16) return NextResponse.json({ error: 'INVALID_DURATION' }, { status: 400 });
  const isSupervision = activityType.startsWith('supervision_');
  if (isSupervision && (!['in_person', 'video'].includes(setting) || !['individual', 'group'].includes(format))) {
    return NextResponse.json({ error: 'SUPERVISION_DETAILS_REQUIRED' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const ref = adminDb.collection('fieldworkActivities').doc();
  await ref.set({
    traineeId: trainee.id,
    supervisorId: trainee.currentSupervisorId,
    date, month: date.slice(0, 7), startTime, endTime, duration, activityType,
    setting: isSupervision ? setting : null,
    format: isSupervision ? format : null,
    observedWithClient: isSupervision ? Boolean(observedWithClient) : false,
    description: description.trim().slice(0, 2000),
    status: saveAsDraft ? 'draft' : 'submitted',
    createdAt: now, updatedAt: now,
  });
  return NextResponse.json({ success: true, id: ref.id });
}

export async function PATCH(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, action } = await req.json();
  if (!id || action !== 'submit') return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
  const ref = adminDb.collection('fieldworkActivities').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.traineeId !== trainee.id || !['draft', 'revision_requested'].includes(snap.data()?.status)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  await ref.update({ status: 'submitted', reviewerNote: null, updatedAt: new Date().toISOString() });
  return NextResponse.json({ success: true });
}
