// src/app/[locale]/manage-booking/[token]/page.tsx
import { getTranslations } from 'next-intl/server';
import { getBookingByToken } from '@/lib/actions/bookingActions';
import CancelBookingClient from '@/components/booking/CancelBookingClient';
import Link from 'next/link';

interface ManageBookingPageProps {
  params: { locale: string; token: string };
}

export default async function ManageBookingPage({ params }: ManageBookingPageProps) {
  const { locale, token } = await params;
  const t = await getTranslations('manageBooking');

  const booking = await getBookingByToken(token);

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-slate-400">{t('notFound')}</p>
          <Link href={`/${locale}`} className="text-sky-400 hover:underline mt-4 block">
            {locale === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    confirmed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    cancelled: 'text-red-400 bg-red-400/10 border-red-400/30',
    completed: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    rescheduled: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  };

  const statusLabels: Record<string, string> = {
    confirmed: t('confirmed'),
    cancelled: t('cancelled'),
    completed: t('completed'),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h1 className="text-white font-bold text-xl">{t('title')}</h1>
          </div>

          <div className="p-6 space-y-4">
            {/* Details */}
            {[
              { label: t('status'), value: (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[booking.status]}`}>
                  {statusLabels[booking.status] || booking.status}
                </span>
              )},
              { label: 'Supervisor / المشرف', value: booking.supervisorName },
              { label: 'Date / التاريخ', value: booking.date },
              { label: 'Time / الوقت', value: booking.time },
              { label: 'Student / الطالب', value: booking.studentName },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-700/30">
                <span className="text-slate-400 text-sm">{label}</span>
                <span className="text-white text-sm font-medium">{value}</span>
              </div>
            ))}

            {/* Meet Link */}
            {booking.meetLink && booking.status === 'confirmed' && (
              <a
                href={booking.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition-colors mt-2"
              >
                🎥 Google Meet
              </a>
            )}

            {/* Cancel — Client Component for interactivity */}
            {booking.status === 'confirmed' && (
              <CancelBookingClient token={token} locale={locale} />
            )}

            {booking.status === 'cancelled' && (
              <Link
                href={`/${locale}`}
                className="block w-full text-center bg-sky-500 hover:bg-sky-400 text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                {t('bookAgain')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
