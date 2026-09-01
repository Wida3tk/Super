import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import AdminSupervisionPanel from '@/components/admin/AdminSupervisionPanel';

interface Props { params: Promise<{ locale: string }>; }

export default async function MonthsPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [supervisorsSnap, traineesSnap, approvalsSnap, activitiesSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('monthlyApprovals').where('month', '==', currentMonth).get(),
      adminDb.collection('fieldworkActivities').where('month', '==', currentMonth).get(),
    ]);
    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const approvals = new Map(approvalsSnap.docs.map(document => [document.data().traineeId, { id: document.id, ...document.data() }]));
    const approvedByTrainee = new Map<string, any[]>();
    activitiesSnap.docs.forEach(document => {
      const activity = document.data() as any;
      if (activity.status !== 'approved') return;
      approvedByTrainee.set(activity.traineeId, [...(approvedByTrainee.get(activity.traineeId) || []), activity]);
    });
    const snapshots = trainees
      .filter((trainee: any) => trainee.status === 'active' || approvals.has(trainee.id))
      .map((trainee: any) => {
      const approval: any = approvals.get(trainee.id) || {};
      const activities = approvedByTrainee.get(trainee.id) || [];
      const fieldwork = activities.filter(item => item.activityType === 'direct' || item.activityType === 'indirect').reduce((sum, item) => sum + Number(item.duration || 0), 0);
      const supervisionRows = activities.filter(item => String(item.activityType || '').startsWith('supervision_'));
      const supervision = supervisionRows.reduce((sum, item) => sum + Number(item.duration || 0), 0);
      const group = supervisionRows.filter(item => item.format === 'group').reduce((sum, item) => sum + Number(item.duration || 0), 0);
      return {
        id: approval.id || `${trainee.id}_${currentMonth}`,
        ...approval,
        traineeId: trainee.id,
        supervisorId: approval.supervisorId || trainee.currentSupervisorId || '',
        month: currentMonth,
        individualHours: supervision - group,
        groupHours: group,
        totalHours: supervision,
        workHours: fieldwork,
        requiredHours: fieldwork * 0.05,
        groupPercentage: supervision ? Math.round((group / supervision) * 1000) / 10 : 0,
        lockedAt: approval.lockedAt || (approval.locked ? approval.traineeAcknowledgedAt || approval.adminApprovedAt : null),
      };
    });
    return (
      <AdminPageLayout locale={locale} title="إدارة الأشهر">
        <AdminSupervisionPanel supervisors={supervisors} initialTrainees={trainees} initialSnapshots={snapshots} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
