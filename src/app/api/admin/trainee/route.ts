import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activityLog';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return false;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
  } catch { return false; }
}

// إضافة متدرب جديد
export async function POST(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, phone, license } = await req.json();
  if (!name || !email || !phone || !license) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const requiredHours = license === 'QASP-S' ? 50 : 100;
  const ref = await adminDb.collection('trainees').add({
    name, email, phone, license,
    requiredHours,
    status: 'onboarding',
    onboardingStage: 'initial_interview',
    currentSupervisorId: null,
    totalIndividualHours: 0,
    totalGroupHours: 0,
    totalHours: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await logActivity({
    type: 'trainee_added',
    message: `أُضيف متدرب جديد: ${name}`,
    traineeId: ref.id,
    meta: { license },
  });

  return NextResponse.json({ id: ref.id });
}

// تحديث حالة متدرب أو مرحلة البوردنق
export async function PATCH(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { traineeId, action, ...data } = body;

  if (!traineeId) return NextResponse.json({ error: 'Missing traineeId' }, { status: 400 });

  const ref = adminDb.collection('trainees').doc(traineeId);

  if (action === 'updateStatus') {
    await ref.update({ status: data.status, updatedAt: new Date().toISOString() });
  } else if (action === 'updateOnboarding') {
    await ref.update({ onboardingStage: data.stage, updatedAt: new Date().toISOString() });
  } else if (action === 'assign') {
    const batch = adminDb.batch();
    batch.update(ref, {
      currentSupervisorId: data.supervisorId,
      status: 'active',
      onboardingStage: null,
      updatedAt: new Date().toISOString(),
    });
    const assignRef = adminDb.collection('assignments').doc();
    batch.set(assignRef, {
      traineeId,
      supervisorId: data.supervisorId,
      startDate: data.startDate,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      createdBy: 'admin',
    });
    await batch.commit();
  }

  return NextResponse.json({ success: true });
}

// قفل / فتح شهر
export async function PUT(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { supervisorId, traineeId, month, action } = await req.json();
  const snapshotId = `${supervisorId}_${traineeId}_${month}`;
  const ref = adminDb.collection('monthlySnapshots').doc(snapshotId);

  if (action === 'lock') {
    await ref.update({ lockedAt: new Date().toISOString(), lockedBy: 'admin', updatedAt: new Date().toISOString() });
  } else if (action === 'unlock') {
    await ref.update({ lockedAt: null, lockedBy: null, updatedAt: new Date().toISOString() });
  }

  return NextResponse.json({ success: true });
}
