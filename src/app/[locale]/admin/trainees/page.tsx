import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import TraineeManagementWorkspace from '@/components/admin/TraineeManagementWorkspace';
import { readDirectoryTransitions } from '@/lib/lifecycle/readTransitions';
import { withContractDates } from "@/lib/qaba/contractDates";
import { buildRoster, monthStart } from '@/lib/admin/supervisorRoster';

interface Props { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string; supervisor?: string; scope?: string }>; }

export default async function TraineesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { view, supervisor, scope } = await searchParams;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login?portal=admin`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login?portal=admin`);
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    // About three months of rows: last-logged dates and pace for each trainee.
    const windowStart = monthStart(currentMonth, 2);
    const [supervisorsSnap, traineesSnap, rowsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('fieldworkActivities').where('date', '>=', windowStart)
        .select('traineeId', 'supervisorId', 'date', 'duration', 'status', 'sessionId', 'priorCreditId', 'activityType').get(),
    ]);
    const supervisors = supervisorsSnap.docs.filter(d => !d.data().isDemo).map(d => ({ id: d.id, ...d.data() }));
    const trainees = await withContractDates(traineesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(t => !t.isDemo));
    const transitions = await readDirectoryTransitions(trainees, currentMonth);
    const { standings } = buildRoster({
      supervisors: supervisors as any[], trainees, rows: rowsSnap.docs.map(d => d.data() as any), sessions: [],
      today, windowStart, currentMonth, previousMonth: monthStart(currentMonth, 1).slice(0, 7),
    });
    return (
      <AdminPageLayout locale={locale} title="المتدربون">
        <TraineeManagementWorkspace locale={locale} initialView={view === 'add' ? 'add' : view === 'import' ? 'import' : 'manage'} supervisors={supervisors} trainees={trainees} transitions={transitions} initialSupervisor={supervisor || null} initialScope={scope === 'graduates' || scope === 'onboarding' || scope === 'all' ? scope : 'serving'} standings={JSON.parse(JSON.stringify(standings))} />
      </AdminPageLayout>
    );
  } catch (error) {
    if (String((error as { code?: string }).code || '').startsWith('auth/')) redirect(`/${locale}/login?portal=admin`);
    throw error;
  }
}
