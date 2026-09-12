import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import TraineeManagementWorkspace from '@/components/admin/TraineeManagementWorkspace';

interface Props { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string }>; }

export default async function TraineesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { view } = await searchParams;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login?portal=admin`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login?portal=admin`);
    const [supervisorsSnap, traineesSnap, transitionsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('traineeLifecycleTransitions').limit(2000).get(),
    ]);
    const supervisors = supervisorsSnap.docs.filter(d => !d.data().isDemo).map(d => ({ id: d.id, ...d.data() }));
    const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(t => !t.isDemo && t.lifecycleStage !== 'registered');
    const transitions = transitionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return (
      <AdminPageLayout locale={locale} title="المتدربون">
        <TraineeManagementWorkspace locale={locale} initialView={view === 'add' ? 'add' : view === 'import' ? 'import' : 'manage'} supervisors={supervisors} trainees={trainees} transitions={transitions} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login?portal=admin`); }
}
