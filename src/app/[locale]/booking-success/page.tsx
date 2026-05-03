// src/app/[locale]/booking-success/page.tsx
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

interface SuccessPageProps {
  params: { locale: string };
  searchParams: {
    token?: string;
    date?: string;
    time?: string;
    supervisor?: string;
    meetLink?: string;
  };
}

export default async function BookingSuccessPage({ params, searchParams }: SuccessPageProps) {
  const { locale } = await params;
  const { token, date, time, supervisor, meetLink } = await searchParams;
  const t = await getTranslations('bookingSuccess');

  const manageUrl = `/${locale}/manage-booking/${token}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Success Card */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-600 to-sky-400 p-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="text-white text-2xl font-bold">{t('title')}</h1>
            <p className="text-sky-100 mt-1">{t('subtitle')}</p>
          </div>

          {/* Session Details */}
          <div className="p-6">
            <h2 className="text-white font-bold mb-4">{t('sessionDetails')}</h2>
            <div className="space-y-3 mb-6">
              {[
                { label: t('supervisor'), value: supervisor },
                { label: t('date'), value: date },
                { label: t('time'), value: time },
                { label: t('duration'), value: t('durationValue') },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-700/50">
                  <span className="text-slate-400 text-sm">{label}</span>
                  <span className="text-white font-medium text-sm">{value}</span>
                </div>
              ))}
            </div>

            {/* Meet Link */}
            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors mb-3"
              >
                🎥 {t('joinMeeting')}
              </a>
            )}

            {/* Protocol */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
              <h3 className="text-amber-400 font-bold mb-2 text-sm">📋 {t('protocol')}</h3>
              <ul className="space-y-1.5">
                {(t.raw('protocolItems') as string[]).map((item, i) => (
                  <li key={i} className="text-slate-300 text-xs flex gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <Link
              href={manageUrl}
              className="block w-full text-center border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white py-2.5 rounded-xl transition-colors text-sm mb-3"
            >
              ⚙️ {t('manageBooking')}
            </Link>

            <Link
              href={`/${locale}`}
              className="block w-full text-center text-slate-500 hover:text-slate-300 py-2 text-sm transition-colors"
            >
              {t('bookAnother')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
