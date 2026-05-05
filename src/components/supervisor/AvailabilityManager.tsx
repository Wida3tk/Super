'use client';

import { useState } from 'react';
import { addAvailability } from '@/lib/actions/supervisorActions';

interface Props {
  supervisorId: string;
  locale: string;
}

export default function AvailabilityManager({ supervisorId, locale }: Props) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const result = await addAvailability(supervisorId, date, startTime, endTime);

    if (result.success) {
      setMessage(`✅ تمت إضافة ${result.slotsCreated} موعد بنجاح`);
      setDate('');
    } else {
      setIsError(true);
      const errMap: Record<string, string> = {
        DATE_IN_PAST: 'التاريخ المحدد في الماضي',
        INVALID_TIME_RANGE: 'نطاق الوقت غير صحيح',
      };
      setMessage(`❌ ${errMap[result.error ?? ''] ?? result.error}`);
    }

    setLoading(false);
  };

  return (
    <>
      <style>{`
        .av-card {
          background: #fff;
          border: 1px solid #EEF2F7;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 1px 4px rgba(1,20,66,0.05);
        }
        .av-title {
          font-size: 15px; font-weight: 700;
          color: #001442;
          margin-bottom: 20px;
          display: flex; align-items: center; gap: 8px;
        }
        .av-label {
          display: block;
          font-size: 12px; font-weight: 600;
          color: #8898AA;
          margin-bottom: 6px;
          letter-spacing: 0.03em;
        }
        .av-input {
          width: 100%;
          background: #F8FAFC;
          border: 1px solid #D1D9E6;
          color: #001442;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .av-input:focus {
          outline: none;
          border-color: #0D40FC;
          background: #fff;
        }
        .av-field { margin-bottom: 16px; }
        .av-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
          margin-bottom: 16px;
        }
        .av-msg {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px; font-weight: 500;
          margin-bottom: 16px;
        }
        .av-msg.ok { background: rgba(16,185,129,0.08); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .av-msg.err { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }
        .av-btn {
          width: 100%;
          background: #0D40FC;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px; font-weight: 700;
          cursor: pointer;
          transition: all 0.18s;
          font-family: inherit;
          box-shadow: 0 2px 8px rgba(13,64,252,0.25);
        }
        .av-btn:hover:not(:disabled) {
          background: #0929b4;
          box-shadow: 0 5px 16px rgba(13,64,252,0.35);
          transform: translateY(-1px);
        }
        .av-btn:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; }
        .av-hint { text-align: center; font-size: 11px; color: #94A3B8; margin-top: 8px; }
      `}</style>

      <div className="av-card">
        <div className="av-title">📅 إضافة أوقات متاحة</div>

        <form onSubmit={handleSubmit}>
          <div className="av-field">
            <label className="av-label">التاريخ</label>
            <input
              className="av-input"
              type="date"
              value={date}
              min={today}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="av-grid">
            <div>
              <label className="av-label">🕐 وقت البداية</label>
              <input
                className="av-input"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="av-label">🕕 وقت النهاية</label>
              <input
                className="av-input"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {message && (
            <div className={`av-msg ${isError ? 'err' : 'ok'}`}>{message}</div>
          )}

          <button type="submit" disabled={loading} className="av-btn">
            {loading ? '⏳ جارٍ الإضافة...' : '+ إضافة مواعيد'}
          </button>
          <div className="av-hint">كل موعد مدته 30 دقيقة</div>
        </form>
      </div>
    </>
  );
}
