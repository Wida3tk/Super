import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activityLog';
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

export async function POST(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { traineeIds, type, date, duration, absenceReason, warningReason, notes } = await req.json();

  if (!traineeIds || !type || !date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const month = date.slice(0, 7);
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (month !== currentMonth) {
    return NextResponse.json({ error: 'لا يمكن تسجيل جلسة لشهر مختلف عن الشهر الحالي' }, { status: 400 });
  }

  if (type === 'group' && traineeIds.length < 2) {
    return NextResponse.json({ error: 'الجلسة الجماعية تتطلب متدربَين على الأقل' }, { status: 400 });
  }

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  // إضافة الجلسة
  const sessionRef = adminDb.collection('sessions').doc();
  batch.set(sessionRef, {
    supervisorId: supervisor.id,
    traineeIds,
    type,
    date,
    month,
    duration: duration || null,
    absenceReason: absenceReason || null,
    warningReason: warningReason || null,
    notes: notes || '',
    createdAt: now,
    createdBy: supervisor.id,
  });

  // تحديث snapshots والإجماليات
  if (type === 'individual' || type === 'group') {
    const dur = duration || 1;

    for (const traineeId of traineeIds) {
      const snapshotId = `${supervisor.id}_${traineeId}_${month}`;
      const snapshotRef = adminDb.collection('monthlySnapshots').doc(snapshotId);
      const snapshotSnap = await snapshotRef.get();

      if (snapshotSnap.exists) {
        const current = snapshotSnap.data() as any;
        const newInd = type === 'individual' ? (current.individualHours || 0) + dur : (current.individualHours || 0);
        const newGrp = type === 'group' ? (current.groupHours || 0) + dur : (current.groupHours || 0);
        const newTotal = newInd + newGrp;
        batch.update(snapshotRef, {
          individualHours: newInd,
          groupHours: newGrp,
          totalHours: newTotal,
          groupPercentage: newTotal > 0 ? Math.round((newGrp / newTotal) * 1000) / 10 : 0,
          updatedAt: now,
        });
      } else {
        const newInd = type === 'individual' ? dur : 0;
        const newGrp = type === 'group' ? dur : 0;
        const newTotal = newInd + newGrp;
        batch.set(snapshotRef, {
          supervisorId: supervisor.id,
          traineeId,
          month,
          workHours: 0,
          requiredHours: 0,
          individualHours: newInd,
          groupHours: newGrp,
          totalHours: newTotal,
          groupPercentage: newTotal > 0 ? Math.round((newGrp / newTotal) * 1000) / 10 : 0,
          absenceCount: 0,
          warningCount: 0,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        });
      }

      // تحديث إجمالي المتدرب
      const traineeRef = adminDb.collection('trainees').doc(traineeId);
      const traineeSnap = await traineeRef.get();
      if (traineeSnap.exists) {
        const t = traineeSnap.data() as any;
        const newIndTotal = type === 'individual' ? (t.totalIndividualHours || 0) + dur : (t.totalIndividualHours || 0);
        const newGrpTotal = type === 'group' ? (t.totalGroupHours || 0) + dur : (t.totalGroupHours || 0);
        batch.update(traineeRef, {
          totalIndividualHours: newIndTotal,
          totalGroupHours: newGrpTotal,
          totalHours: newIndTotal + newGrpTotal,
          updatedAt: now,
        });
      }
    }
  }

  // تحديث عداد الغياب/الإنذار
  if (type === 'absence' || type === 'warning') {
    const traineeId = traineeIds[0];
    const snapshotId = `${supervisor.id}_${traineeId}_${month}`;
    const snapshotRef = adminDb.collection('monthlySnapshots').doc(snapshotId);
    const snapshotSnap = await snapshotRef.get();
    const field = type === 'absence' ? 'absenceCount' : 'warningCount';

    if (snapshotSnap.exists) {
      const current = snapshotSnap.data() as any;
      batch.update(snapshotRef, { [field]: (current[field] || 0) + 1, updatedAt: now });
    } else {
      batch.set(snapshotRef, {
        supervisorId: supervisor.id, traineeId, month,
        workHours: 0, requiredHours: 0, individualHours: 0,
        groupHours: 0, totalHours: 0, groupPercentage: 0,
        absenceCount: type === 'absence' ? 1 : 0,
        warningCount: type === 'warning' ? 1 : 0,
        lockedAt: null, lockedBy: null, updatedAt: now,
      });
    }
  }

  await batch.commit();

  // تسجيل النشاط
  const sessionTypeLabel = type === 'individual' ? 'فردية' : type === 'group' ? 'جماعية' : type === 'absence' ? 'غياب' : 'إنذار';
  await logActivity({
    type: 'session',
    message: `سجّل ${supervisor.name} جلسة ${sessionTypeLabel}`,
    actorId: supervisor.id,
    actorName: supervisor.name,
    supervisorId: supervisor.id,
    traineeId: traineeIds[0],
    meta: { sessionType: type, duration, date },
  });

  return NextResponse.json({ success: true, sessionId: sessionRef.id });
}

// تحديث ساعات العمل الشهرية
export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { traineeId, month, workHours } = await req.json();
  const snapshotId = `${supervisor.id}_${traineeId}_${month}`;
  const requiredHours = Math.round(workHours * 0.05 * 10) / 10;

  await adminDb.collection('monthlySnapshots').doc(snapshotId).update({
    workHours,
    requiredHours,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
