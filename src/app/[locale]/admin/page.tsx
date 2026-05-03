// src/app/[locale]/admin/page.tsx
import { getTranslations } from 'next-intl/server';
import { adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import { redirect } from 'next/navigation';
import AdminDashboardClient from '@/components/admin/AdminDashboardClient';

interface Props {
  params: { locale: string };
}

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return false;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.email === process.env.ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('admin');

  const isAdmin = await verifyAdmin();
  if (!isAdmin) redirect(`/${locale}`);

  // --- إحصائيات ---
  const [bookingsSnap, supervisorsSnap, reviewsSnap] = await Promise.all([
    adminDb.collection('bookings').get(),
    adminDb.collection('supervisors').get(),
    adminDb.collection('reviews').get(),
  ]);

  const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const reviews = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
  const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;

  // الجلسات لكل مشرف
  const sessionsBySupervisor = supervisors.map((sup: any) => ({
    supervisorId: sup.id,
    name: sup.name,
    isActive: sup.isActive,
    count: bookings.filter((b: any) => b.supervisorId === sup.id && b.status === 'confirmed').length,
  }));

  // معدل الإشغال = حجوزات مؤكدة / (مؤكدة + متاحة)
  const availableSnap = await adminDb.collection('availability').where('isBooked', '==', false).get();
  const totalSlots = confirmed + availableSnap.size;
  const occupancyRate = totalSlots > 0 ? Math.round((confirmed / totalSlots) * 100) : 0;

  const stats = {
    totalBookings: bookings.length,
    confirmedBookings: confirmed,
    cancelledBookings: cancelled,
    occupancyRate,
    sessionsBySupervisor,
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <h1 className="text-white font-bold text-xl">{t('title')}</h1>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: t('totalBookings'), value: stats.totalBookings, color: 'sky' },
            { label: t('confirmed'), value: stats.confirmedBookings, color: 'emerald' },
            { label: t('cancelled'), value: stats.cancelledBookings, color: 'red' },
            { label: t('occupancyRate'), value: `${stats.occupancyRate}%`, color: 'amber' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
              <div className={`text-3xl font-bold text-${color}-400`}>{value}</div>
              <div className="text-slate-400 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Supervisors Table + CSV Export — Client */}
        <AdminDashboardClient
          stats={stats}
          bookings={bookings}
          supervisors={supervisors}
          reviews={reviews}
          locale={locale}
        />
      </div>
    </div>
  );
}
