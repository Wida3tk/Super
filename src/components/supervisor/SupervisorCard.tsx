// src/components/supervisor/SupervisorCard.tsx
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Supervisor } from '@/types';

interface SupervisorCardProps {
  supervisor: Supervisor;
  locale: string;
}

export default function SupervisorCard({ supervisor, locale }: SupervisorCardProps) {
  const t = useTranslations('home');

  const stars = Math.round(supervisor.ratingAverage);

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 transition-all duration-300 group">
      {/* Photo */}
      <div className="relative h-48 bg-gradient-to-br from-slate-700 to-slate-600 overflow-hidden">
        {supervisor.photo ? (
          <img
            src={supervisor.photo}
            alt={supervisor.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-slate-500">
            👤
          </div>
        )}
        {/* Rating badge */}
        <div className="absolute top-3 end-3 bg-slate-900/80 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
          <span className="text-amber-400 text-sm">★</span>
          <span className="text-white text-sm font-medium">
            {supervisor.ratingAverage?.toFixed(1) || '—'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-white font-bold text-lg mb-1">{supervisor.name}</h3>
        <p className="text-slate-400 text-sm line-clamp-2 mb-4">{supervisor.bio}</p>

        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <div className="text-sky-400 font-bold text-lg">{supervisor.totalSessions}</div>
            <div className="text-slate-500 text-xs">{t('sessions')}</div>
          </div>
          <div className="text-center">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-sm ${star <= stars ? 'text-amber-400' : 'text-slate-600'}`}
                >
                  ★
                </span>
              ))}
            </div>
            <div className="text-slate-500 text-xs">{t('rating')}</div>
          </div>
        </div>

        <Link
          href={`/${locale}/supervisor/${supervisor.id}`}
          className="block w-full text-center bg-sky-500 hover:bg-sky-400 text-white font-medium py-2.5 px-4 rounded-xl transition-colors duration-200"
        >
          {t('viewProfile')}
        </Link>
      </div>
    </div>
  );
}
