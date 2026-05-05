import { getBookingByToken } from '@/lib/actions/bookingActions';
import CancelBookingClient from '@/components/booking/CancelBookingClient';
import Link from 'next/link';

interface Props { params: { locale: string; token: string }; }

export default async function ManageBookingPage({ params }: Props) {
  const { locale, token } = await params;
  const booking = await getBookingByToken(token);

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d; }
  };

  const statusInfo: Record<string, { label: string; color: string; bg: string; border: string }> = {
    confirmed: { label: '✓ مؤكد', color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    cancelled: { label: '✕ ملغى', color: '#dc2626', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
    completed: { label: '✓ مكتمل', color: '#0D40FC', bg: 'rgba(13,64,252,0.08)', border: 'rgba(13,64,252,0.2)' },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        body{background:linear-gradient(135deg,#020716 0%,#001442 60%,#0D2080 100%);min-height:100vh;direction:rtl;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;}

        .wrap{width:100%;max-width:480px;}
        .top{text-align:center;margin-bottom:24px;}
        .top-icon{font-size:44px;display:block;margin-bottom:10px;}
        .top-title{font-size:24px;font-weight:800;color:#fff;margin-bottom:4px;}
        .top-sub{font-size:13px;color:rgba(255,255,255,0.45);}

        .card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.4);}

        .card-head{background:linear-gradient(135deg,#0D40FC,#001442);padding:18px 28px;display:flex;align-items:center;gap:12px;}
        .head-icon{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;}
        .head-title{font-size:15px;font-weight:700;color:#fff;}
        .head-sub{font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;}

        .card-body{padding:0 28px;}
        .detail-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #F1F5F9;}
        .detail-row:last-child{border-bottom:none;}
        .detail-label{font-size:13px;color:#8898AA;display:flex;align-items:center;gap:6px;}
        .detail-value{font-size:13px;font-weight:700;color:#001442;text-align:left;}
        .status-chip{font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;border:1.5px solid;}

        .card-footer{padding:20px 28px;display:flex;flex-direction:column;gap:10px;border-top:1px solid #F1F5F9;}

        .btn-meet{display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.25);color:#059669;text-decoration:none;font-size:13px;font-weight:700;padding:12px;border-radius:12px;transition:all .18s;}
        .btn-meet:hover{background:rgba(16,185,129,0.15);}
        .btn-home{display:flex;align-items:center;justify-content:center;gap:8px;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;text-decoration:none;font-size:13px;font-weight:600;padding:12px;border-radius:12px;transition:all .18s;}
        .btn-home:hover{border-color:#0D40FC;color:#0D40FC;}
        .btn-new{display:flex;align-items:center;justify-content:center;gap:8px;background:#0D40FC;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:12px;border-radius:12px;box-shadow:0 2px 8px rgba(13,64,252,0.3);}

        .not-found{text-align:center;background:#fff;border-radius:24px;padding:48px 32px;box-shadow:0 24px 64px rgba(0,0,0,0.4);}
        .not-found-icon{font-size:48px;margin-bottom:16px;}
        .not-found-title{font-size:18px;font-weight:700;color:#001442;margin-bottom:8px;}
        .not-found-sub{font-size:13px;color:#8898AA;margin-bottom:24px;}
        .footer-note{text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,0.3);}
        .footer-note a{color:rgba(85,215,255,0.6);text-decoration:none;}
      `}</style>

      <div className="wrap" dir="rtl">

        {!booking ? (
          <>
            <div className="not-found">
              <div className="not-found-icon">🔍</div>
              <div className="not-found-title">الحجز غير موجود</div>
              <div className="not-found-sub">الرابط غير صحيح أو انتهت صلاحيته</div>
              <Link href={`/${locale}`} className="btn-new" style={{display:'inline-flex',padding:'12px 28px',textDecoration:'none',borderRadius:12}}>
                🏠 العودة للرئيسية
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="top">
              <span className="top-icon">⚙️</span>
              <div className="top-title">إدارة حجزك</div>
              <div className="top-sub">يمكنك مراجعة تفاصيل حجزك أو إلغائه</div>
            </div>

            <div className="card">
              <div className="card-head">
                <div className="head-icon">📋</div>
                <div>
                  <div className="head-title">تفاصيل الحجز</div>
                  <div className="head-sub">رقم الحجز: {token?.slice(0,8)}...</div>
                </div>
              </div>

              <div className="card-body">
                {[
                  { icon: '🔖', label: 'الحالة', value: (() => {
                    const s = statusInfo[booking.status] || statusInfo.confirmed;
                    return <span className="status-chip" style={{color:s.color,background:s.bg,borderColor:s.border}}>{s.label}</span>;
                  })() },
                  { icon: '👨‍🏫', label: 'المشرف', value: booking.supervisorName || '—' },
                  { icon: '📅', label: 'التاريخ', value: formatDate(booking.date) },
                  { icon: '🕐', label: 'الوقت', value: booking.time || '—' },
                  { icon: '👤', label: 'الطالب', value: booking.studentName || '—' },
                ].map((row, i) => (
                  <div key={i} className="detail-row">
                    <span className="detail-label">{row.icon} {row.label}</span>
                    <span className="detail-value">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="card-footer">
                {booking.meetLink && booking.status === 'confirmed' && (
                  <a href={booking.meetLink} target="_blank" rel="noopener noreferrer" className="btn-meet">
                    🎥 انضم للجلسة عبر Google Meet
                  </a>
                )}

                {booking.status === 'confirmed' && (
                  <CancelBookingClient token={token} locale={locale} />
                )}

                {booking.status === 'cancelled' && (
                  <Link href={`/${locale}`} className="btn-new">
                    📅 حجز جلسة جديدة
                  </Link>
                )}

                <Link href={`/${locale}`} className="btn-home">
                  ← العودة للرئيسية
                </Link>
              </div>
            </div>
          </>
        )}

        <div className="footer-note">
          منصة الإشراف الأكاديمي · <a href="https://sulukera.com" target="_blank">سلوكيرا</a>
        </div>
      </div>
    </>
  );
}
