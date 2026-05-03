// src/app/[locale]/supervisor-dashboard/page.tsx
import { getTranslations } from 'next-intl/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { redirect } from 'next/navigation';
import AvailabilityManager from '@/components/supervisor/AvailabilityManager';
import { cookies } from 'next/headers';

interface Props {
  params: { locale: string };
}

async function getAuthenticatedSupervisor(locale: string) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const supervisorSnap = await adminDb
      .collection('supervisors')
      .where('email', '==', decoded.email)
      .limit(1)
      .get();

    if (supervisorSnap.empty) return null;
    return { id: supervisorSnap.docs[0].id, ...supervisorSnap.docs[0].data() };
  } catch {
    return null;
  }
}

export default async function SupervisorDashboardPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('supervisorDashboard');

  const supervisor = await getAuthenticatedSupervisor(locale);

  if (!supervisor) {
    redirect(`/${locale}`);
  }

  // جلب الجلسات القادمة
  const today = new Date().toISOString().split('T')[0];
  const bookingsSnap = await adminDb
    .collection('bookings')
    .where('supervisorId', '==', (supervisor as any).id)
    .where('status', '==', 'confirmed')
    .where('date', '>=', today)
    .orderBy('date', 'asc')
    .get();

  const upcomingBookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <h1 className="text-white font-bold text-xl">{t('title')}</h1>
        <p className="text-slate-400 text-sm">{(supervisor as any).name}</p>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          {[
            { label: t('totalSessions'), value: (supervisor as any).totalSessions || 0, color: 'sky' },
            { label: t('avgRating'), value: ((supervisor as any).ratingAverage || 0).toFixed(1) + ' ★', color: 'amber' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center">
              <div className={`text-3xl font-bold text-${color}-400 mb-1`}>{value}</div>
              <div className="text-slate-400 text-sm">{label}</div>
            </div>
          ))}
        </div>

        {/* Availability Manager */}
        <AvailabilityManager supervisorId={(supervisor as any).id} locale={locale} />

        {/* Upcoming Sessions */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-white font-bold mb-4">{t('upcomingSessions')}</h2>
          {upcomingBookings.length === 0 ? (
            <p className="text-slate-500 text-sm">{t('noUpcoming')}</p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking: any) => (
                <div key={booking.id} className="bg-slate-700/50 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium text-sm">{booking.studentName}</p>
                      <p className="text-slate-400 text-xs">{booking.studentEmail}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sky-400 text-sm font-medium">{booking.date}</p>
                      <p className="text-slate-400 text-xs">{booking.time}</p>
                    </div>
                  </div>
                  {booking.meetLink && (
                    <a
                      href={booking.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 text-xs hover:underline mt-2 block"
                    >
                      🎥 Google Meet
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
