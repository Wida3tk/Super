import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import SupervisorTabs from '@/components/admin/SupervisorTabs';

interface Props { params: { locale: string }; }

export default async function SupervisorsPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);
    const [supervisorsSnap, bookingsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('bookings').get(),
    ]);
    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const stats = {
      sessionsBySupervisor: supervisors.map((s: any) => ({
        supervisorId: s.id, name: s.name, count: s.totalSessions || 0, isActive: s.isActive,
      })),
    };
    return (
      <AdminPageLayout locale={locale} title="إنتاجية المشرفين">
        <SupervisorTabs supervisors={supervisors} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
