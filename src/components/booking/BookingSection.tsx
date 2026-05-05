'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBooking } from '@/lib/actions/bookingActions';

interface BookingSectionProps {
  supervisor: any;
  availableDates: string[];
  locale: string;
}

export default function BookingSection({ supervisor, availableDates, locale }: BookingSectionProps) {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
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
      setError(result.error || 'حدث خطأ، حاولي مرة أخرى');
      setSubmitting(false);
    }
  };

  // التواريخ الثابتة للاختبار
  const dates = availableDates.length > 0 ? availableDates : ['2026-05-10'];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Slot Picker */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">الأوقات المتاحة</h2>

        <div className="mb-4">
          <label className="block text-slate-400 text-sm mb-2">اختر التاريخ</label>
          <select
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
          >
            <option value="">— اختر —</option>
            {dates.map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>

        {loadingSlots && <div className="text-slate-400 text-center py-4">⏳ جارٍ التحميل...</div>}

        {!loadingSlots && selectedDate && slots.length === 0 && (
          <p className="text-slate-500 text-sm">لا توجد أوقات متاحة في هذا اليوم</p>
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
        <h2 className="text-white font-bold text-lg mb-4">تأكيد الحجز</h2>

        {selectedSlot && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3 mb-4">
            <p className="text-sky-400 text-sm font-medium">
              الموعد: {selectedSlot.date} — {selectedSlot.time}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">المدة: 30 دقيقة</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">الاسم الكامل</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="أدخل اسمك الكامل"
              required
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">رقم الجوال</label>
            <input
              type="tel"
              value={studentPhone}
              onChange={(e) => setStudentPhone(e.target.value)}
              placeholder="+966 5X XXX XXXX"
              required
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedSlot || submitting}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            {submitting ? 'جارٍ الحجز...' : 'تأكيد الحجز'}
          </button>
        </form>
      </div>
    </div>
  );
}
