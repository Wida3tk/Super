'use client';

import { useState, useEffect, useCallback } from 'react';
import { addAvailability } from '@/lib/actions/supervisorActions';

interface Slot { id: string; date: string; time: string; isBooked: boolean; }
interface Props { supervisorId: string; locale: string; }

export default function AvailabilityManager({ supervisorId, locale }: Props) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/availability/list?supervisorId=${supervisorId}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch { setSlots([]); }
    setSlotsLoading(false);
  }, [supervisorId]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(''); setIsError(false);
    const result = await addAvailability(supervisorId, date, startTime, endTime);
    if (result.success) {
      setMsg(`✅ تمت إضافة ${result.slotsCreated} موعد بنجاح`);
      setDate('');
      fetchSlots();
    } else {
      setIsError(true);
      const errMap: Record<string, string> = {
        DATE_IN_PAST: 'التاريخ في الماضي', INVALID_TIME_RANGE: 'نطاق الوقت غير صحيح',
      };
      setMsg(`❌ ${errMap[result.error ?? ''] ?? result.error}`);
    }
    setLoading(false);
  };

  const handleDelete = async (slotId: string) => {
    setDeleting(slotId);
    try {
      const res = await fetch('/api/availability/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });
      const data = await res.json();
      if (data.success) {
        setSlots(prev => prev.filter(s => s.id !== slotId));
      } else if (data.error === 'SLOT_BOOKED') {
        setMsg('❌ لا يمكن حذف موعد محجوز');
        setIsError(true);
      }
    } catch { }
    setDeleting(null);
  };

  // تجميع المواعيد حسب التاريخ
  const grouped = slots
    .filter(s => !filterDate || s.date === filterDate)
    .reduce((acc, s) => {
      if (!acc[s.date]) acc[s.date] = [];
      acc[s.date].push(s);
      return acc;
    }, {} as Record<string, Slot[]>);

  const sortedDates = Object.keys(grouped).sort();
  const freeCount = slots.filter(s => !s.isBooked).length;
  const bookedCount = slots.filter(s => s.isBooked).length;

  return (
    <>
      <style>{`
        .am-wrap { display: grid; grid-template-columns: 340px 1fr; gap: 20px; }
        @media(max-width: 900px) { .am-wrap { grid-template-columns: 1fr; } }

        .am-card { background: #fff; border: 1px solid #EEF2F7; border-radius: 20px; overflow: hidden; box-shadow: 0 1px 4px rgba(1,20,66,0.05); }
        .am-head { padding: 16px 20px; border-bottom: 1px solid #EEF2F7; display: flex; align-items: center; gap: 10px; }
        .am-head-icon { width: 34px; height: 34px; border-radius: 10px; background: rgba(13,64,252,0.07); display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .am-head-title { font-size: 14px; font-weight: 700; color: #001442; }
        .am-body { padding: 20px; }

        .am-label { display: block; font-size: 11px; font-weight: 700; color: #8898AA; margin-bottom: 6px; letter-spacing: 0.04em; }
        .am-input { width: 100%; background: #F8FAFC; border: 1.5px solid #D1D9E6; color: #001442; border-radius: 10px; padding: 10px 13px; font-size: 13px; transition: border-color 0.15s; font-family: inherit; }
        .am-input:focus { outline: none; border-color: #0D40FC; background: #fff; }
        .am-field { margin-bottom: 14px; }
        .am-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }

        .am-msg { padding: 10px 13px; border-radius: 10px; font-size: 12px; font-weight: 500; margin-bottom: 14px; }
        .am-msg.ok { background: rgba(16,185,129,0.08); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .am-msg.err { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }

        .am-btn { width: 100%; background: #0D40FC; color: #fff; border: none; border-radius: 12px; padding: 12px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.18s; font-family: inherit; box-shadow: 0 2px 8px rgba(13,64,252,0.25); }
        .am-btn:hover:not(:disabled) { background: #0929b4; box-shadow: 0 5px 16px rgba(13,64,252,0.35); transform: translateY(-1px); }
        .am-btn:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; transform: none; }
        .am-hint { text-align: center; font-size: 11px; color: #94A3B8; margin-top: 6px; }

        .am-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .am-stat { background: #F8FAFC; border: 1px solid #EEF2F7; border-radius: 12px; padding: 12px; text-align: center; }
        .am-stat-val { font-size: 24px; font-weight: 800; color: #0D40FC; }
        .am-stat-val.booked { color: #F59E0B; }
        .am-stat-lbl { font-size: 11px; color: #8898AA; margin-top: 2px; }

        .am-filter { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .am-filter-label { font-size: 12px; font-weight: 600; color: #8898AA; white-space: nowrap; }
        .am-filter input { flex: 1; background: #F8FAFC; border: 1.5px solid #D1D9E6; color: #001442; border-radius: 10px; padding: 8px 12px; font-size: 12px; font-family: inherit; }
        .am-filter input:focus { outline: none; border-color: #0D40FC; }
        .am-filter-clear { background: none; border: none; color: #94A3B8; cursor: pointer; font-size: 16px; padding: 4px; transition: color 0.15s; }
        .am-filter-clear:hover { color: #EF4444; }

        .am-date-group { margin-bottom: 16px; }
        .am-date-label { font-size: 12px; font-weight: 700; color: #001442; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .am-date-badge { font-size: 10px; background: rgba(13,64,252,0.07); color: #0D40FC; padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(13,64,252,0.15); }
        .am-slots-grid { display: flex; flex-wrap: wrap; gap: 8px; }

        .am-slot { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1.5px solid; transition: all 0.15s; }
        .am-slot.free { background: rgba(16,185,129,0.06); color: #059669; border-color: rgba(16,185,129,0.25); }
        .am-slot.booked { background: rgba(245,158,11,0.07); color: #d97706; border-color: rgba(245,158,11,0.25); }

        .am-del { background: none; border: none; color: rgba(239,68,68,0.4); cursor: pointer; font-size: 14px; padding: 0; line-height: 1; transition: color 0.15s; display: flex; align-items: center; }
        .am-del:hover { color: #EF4444; }
        .am-del:disabled { opacity: 0.3; cursor: not-allowed; }

        .am-empty { text-align: center; padding: 32px; color: #94A3B8; font-size: 13px; }
        .am-empty-icon { font-size: 28px; margin-bottom: 8px; opacity: 0.3; }
        .am-loading { text-align: center; padding: 24px; color: #94A3B8; font-size: 13px; }
      `}</style>

      <div className="am-wrap">
        {/* ADD FORM */}
        <div className="am-card">
          <div className="am-head">
            <div className="am-head-icon">➕</div>
            <span className="am-head-title">إضافة مواعيد جديدة</span>
          </div>
          <div className="am-body">
            <form onSubmit={handleAdd}>
              <div className="am-field">
                <label className="am-label">التاريخ</label>
                <input className="am-input" type="date" value={date} min={today}
                  onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="am-grid2">
                <div>
                  <label className="am-label">🕐 البداية</label>
                  <input className="am-input" type="time" value={startTime}
                    onChange={e => setStartTime(e.target.value)} required />
                </div>
                <div>
                  <label className="am-label">🕕 النهاية</label>
                  <input className="am-input" type="time" value={endTime}
                    onChange={e => setEndTime(e.target.value)} required />
                </div>
              </div>
              {msg && <div className={`am-msg ${isError ? 'err' : 'ok'}`}>{msg}</div>}
              <button type="submit" disabled={loading} className="am-btn">
                {loading ? '⏳ جارٍ الإضافة...' : '＋ إضافة المواعيد'}
              </button>
              <div className="am-hint">كل موعد 30 دقيقة</div>
            </form>
          </div>
        </div>

        {/* SLOTS LIST */}
        <div className="am-card">
          <div className="am-head">
            <div className="am-head-icon">📅</div>
            <span className="am-head-title">المواعيد الحالية</span>
          </div>
          <div className="am-body">
            <div className="am-stats">
              <div className="am-stat">
                <div className="am-stat-val">{freeCount}</div>
                <div className="am-stat-lbl">متاح</div>
              </div>
              <div className="am-stat">
                <div className="am-stat-val booked">{bookedCount}</div>
                <div className="am-stat-lbl">محجوز</div>
              </div>
            </div>

            <div className="am-filter">
              <span className="am-filter-label">فلتر:</span>
              <input type="date" value={filterDate} min={today}
                onChange={e => setFilterDate(e.target.value)} />
              {filterDate && (
                <button className="am-filter-clear" onClick={() => setFilterDate('')}>✕</button>
              )}
            </div>

            {slotsLoading ? (
              <div className="am-loading">⏳ جارٍ التحميل...</div>
            ) : sortedDates.length === 0 ? (
              <div className="am-empty">
                <div className="am-empty-icon">📭</div>
                لا توجد مواعيد — أضف مواعيد من القسم الجانبي
              </div>
            ) : (
              sortedDates.map(d => (
                <div key={d} className="am-date-group">
                  <div className="am-date-label">
                    📆 {new Date(d + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    <span className="am-date-badge">{grouped[d].length} موعد</span>
                  </div>
                  <div className="am-slots-grid">
                    {grouped[d].sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                      <div key={slot.id} className={`am-slot ${slot.isBooked ? 'booked' : 'free'}`}>
                        {slot.isBooked ? '🔒' : '🟢'} {slot.time}
                        {!slot.isBooked && (
                          <button
                            className="am-del"
                            onClick={() => handleDelete(slot.id)}
                            disabled={deleting === slot.id}
                            title="حذف الموعد"
                          >
                            {deleting === slot.id ? '⏳' : '✕'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
