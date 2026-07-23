'use client';

import { useState } from 'react';

interface Props {
  supervisorId: string;
  currentSeats: number;
}

export default function SeatsManager({ supervisorId, currentSeats }: Props) {
  const [seats, setSeats] = useState(currentSeats);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  const updateSeats = async (newVal: number) => {
    if (newVal < 0) return;
    setLoading(true); setMsg(''); setIsError(false);
    try {
      const res = await fetch('/api/supervisor/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats: newVal }),
      });
      const data = await res.json();
      if (data.success) {
        setSeats(newVal);
        setMsg('✅ تم الحفظ');
        setTimeout(() => setMsg(''), 2000);
      } else {
        setIsError(true);
        setMsg('❌ خطأ في الحفظ');
      }
    } catch {
      setIsError(true);
      setMsg('❌ خطأ في الاتصال');
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        .sm-card{background:#fff;border-radius:18px;border:1px solid #EEF2F7;box-shadow:0 1px 4px rgba(1,20,66,0.05);overflow:hidden;}
        .sm-head{padding:14px 20px;border-bottom:1px solid #EEF2F7;display:flex;align-items:center;gap:10px;}
        .sm-icon{width:32px;height:32px;border-radius:9px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;font-size:15px;}
        .sm-title{font-size:14px;font-weight:700;color:#001442;}
        .sm-body{padding:24px 20px;}
        .sm-display{text-align:center;margin-bottom:24px;}
        .sm-num{font-size:72px;font-weight:900;color:#001442;line-height:1;margin-bottom:4px;}
        .sm-num.zero{color:#CBD5E1;}
        .sm-sub{font-size:13px;color:#8898AA;}
        .sm-controls{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;}
        .sm-btn{width:48px;height:48px;border-radius:14px;border:none;font-size:22px;font-weight:700;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;font-family:inherit;}
        .sm-btn.minus{background:rgba(239,68,68,0.08);color:#dc2626;border:1.5px solid rgba(239,68,68,0.2);}
        .sm-btn.minus:hover:not(:disabled){background:rgba(239,68,68,0.15);}
        .sm-btn.plus{background:rgba(16,185,129,0.08);color:#059669;border:1.5px solid rgba(16,185,129,0.2);}
        .sm-btn.plus:hover:not(:disabled){background:rgba(16,185,129,0.15);}
        .sm-btn:disabled{opacity:.4;cursor:not-allowed;}
        .sm-input-row{display:flex;gap:8px;}
        .sm-input{flex:1;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;text-align:center;}
        .sm-input:focus{outline:none;border-color:#0D40FC;}
        .sm-save{background:#0D40FC;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;font-family:inherit;box-shadow:0 2px 8px rgba(13,64,252,0.25);}
        .sm-save:hover:not(:disabled){background:#0929b4;}
        .sm-save:disabled{background:#CBD5E1;box-shadow:none;cursor:not-allowed;}
        .sm-msg{text-align:center;font-size:12px;font-weight:500;margin-top:12px;padding:8px;border-radius:8px;}
        .sm-msg.ok{background:rgba(16,185,129,0.08);color:#059669;}
        .sm-msg.err{background:rgba(239,68,68,0.08);color:#dc2626;}
        .sm-hint{text-align:center;font-size:11px;color:#94A3B8;margin-top:10px;}
      `}</style>

      <div className="sm-card">
        <div className="sm-head">
          <div className="sm-icon">🪑</div>
          <span className="sm-title">المقاعد المتاحة للحجز</span>
        </div>
        <div className="sm-body">
          <div className="sm-display">
            <div className={`sm-num${seats === 0 ? ' zero' : ''}`}>{seats}</div>
            <div className="sm-sub">{seats === 0 ? 'لا توجد مقاعد متاحة' : `مقعد متاح للحجز`}</div>
          </div>

          <div className="sm-controls">
            <button className="sm-btn minus" onClick={() => updateSeats(seats - 1)} disabled={loading || seats <= 0}>−</button>
            <div style={{fontSize:18,fontWeight:700,color:'#001442',minWidth:32,textAlign:'center'}}>{seats}</div>
            <button className="sm-btn plus" onClick={() => updateSeats(seats + 1)} disabled={loading}>+</button>
          </div>

          <div className="sm-input-row">
            <input
              className="sm-input"
              type="number"
              min={0}
              value={seats}
              onChange={e => setSeats(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="أدخل الرقم"
            />
            <button className="sm-save" onClick={() => updateSeats(seats)} disabled={loading}>
              {loading ? '⏳' : 'حفظ'}
            </button>
          </div>

          {msg && <div className={`sm-msg ${isError ? 'err' : 'ok'}`}>{msg}</div>}
          <div className="sm-hint">يظهر هذا الرقم في صفحة المشرف العامة للطلاب</div>
        </div>
      </div>
    </>
  );
}
