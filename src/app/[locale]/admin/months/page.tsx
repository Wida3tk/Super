import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import AdminSupervisionPanel from '@/components/admin/AdminSupervisionPanel';
import { loadSupervisionPanelData } from '@/lib/admin/supervisionPanelData';
interface Props { params: Promise<{ locale: string }>; }
export default async function MonthsPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login?portal=admin`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login?portal=admin`);
    const { supervisors, trainees, snapshots, supervisorTotals } = await loadSupervisionPanelData(adminDb);
    return (
      <AdminPageLayout locale={locale} title="الاعتماد الشهري">
        <AdminSupervisionPanel supervisors={supervisors} initialTrainees={trainees} initialSnapshots={snapshots} supervisorTotals={supervisorTotals} visibleTabs={["months"]} />
      </AdminPageLayout>
    );
  } catch (error) {
    if (String((error as { code?: string }).code || '').startsWith('auth/')) redirect(`/${locale}/login?portal=admin`);
    throw error;
  }
}
