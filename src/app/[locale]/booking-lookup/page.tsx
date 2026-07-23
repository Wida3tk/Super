'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BookingLookupPage() {
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);

    try {
      const res = await fetch(`/api/booking/lookup?ref=${encodeURIComponent(ref.trim().toUpperCase())}`);
      const data = await res.json();

      if (data.booking) {
        setResult(data.booking);
      } else {
        setError('لم يتم العثور على حجز بهذا الرقم');
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    }
    setLoading(false);
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d; }
  };

  const statusInfo: Record<string, { label: string; color: string; bg: string }> = {
    confirmed: { label: '✓ مؤكد', color: '#059669', bg: 'rgba(16,185,129,0.08)' },
    cancelled:  { label: '✕ ملغى',  color: '#dc2626', bg: 'rgba(239,68,68,0.08)' },
    completed:  { label: '✓ مكتمل', color: '#0D40FC', bg: 'rgba(13,64,252,0.08)' },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        body{background:linear-gradient(135deg,#020716 0%,#001442 60%,#0D2080 100%);min-height:100vh;direction:rtl;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;}
        .wrap{width:100%;max-width:480px;}
        .top{text-align:center;margin-bottom:28px;}
        .top-icon{font-size:48px;display:block;margin-bottom:12px;}
        .top-title{font-size:26px;font-weight:800;color:#fff;margin-bottom:6px;}
        .top-sub{font-size:14px;color:rgba(255,255,255,0.45);line-height:1.6;}

        .search-card{background:#fff;border-radius:24px;padding:28px;box-shadow:0 24px 64px rgba(0,0,0,0.4);margin-bottom:16px;}
        .search-label{display:block;font-size:12px;font-weight:700;color:#8898AA;margin-bottom:8px;letter-spacing:0.04em;}
        .search-input-row{display:flex;gap:10px;}
        .search-input{flex:1;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;border-radius:12px;padding:13px 16px;font-size:15px;font-weight:700;letter-spacing:0.08em;font-family:monospace;transition:all .18s;text-transform:uppercase;}
        .search-input:focus{outline:none;border-color:#0D40FC;box-shadow:0 0 0 3px rgba(13,64,252,0.1);background:#fff;}
        .search-input::placeholder{color:#CBD5E1;font-family:'IBM Plex Sans Arabic',sans-serif;letter-spacing:0;font-weight:400;font-size:14px;}
        .search-btn{background:#0D40FC;color:#fff;border:none;border-radius:12px;padding:13px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:all .18s;font-family:inherit;box-shadow:0 2px 8px rgba(13,64,252,0.3);white-space:nowrap;}
        .search-btn:hover:not(:disabled){background:#0929b4;transform:translateY(-1px);}
        .search-btn:disabled{background:#CBD5E1;box-shadow:none;cursor:not-allowed;}
        .search-hint{font-size:11px;color:#94A3B8;margin-top:8px;display:flex;align-items:center;gap:4px;}

        .error-box{background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.2);border-radius:12px;padding:14px 18px;font-size:13px;color:#dc2626;font-weight:500;margin-top:12px;text-align:center;}

        .result-card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.4);}
        .result-head{background:linear-gradient(135deg,#0D40FC,#001442);padding:20px 28px;display:flex;align-items:center;justify-content:space-between;}
        .result-ref{font-size:20px;font-weight:900;color:#fff;letter-spacing:0.1em;font-family:monospace;}
        .result-status{font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;}

        .result-body{padding:0 28px;}
        .result-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #F1F5F9;}
        .result-row:last-child{border-bottom:none;}
        .result-label{font-size:13px;color:#8898AA;display:flex;align-items:center;gap:6px;}
        .result-value{font-size:13px;font-weight:700;color:#001442;}

        .result-actions{padding:20px 28px;display:flex;flex-direction:column;gap:10px;border-top:1px solid #F1F5F9;}
        .btn-manage{display:flex;align-items:center;justify-content:center;gap:8px;background:#0D40FC;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:13px;border-radius:12px;box-shadow:0 2px 8px rgba(13,64,252,0.3);transition:all .18s;}
        .btn-manage:hover{background:#0929b4;}
        .btn-home{display:flex;align-items:center;justify-content:center;gap:8px;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;text-decoration:none;font-size:13px;font-weight:600;padding:12px;border-radius:12px;transition:all .18s;}
        .btn-home:hover{border-color:#0D40FC;color:#0D40FC;}

        .footer-note{text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,0.3);}
        .footer-note a{color:rgba(85,215,255,0.6);text-decoration:none;}
      `}</style>

      <div className="wrap" dir="rtl">
        <div className="top">
          <span className="top-icon">🔍</span>
          <div className="top-title">تتبع حجزك</div>
          <div className="top-sub">أدخل الرقم المرجعي الذي وصلك عند الحجز<br/>للاطلاع على تفاصيل جلستك</div>
        </div>

        <div className="search-card">
          <form onSubmit={handleSearch}>
            <label className="search-label">الرقم المرجعي للحجز</label>
            <div className="search-input-row">
              <input
                className="search-input"
                type="text"
                value={ref}
                onChange={e => setRef(e.target.value.toUpperCase())}
                placeholder="SUL-XXXX-XXXX"
                required
                maxLength={16}
              />
              <button type="submit" disabled={loading || !ref.trim()} className="search-btn">
                {loading ? '⏳' : 'بحث'}
              </button>
            </div>
            <div className="search-hint">💡 الرقم المرجعي يبدأ بـ SUL- ويوجد في إيميل التأكيد</div>
          </form>

          {error && <div className="error-box">⚠️ {error}</div>}
        </div>

        {result && (
          <div className="result-card">
            <div className="result-head">
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>رقم الحجز</div>
                <div className="result-ref">{result.referenceNumber}</div>
              </div>
              {(() => {
                const s = statusInfo[result.status] || statusInfo.confirmed;
                return (
                  <span className="result-status" style={{background:s.bg,color:s.color,border:`1.5px solid ${s.color}33`}}>
                    {s.label}
                  </span>
                );
              })()}
            </div>

            <div className="result-body">
              {[
                { icon: '👨‍🏫', label: 'المشرف', value: result.supervisorName || '—' },
                { icon: '👤', label: 'الطالب', value: result.studentName || '—' },
                { icon: '📅', label: 'التاريخ', value: formatDate(result.date) },
                { icon: '🕐', label: 'الوقت', value: result.time || '—' },
                { icon: '⏱️', label: 'المدة', value: '30 دقيقة' },
              ].map((row, i) => (
                <div key={i} className="result-row">
                  <span className="result-label">{row.icon} {row.label}</span>
                  <span className="result-value">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="result-actions">
              {result.status === 'confirmed' && (
                <p style={{color:'#64748B',fontSize:13,marginTop:16}}>
                  استخدم الرابط الآمن المرسل إلى بريدك الإلكتروني لإدارة الحجز أو إلغائه.
                </p>
              )}
              <Link href="/ar" className="btn-home">
                ← العودة للرئيسية
              </Link>
            </div>
          </div>
        )}

        <div className="footer-note">
          منصة الإشراف الأكاديمي · <a href="https://sulukera.com" target="_blank">سلوكيرا</a>
        </div>
      </div>
    </>
  );
}
