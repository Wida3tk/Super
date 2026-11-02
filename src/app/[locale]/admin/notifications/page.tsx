import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import NotificationsClient from '@/components/admin/NotificationsClient';

interface Props { params: Promise<{ locale: string }>; }

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) return null;
    return { adminDb };
  } catch { return null; }
}

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  const auth = await verifyAdmin();
  if (!auth) redirect(`/${locale}/login?portal=admin`);
  const { adminDb } = auth;

  const [notifsSnap, campaignsSnap, supervisorsSnap, traineesSnap] = await Promise.all([
    adminDb.collection('notifications').orderBy('createdAt', 'desc').limit(50).get(),
    adminDb.collection('notificationCampaigns').orderBy('createdAt', 'desc').limit(30).get(),
    adminDb.collection('supervisors').get(),
    adminDb.collection('trainees').get(),
  ]);

  const notifications = [
    ...notifsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((item: any) => item.targetType === 'supervisor' || item.targetType === 'trainee'),
    ...campaignsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  ].sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))) as any[];
  const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  return (
    <AdminPageLayout locale={locale} title="مركز الإشعارات">
      <NotificationsClient
        notifications={notifications}
        supervisors={supervisors}
        trainees={trainees}
      />
    </AdminPageLayout>
  );
}
