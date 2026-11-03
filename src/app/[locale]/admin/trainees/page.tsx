import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import TraineeManagementWorkspace from '@/components/admin/TraineeManagementWorkspace';
import { readDirectoryTransitions } from '@/lib/lifecycle/readTransitions';
import { withContractDates } from "@/lib/qaba/contractDates";
import { buildRoster, monthStart } from '@/lib/admin/supervisorRoster';

interface Props { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string; supervisor?: string }>; }

export default async function TraineesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { view, supervisor } = await searchParams;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login?portal=admin`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login?portal=admin`);
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const previousMonth = monthStart(currentMonth, 1).slice(0, 7);
    // About three months of rows: enough for last-logged dates, pace and both payroll months.
    const windowStart = monthStart(currentMonth, 2);
    const [supervisorsSnap, traineesSnap, rowsSnap, sessionsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('fieldworkActivities').where('date', '>=', windowStart)
        .select('traineeId', 'supervisorId', 'date', 'month', 'duration', 'format', 'status', 'sessionId', 'priorCreditId', 'activityType', 'traineeAcknowledgment').get(),
      adminDb.collection('sessions').where('month', 'in', [currentMonth, previousMonth])
        .select('supervisorId', 'type', 'duration', 'month', 'traineeIds').get(),
    ]);
    const supervisors = supervisorsSnap.docs.filter(d => !d.data().isDemo).map(d => ({ id: d.id, ...d.data() }));
    const trainees = await withContractDates(traineesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(t => !t.isDemo));
    const transitions = await readDirectoryTransitions(trainees, currentMonth);
    const roster = buildRoster({
      supervisors: supervisors as any[],
      trainees,
      rows: rowsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)),
      sessions: sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)),
      today, windowStart, currentMonth, previousMonth,
    });
    return (
      <AdminPageLayout locale={locale} title="المتدربون">
        <TraineeManagementWorkspace locale={locale} initialView={view === 'add' ? 'add' : view === 'import' ? 'import' : 'manage'} supervisors={supervisors} trainees={trainees} transitions={transitions} roster={roster} months={{ current: currentMonth, previous: previousMonth }} initialSupervisor={supervisor || null} />
      </AdminPageLayout>
    );
  } catch (error) {
    if (String((error as { code?: string }).code || '').startsWith('auth/')) redirect(`/${locale}/login?portal=admin`);
    throw error;
  }
}
