export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedSupervisor } from '@/lib/auth/serverAuth';

const COLLECTIONS = {
  document: 'supervisionDocuments',
  meeting: 'meetingMinutes',
  assessment: 'competencyAssessments',
} as const;

async function ownsTrainee(supervisorId: string, traineeId: string) {
  const snap = await adminDb.collection('trainees').doc(traineeId).get();
  return snap.exists && snap.data()?.currentSupervisorId === supervisorId;
}

const clean = (value: unknown, max = 4000) => String(value || '').trim().slice(0, max);

export async function GET(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const traineeId = req.nextUrl.searchParams.get('traineeId');
  if (!traineeId || !(await ownsTrainee(supervisor.id, traineeId))) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const [documents, meetings, assessments, plan, activities] = await Promise.all([
    adminDb.collection('supervisionDocuments').where('traineeId', '==', traineeId).limit(100).get(),
    adminDb.collection('meetingMinutes').where('traineeId', '==', traineeId).limit(100).get(),
    adminDb.collection('competencyAssessments').where('traineeId', '==', traineeId).limit(50).get(),
    adminDb.collection('supervisionPlans').doc(traineeId).get(),
    adminDb.collection('fieldworkActivities').where('traineeId', '==', traineeId).limit(1000).get(),
  ]);
  const map = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({
    documents: map(documents).sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt))),
    meetings: map(meetings).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))),
    assessments: map(assessments).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))),
    plan: plan.exists ? { id: plan.id, ...plan.data() } : { traineeId, goals: [] },
    activities: map(activities),
  });
}

export async function POST(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const traineeId = clean(body.traineeId, 100);
  if (!traineeId || !(await ownsTrainee(supervisor.id, traineeId))) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const now = new Date().toISOString();

  if (body.entity === 'document') {
    if (!clean(body.type, 50) || !clean(body.title, 200) || !clean(body.issuedAt, 10)) return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 });
    const ref = adminDb.collection(COLLECTIONS.document).doc();
    await ref.set({ traineeId, supervisorId: supervisor.id, type: clean(body.type,50), title: clean(body.title,200), centerName: clean(body.centerName,200), clientCode: clean(body.clientCode,80), issuedAt: clean(body.issuedAt,10), expiresAt: clean(body.expiresAt,10) || null, status: 'valid', fileName: clean(body.fileName,250), fileUrl: clean(body.fileUrl,2000), notes: clean(body.notes), createdAt: now, createdBy: supervisor.id });
    return NextResponse.json({ success: true, id: ref.id });
  }

  if (body.entity === 'meeting') {
    if (!clean(body.date,10) || !clean(body.startTime,5) || !clean(body.endTime,5) || !clean(body.agenda)) return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 });
    const ref = adminDb.collection(COLLECTIONS.meeting).doc();
    await ref.set({ traineeId, supervisorId: supervisor.id, date: clean(body.date,10), startTime: clean(body.startTime,5), endTime: clean(body.endTime,5), format: body.format === 'group' ? 'group' : 'individual', setting: body.setting === 'in_person' ? 'in_person' : 'video', observedWithClient: Boolean(body.observedWithClient), agenda: clean(body.agenda), discussion: clean(body.discussion,10000), decisions: clean(body.decisions,10000), actionItems: clean(body.actionItems,10000), competencyIds: Array.isArray(body.competencyIds) ? body.competencyIds.slice(0,50).map((x:unknown)=>clean(x,100)) : [], planGoalIds: Array.isArray(body.planGoalIds) ? body.planGoalIds.slice(0,50).map((x:unknown)=>clean(x,100)) : [], acknowledgedByTrainee: false, createdAt: now, updatedAt: now, createdBy: supervisor.id });
    return NextResponse.json({ success: true, id: ref.id });
  }

  if (body.entity === 'assessment') {
    const scores = Array.isArray(body.scores) ? body.scores.filter((s:any) => clean(s.competencyId,100) && Number(s.score) >= 1 && Number(s.score) <= 5).map((s:any)=>({ competencyId:clean(s.competencyId,100), score:Number(s.score), observationMethod:['live','role_play','discussion','work_product'].includes(s.observationMethod)?s.observationMethod:'discussion', note:clean(s.note,1000) })) : [];
    if (!clean(body.date,10) || !scores.length) return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 });
    const ref = adminDb.collection(COLLECTIONS.assessment).doc();
    await ref.set({ traineeId, supervisorId: supervisor.id, date: clean(body.date,10), period: body.period === 'initial' ? 'initial' : 'quarterly', scores, strengths: clean(body.strengths), developmentPriorities: clean(body.developmentPriorities), recommendation: clean(body.recommendation), totalScore: scores.reduce((n:number,s:any)=>n+s.score,0), maxScore: scores.length*5, createdAt: now, createdBy: supervisor.id });
    return NextResponse.json({ success: true, id: ref.id });
  }
  return NextResponse.json({ error: 'INVALID_ENTITY' }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const traineeId = clean(body.traineeId,100);
  if (!traineeId || !(await ownsTrainee(supervisor.id, traineeId)) || body.entity !== 'plan') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const goals = Array.isArray(body.goals) ? body.goals.slice(0,100).map((g:any,index:number)=>({ id:clean(g.id,100)||`goal-${Date.now()}-${index}`, domain:clean(g.domain,150), title:clean(g.title,1000), startDate:clean(g.startDate,10)||null, dueDate:clean(g.dueDate,10)||null, masteryCriterion:clean(g.masteryCriterion,1000), status:['not_started','in_progress','achieved','retrain'].includes(g.status)?g.status:'not_started', supervisorNote:clean(g.supervisorNote,2000), order:index })) : [];
  await adminDb.collection('supervisionPlans').doc(traineeId).set({ traineeId, supervisorId:supervisor.id, goals, versionUpdatedAt:new Date().toISOString(), updatedBy:supervisor.id }, { merge:true });
  return NextResponse.json({ success:true });
}
