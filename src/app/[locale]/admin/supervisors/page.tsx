import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import SupervisorTabs from '@/components/admin/SupervisorTabs';
import Link from 'next/link';

interface Props { params: Promise<{ locale: string }>; }

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
    const supervisors = await Promise.all(supervisorsSnap.docs.map(async d => {
      const data = d.data() as any;
      let authUid = data.authUid || '';
      if (!authUid && data.email) {
        try { authUid = (await adminAuth.getUserByEmail(String(data.email).toLowerCase())).uid; } catch {}
      }
      return { id: d.id, ...data, authUid };
    })) as any[];
    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const today = new Date().toISOString().slice(0, 10);
    const supervisorsWithOperations = supervisors.map((supervisor: any) => ({
      ...supervisor,
      upcomingBookings: bookings.filter((booking: any) => booking.supervisorId === supervisor.id && booking.status === 'confirmed' && booking.date >= today).length,
    }));
    return (
      <AdminPageLayout locale={locale} title="حسابات المشرفين">
        <div style={{display:'flex',justifyContent:'flex-start',marginBottom:14}}><Link href={`/${locale}/admin/import-supervisor`} style={{background:'#0D40FC',color:'#fff',borderRadius:10,padding:'11px 16px',fontWeight:800,textDecoration:'none'}}>📥 استيراد ملف مشرف</Link></div>
        <SupervisorTabs supervisors={supervisorsWithOperations as any} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
