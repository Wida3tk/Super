// src/components/supervisor/AvailabilityManager.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { addAvailability } from '@/lib/actions/supervisorActions';

interface Props {
  supervisorId: string;
  locale: string;
}

export default function AvailabilityManager({ supervisorId, locale }: Props) {
  const t = useTranslations('supervisorDashboard');

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = await addAvailability(supervisorId, date, startTime, endTime);

    if (result.success) {
      setMessage(t('slotsAdded').replace('{count}', String(result.slotsCreated)));
      setDate('');
    } else {
      setMessage(`Error: ${result.error}`);
    }

    setLoading(false);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
      <h2 className="text-white font-bold mb-4">{t('addAvailability')}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1">{t('date')}</label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 text-sm mb-1">{t('startTime')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">{t('endTime')}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {message && (
          <div className={`rounded-xl p-3 text-sm ${
            message.startsWith('Error')
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {loading ? '⏳' : `+ ${t('addSlots')}`}
        </button>
      </form>
    </div>
  );
}
