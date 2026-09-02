import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import TraineeLifecyclePanel from '@/components/admin/TraineeLifecyclePanel';
import Link from 'next/link';

interface Props { params: Promise<{ locale: string }>; }

export default async function TraineesPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);
    const [supervisorsSnap, traineesSnap, transitionsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('traineeLifecycleTransitions').limit(2000).get(),
    ]);
    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const transitions = transitionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return (
      <AdminPageLayout locale={locale} title="المتدربون">
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
          <Link href={`/${locale}/admin/import`} style={{ background: '#0D40FC', color: '#fff', borderRadius: 10, padding: '11px 16px', fontWeight: 800, textDecoration: 'none', boxShadow: '0 8px 20px rgba(13,64,252,.18)' }}>
            📥 استيراد ملف متدرب
          </Link>
        </div>
        <TraineeLifecyclePanel supervisors={supervisors} trainees={trainees} transitions={transitions} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
