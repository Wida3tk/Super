import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { getAuthenticatedTrainee } from '@/lib/auth/serverAuth';
import TraineeFieldworkDashboard from '@/components/trainee/TraineeFieldworkDashboard';
import type { FieldworkActivity } from '@/types';

export default async function TraineeDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const trainee = await getAuthenticatedTrainee();
  if (!trainee) redirect(`/${locale}/login`);
  const [activitySnap, supervisorSnap] = await Promise.all([
    adminDb.collection('fieldworkActivities').where('traineeId', '==', trainee.id).limit(300).get(),
    trainee.currentSupervisorId ? adminDb.collection('supervisors').doc(trainee.currentSupervisorId).get() : Promise.resolve(null),
  ]);
  const activities = (activitySnap.docs.map(d => ({ id: d.id, ...d.data() })) as FieldworkActivity[]).sort((a,b) => b.date.localeCompare(a.date));
  const supervisorName = supervisorSnap?.exists ? String(supervisorSnap.data()?.name || '') : '';
  return <TraineeFieldworkDashboard trainee={trainee} supervisorName={supervisorName} initialActivities={activities}/>;
}
