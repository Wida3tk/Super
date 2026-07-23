import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import ExportClient from '@/components/admin/ExportClient';

interface Props { params: Promise<{ locale: string }>; }

export default async function ExportPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const [supervisorsSnap, traineesSnap, snapshotsSnap, bookingsSnap, sessionsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('monthlySnapshots').get(),
      adminDb.collection('bookings').get(),
      adminDb.collection('sessions').get(),
    ]);

    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const snapshots = snapshotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return (
      <AdminPageLayout locale={locale} title="التصدير">
        <ExportClient
          supervisors={supervisors}
          trainees={trainees}
          snapshots={snapshots}
          bookings={bookings}
          sessions={sessions}
          currentMonth={currentMonth}
        />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
