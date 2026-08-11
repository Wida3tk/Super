import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedTrainee } from '@/lib/auth/serverAuth';
import TraineeFieldworkDashboard from '@/components/trainee/TraineeFieldworkDashboard';
import type { FieldworkActivity } from '@/types';

export default async function TraineeDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const trainee = await getAuthenticatedTrainee();
  if (!trainee) redirect(`/${locale}/login`);
  const [activitySnap, supervisorSnap, planSnap, assessmentsSnap, documentsSnap, meetingsSnap] = await Promise.all([
    adminDb.collection('fieldworkActivities').where('traineeId', '==', trainee.id).limit(300).get(),
    trainee.currentSupervisorId ? adminDb.collection('supervisors').doc(trainee.currentSupervisorId).get() : Promise.resolve(null),
    adminDb.collection('supervisionPlans').doc(trainee.id).get(),
    adminDb.collection('competencyAssessments').where('traineeId', '==', trainee.id).limit(20).get(),
    adminDb.collection('supervisionDocuments').where('traineeId', '==', trainee.id).limit(100).get(),
    adminDb.collection('meetingMinutes').where('traineeId', '==', trainee.id).limit(100).get(),
  ]);
  const activities = (activitySnap.docs.map(d => ({ id: d.id, ...d.data() })) as FieldworkActivity[]).sort((a,b) => b.date.localeCompare(a.date));
  const supervisorName = supervisorSnap?.exists ? String(supervisorSnap.data()?.name || '') : '';
  const supervisionFile = {
    plan: planSnap.exists ? { id: planSnap.id, ...planSnap.data() } : { goals: [] },
    assessments: assessmentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))),
    documents: documentsSnap.docs.map(d => { const x=d.data(); return { id:d.id, type:x.type, title:x.title, issuedAt:x.issuedAt, expiresAt:x.expiresAt, status:x.status }; }),
    meetings: meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))),
  };
  return <TraineeFieldworkDashboard trainee={trainee} supervisorName={supervisorName} initialActivities={activities} supervisionFile={supervisionFile}/>;
}
