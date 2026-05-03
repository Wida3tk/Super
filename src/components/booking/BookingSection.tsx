// src/components/booking/BookingSection.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Supervisor, AvailabilitySlot } from '@/types';
import { createBooking } from '@/lib/actions/bookingActions';

interface BookingSectionProps {
  supervisor: Supervisor;
  availableDates: string[];
  locale: string;
}

export default function BookingSection({ supervisor, availableDates, locale }: BookingSectionProps) {
  const t = useTranslations('supervisor');
  const tBooking = useTranslations('booking');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Form state
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    setLoadingSlots(true);

    try {
      const res = await fetch(`/api/availability?supervisorId=${supervisor.id}&date=${date}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setError('');

    const result = await createBooking(
      {
        studentName,
        studentEmail,
        studentPhone,
        supervisorId: supervisor.id,
        availabilitySlotId: selectedSlot.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
      },
      locale as 'ar' | 'en'
    );

    if (result.success) {
      router.push(
        `/${locale}/booking-success?token=${result.managementToken}&date=${selectedSlot.date}&time=${selectedSlot.time}&supervisor=${encodeURIComponent(supervisor.name)}`
      );
    } else {
      setError(result.error || 'UNKNOWN_ERROR');
      setSubmitting(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Slot Picker */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">{t('availableSlots')}</h2>

        <div className="mb-4">
          <label className="block text-slate-400 text-sm mb-2">{t('selectDate')}</label>
          <select
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
          >
            <option value="">—</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>

        {loadingSlots && (
          <div className="text-slate-400 text-center py-4">⏳</div>
        )}

        {!loadingSlots && selectedDate && slots.length === 0 && (
          <p className="text-slate-500 text-sm">{t('noSlots')}</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => setSelectedSlot(slot)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                selectedSlot?.id === slot.id
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {slot.time}
            </button>
          ))}
        </div>
      </div>

      {/* Booking Form */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">{tBooking('title')}</h2>

        {selectedSlot && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3 mb-4">
            <p className="text-sky-400 text-sm font-medium">
              {tBooking('selectedTime')}: {selectedSlot.date} — {selectedSlot.time}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">{tBooking('duration')}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">{tBooking('studentName')}</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder={tBooking('namePlaceholder')}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">{tBooking('studentEmail')}</label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder={tBooking('emailPlaceholder')}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">{tBooking('studentPhone')}</label>
            <input
              type="tel"
              value={studentPhone}
              onChange={(e) => setStudentPhone(e.target.value)}
              placeholder={tBooking('phonePlaceholder')}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">{tErrors(error as any)}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedSlot || submitting}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            {submitting ? tBooking('submitting') : tBooking('confirm')}
          </button>
        </form>
      </div>
    </div>
  );
}
