import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import AdminSupervisionPanel from '@/components/admin/AdminSupervisionPanel';

interface Props { params: { locale: string }; }

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);
    const [supervisorsSnap, traineesSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').where('status', '==', 'onboarding').get(),
    ]);
    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return (
      <AdminPageLayout locale={locale} title="البوردنق والإسناد">
        <AdminSupervisionPanel supervisors={supervisors} initialTrainees={trainees} initialSnapshots={[]} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
