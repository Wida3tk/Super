import Link from 'next/link';

interface Props {
  params: { locale: string };
  searchParams: { token?: string; date?: string; time?: string; supervisor?: string; meetLink?: string; };
}

export default async function BookingSuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token, date, time, supervisor, meetLink } = await searchParams;
  const manageUrl = `/${locale}/manage-booking/${token}`;

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString('ar-SA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch { return d; }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        :root{--primary:#0D40FC;--deep:#001442;--neon:#55D7FF;}
        body{background:linear-gradient(135deg,#020716 0%,#001442 60%,#0D2080 100%);min-height:100vh;direction:rtl;display:flex;align-items:center;justify-content:center;padding:24px;}

        .wrap{width:100%;max-width:520px;}

        /* CONFETTI TOP */
        .top-celebration{text-align:center;margin-bottom:24px;}
        .celebration-emoji{font-size:56px;display:block;margin-bottom:8px;animation:bounce .8s ease infinite alternate;}
        @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-10px)}}
        .celebration-title{font-size:28px;font-weight:800;color:#fff;margin-bottom:6px;}
        .celebration-sub{font-size:14px;color:rgba(255,255,255,0.5);}

        /* CARD */
        .card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.4);}

        /* SESSION DETAILS */
        .details-head{background:linear-gradient(135deg,var(--primary),#0929b4);padding:20px 28px;display:flex;align-items:center;gap:12px;}
        .details-icon{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;}
        .details-title{font-size:15px;font-weight:700;color:#fff;}
        .details-sub{font-size:12px;color:rgba(255,255,255,0.55);margin-top:2px;}

        .details-body{padding:0 28px;}
        .detail-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #F1F5F9;}
        .detail-row:last-child{border-bottom:none;}
        .detail-label{font-size:13px;color:#8898AA;display:flex;align-items:center;gap:6px;}
        .detail-value{font-size:13px;font-weight:700;color:#001442;text-align:left;}

        /* MEET LINK */
        .meet-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 28px 20px;background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.25);color:#059669;text-decoration:none;font-size:14px;font-weight:700;padding:13px;border-radius:14px;transition:all .18s;}
        .meet-btn:hover{background:rgba(16,185,129,0.15);}

        /* PROTOCOL */
        .protocol{margin:0 28px 20px;background:rgba(245,158,11,0.06);border:1.5px solid rgba(245,158,11,0.2);border-radius:14px;padding:16px 20px;}
        .protocol-title{font-size:13px;font-weight:700;color:#d97706;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
        .protocol-item{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;font-size:12px;color:#4A5568;line-height:1.6;}
        .protocol-item:last-child{margin-bottom:0;}
        .protocol-dot{color:#d97706;font-size:16px;line-height:1.4;flex-shrink:0;}

        /* ACTIONS */
        .actions{padding:0 28px 28px;display:flex;flex-direction:column;gap:10px;}
        .btn-manage{display:flex;align-items:center;justify-content:center;gap:8px;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;text-decoration:none;font-size:13px;font-weight:600;padding:12px;border-radius:12px;transition:all .18s;}
        .btn-manage:hover{border-color:#0D40FC;color:#0D40FC;background:#fff;}
        .btn-home{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--primary);color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:12px;border-radius:12px;transition:all .18s;box-shadow:0 2px 8px rgba(13,64,252,0.3);}
        .btn-home:hover{background:#0929b4;}

        .footer-note{text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,0.3);}
        .footer-note a{color:rgba(85,215,255,0.6);text-decoration:none;}
      `}</style>

      <div className="wrap" dir="rtl">

        <div className="top-celebration">
          <span className="celebration-emoji">🎉</span>
          <div className="celebration-title">تم تأكيد حجزك!</div>
          <div className="celebration-sub">ستصلك تفاصيل الجلسة على بريدك الإلكتروني</div>
        </div>

        <div className="card">

          {/* DETAILS */}
          <div className="details-head">
            <div className="details-icon">📋</div>
            <div>
              <div className="details-title">تفاصيل الجلسة</div>
              <div className="details-sub">احتفظ بهذه المعلومات</div>
            </div>
          </div>

          <div className="details-body">
            {[
              { icon: '👨‍🏫', label: 'المشرف', value: supervisor || '—' },
              { icon: '📅', label: 'التاريخ', value: formatDate(date) },
              { icon: '🕐', label: 'الوقت', value: time || '—' },
              { icon: '⏱️', label: 'المدة', value: '30 دقيقة' },
            ].map(row => (
              <div key={row.label} className="detail-row">
                <span className="detail-label">{row.icon} {row.label}</span>
                <span className="detail-value">{row.value}</span>
              </div>
            ))}
          </div>

          {/* MEET LINK */}
          {meetLink && (
            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="meet-btn">
              🎥 انضم للجلسة عبر Google Meet
            </a>
          )}

          {/* PROTOCOL */}
          <div className="protocol">
            <div className="protocol-title">📌 تعليمات قبل الجلسة</div>
            {[
              'تأكد من استقرار اتصال الإنترنت قبل 5 دقائق',
              'احضر ورقة وقلم لتدوين الملاحظات',
              'كن في مكان هادئ خالٍ من الإزعاج',
              'افتح رابط Google Meet قبل دقيقتين من الموعد',
            ].map((item, i) => (
              <div key={i} className="protocol-item">
                <span className="protocol-dot">•</span>
                {item}
              </div>
            ))}
          </div>

          {/* ACTIONS */}
          <div className="actions">
            <Link href={manageUrl} className="btn-manage">
              ⚙️ إدارة الحجز أو الإلغاء
            </Link>
            <Link href={`/${locale}`} className="btn-home">
              🏠 العودة للرئيسية
            </Link>
          </div>

        </div>

        <div className="footer-note">
          منصة الإشراف الأكاديمي · <a href="https://sulukera.com" target="_blank">سلوكيرا</a>
        </div>
      </div>
    </>
  );
}
