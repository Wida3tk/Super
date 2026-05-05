import { notFound } from 'next/navigation';
import BookingSection from '@/components/booking/BookingSection';
import Link from 'next/link';

interface SupervisorPageProps {
  params: { locale: string; id: string };
}

export default async function SupervisorPage({ params }: SupervisorPageProps) {
  const { locale, id } = await params;

  let supervisor: any = null;
  let availableDates: string[] = [];
  let reviews: any[] = [];

  try {
    const { adminDb } = await import('@/lib/firebase/admin');

    const supervisorSnap = await adminDb.collection('supervisors').doc(id).get();
    if (!supervisorSnap.exists) notFound();

    supervisor = { id: supervisorSnap.id, ...supervisorSnap.data() };
    if (!supervisor.isActive) notFound();

    const slotsSnap = await adminDb.collection('availability').get();
    const dates = slotsSnap.docs
      .map(d => d.data())
      .filter(d => d.supervisorId === id && d.isBooked === false)
      .map(d => d.date as string);
    availableDates = [...new Set(dates)].sort();

    // جلب التقييمات إذا موجودة
    try {
      const reviewsSnap = await adminDb.collection('reviews')
        .where('supervisorId', '==', id).limit(5).get();
      reviews = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { reviews = []; }

  } catch (error) {
    console.error('Error:', error);
    if (!supervisor) notFound();
  }

  const rating = supervisor?.ratingAverage || 0;
  const fullStars = Math.floor(rating);
  const initials = (supervisor?.name || 'م')[0];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
        :root {
          --white: #F3FCFF; --neon: #55D7FF; --primary: #0D40FC;
          --deep: #001442; --black: #020716;
          --gray-50: #F8FAFC; --gray-100: #EEF2F7;
          --gray-200: #D1D9E6; --gray-400: #94A3B8; --gray-600: #475569;
          --success: #10B981; --warning: #F59E0B;
        }
        body { background: var(--gray-50); direction: rtl; color: var(--deep); }

        /* NAV */
        .nav {
          background: var(--deep); height: 64px; padding: 0 40px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 2px 16px rgba(1,20,66,0.2);
        }
        .nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .brand-mark {
          width: 36px; height: 36px; border-radius: 9px;
          background: linear-gradient(135deg, var(--primary), var(--neon));
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 900; color: #fff;
        }
        .brand-ar { font-size: 16px; font-weight: 800; color: #fff; }
        .nav-back {
          display: flex; align-items: center; gap: 6px;
          color: var(--neon); text-decoration: none; font-size: 13px; font-weight: 500;
          padding: 6px 14px; border-radius: 8px;
          border: 1px solid rgba(85,215,255,0.25);
          transition: all 0.18s;
        }
        .nav-back:hover { background: rgba(85,215,255,0.1); }

        /* MAIN */
        .wrap { max-width: 860px; margin: 0 auto; padding: 36px 24px 64px; }

        /* PROFILE CARD */
        .profile-card {
          background: #fff; border-radius: 24px;
          border: 1px solid var(--gray-200);
          box-shadow: 0 4px 20px rgba(1,20,66,0.08);
          overflow: hidden; margin-bottom: 24px;
        }
        .profile-top {
          background: linear-gradient(135deg, var(--deep) 0%, #002080 100%);
          padding: 32px 32px 0;
          display: flex; gap: 24px; align-items: flex-end;
        }
        .profile-avatar {
          width: 100px; height: 100px; border-radius: 20px;
          border: 3px solid rgba(255,255,255,0.2);
          background: linear-gradient(135deg, var(--primary), var(--neon));
          display: flex; align-items: center; justify-content: center;
          font-size: 40px; font-weight: 800; color: #fff;
          flex-shrink: 0; overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .profile-header-info { padding-bottom: 24px; flex: 1; }
        .profile-name { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .profile-spec {
          display: inline-block;
          background: rgba(85,215,255,0.15); color: var(--neon);
          font-size: 12px; font-weight: 600;
          padding: 3px 12px; border-radius: 20px;
          border: 1px solid rgba(85,215,255,0.25);
          margin-bottom: 10px;
        }
        .profile-stars { display: flex; align-items: center; gap: 6px; }
        .stars-display { font-size: 18px; color: #FBBF24; letter-spacing: 2px; }
        .stars-empty-c { color: rgba(255,255,255,0.15); }
        .rating-num { font-size: 14px; font-weight: 700; color: #FBBF24; }
        .rating-count { font-size: 12px; color: rgba(255,255,255,0.35); }

        .profile-body { padding: 28px 32px; }
        .bio-text { font-size: 14px; color: var(--gray-600); line-height: 1.8; margin-bottom: 24px; }

        .kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }
        .kpi {
          background: var(--gray-50); border: 1px solid var(--gray-100);
          border-radius: 14px; padding: 16px 12px; text-align: center;
          transition: all 0.18s;
        }
        .kpi:hover { border-color: rgba(13,64,252,0.2); box-shadow: 0 4px 12px rgba(13,64,252,0.08); }
        .kpi-icon { font-size: 20px; margin-bottom: 6px; }
        .kpi-val { font-size: 26px; font-weight: 800; color: var(--deep); margin-bottom: 2px; }
        .kpi-lbl { font-size: 11px; color: var(--gray-400); font-weight: 500; }

        .avail-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          color: #059669; font-size: 13px; font-weight: 600;
          padding: 8px 16px; border-radius: 10px;
        }
        .avail-badge .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #059669;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.2)} }

        /* REVIEWS */
        .reviews-card {
          background: #fff; border-radius: 20px;
          border: 1px solid var(--gray-200);
          box-shadow: 0 2px 8px rgba(1,20,66,0.05);
          padding: 24px; margin-bottom: 24px;
        }
        .reviews-title {
          font-size: 16px; font-weight: 700; color: var(--deep);
          margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .reviews-title::before {
          content: ''; display: block;
          width: 4px; height: 20px; border-radius: 2px;
          background: linear-gradient(to bottom, var(--primary), var(--neon));
        }
        .review-item {
          padding: 16px 0;
          border-bottom: 1px solid var(--gray-100);
        }
        .review-item:last-child { border-bottom: none; padding-bottom: 0; }
        .review-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .review-author { font-size: 13px; font-weight: 600; color: var(--deep); }
        .review-stars { color: #FBBF24; font-size: 13px; }
        .review-text { font-size: 13px; color: var(--gray-600); line-height: 1.65; }

        .no-reviews { text-align: center; color: var(--gray-400); font-size: 14px; padding: 16px 0; }

        /* BOOKING */
        .booking-card {
          background: #fff; border-radius: 20px;
          border: 1px solid var(--gray-200);
          box-shadow: 0 2px 8px rgba(1,20,66,0.05);
          overflow: hidden;
        }
        .booking-head {
          background: linear-gradient(135deg, var(--primary) 0%, #0929b4 100%);
          padding: 20px 28px;
          display: flex; align-items: center; gap: 10px;
        }
        .booking-head-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .booking-head-title { font-size: 16px; font-weight: 700; color: #fff; }
        .booking-head-sub { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 1px; }
        .booking-body { padding: 28px; }
      `}</style>

      <div dir="rtl">

        {/* NAV */}
        <nav className="nav">
          <div className="nav-brand">
            <div className="brand-mark">س</div>
            <span className="brand-ar">سلوكيرا</span>
          </div>
          <Link href={`/${locale}`} className="nav-back">← العودة للرئيسية</Link>
        </nav>

        <div className="wrap">

          {/* PROFILE CARD */}
          <div className="profile-card">
            <div className="profile-top">
              <div className="profile-avatar">
                {supervisor?.photo
                  ? <img src={supervisor.photo} alt={supervisor.name} />
                  : initials
                }
              </div>
              <div className="profile-header-info">
                <div className="profile-name">{supervisor?.name}</div>
                <div className="profile-spec">مشرف أكاديمي · ABA</div>
                {rating > 0 && (
                  <div className="profile-stars">
                    <span className="stars-display">
                      {'★'.repeat(fullStars)}<span className="stars-empty-c">{'★'.repeat(5 - fullStars)}</span>
                    </span>
                    <span className="rating-num">{rating.toFixed(1)}</span>
                    <span className="rating-count">({reviews.length} تقييم)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="profile-body">
              {supervisor?.bio && (
                <p className="bio-text">{supervisor.bio}</p>
              )}

              <div className="kpis">
                <div className="kpi">
                  <div className="kpi-icon">📚</div>
                  <div className="kpi-val">{supervisor?.totalSessions ?? 0}</div>
                  <div className="kpi-lbl">إجمالي الجلسات</div>
                </div>
                <div className="kpi">
                  <div className="kpi-icon">⭐</div>
                  <div className="kpi-val" style={{ color: '#F59E0B' }}>
                    {rating > 0 ? rating.toFixed(1) : '—'}
                  </div>
                  <div className="kpi-lbl">متوسط التقييم</div>
                </div>
                <div className="kpi">
                  <div className="kpi-icon">📅</div>
                  <div className="kpi-val" style={{ color: '#10B981' }}>{availableDates.length}</div>
                  <div className="kpi-lbl">أيام متاحة</div>
                </div>
              </div>

              {availableDates.length > 0 ? (
                <div className="avail-badge">
                  <div className="dot" />
                  متاح للحجز — {availableDates.length} يوم متاح
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#EF4444', background: 'rgba(239,68,68,0.06)', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)', display: 'inline-block' }}>
                  ● لا توجد مواعيد متاحة حالياً
                </div>
              )}
            </div>
          </div>

          {/* REVIEWS */}
          <div className="reviews-card">
            <div className="reviews-title">آراء الطلاب</div>
            {reviews.length === 0 ? (
              <div className="no-reviews">لا توجد تقييمات بعد — كن أول من يقيّم!</div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="review-item">
                  <div className="review-top">
                    <span className="review-author">{r.studentName || 'طالب'}</span>
                    <span className="review-stars">
                      {'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}
                    </span>
                  </div>
                  {r.comment && <p className="review-text">{r.comment}</p>}
                </div>
              ))
            )}
          </div>

          {/* BOOKING */}
          <div className="booking-card">
            <div className="booking-head">
              <div className="booking-head-icon">🗓</div>
              <div>
                <div className="booking-head-title">احجز جلستك الآن</div>
                <div className="booking-head-sub">اختر التاريخ والوقت المناسب لك</div>
              </div>
            </div>
            <div className="booking-body">
              <BookingSection
                supervisor={supervisor}
                availableDates={availableDates}
                locale={locale}
              />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
