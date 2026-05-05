import Link from 'next/link';

interface HomePageProps {
  params: { locale: string };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  let supervisors: any[] = [];

  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const snap = await adminDb.collection('supervisors').get();
    supervisors = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((s: any) => s.isActive === true);
  } catch (error) {
    console.error('Firestore error:', error);
    supervisors = [];
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }

        :root {
          --white:      #F3FCFF;
          --neon:       #55D7FF;
          --primary:    #0D40FC;
          --deep:       #001442;
          --black:      #020716;
          --gray-50:    #F8FAFC;
          --gray-100:   #EEF2F7;
          --gray-200:   #D1D9E6;
          --gray-400:   #94A3B8;
          --gray-600:   #475569;
        }

        body { background: var(--white); direction: rtl; color: var(--deep); }

        /* ── NAV ── */
        .nav {
          background: var(--deep);
          height: 68px; padding: 0 48px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 2px 20px rgba(1,20,66,0.2);
        }
        .nav-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        .brand-mark {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, var(--primary), var(--neon));
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 900; color: #fff;
          box-shadow: 0 4px 12px rgba(13,64,252,0.4);
        }
        .brand-text { display: flex; flex-direction: column; line-height: 1.1; }
        .brand-ar { font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
        .brand-en { font-size: 10px; font-weight: 500; color: var(--neon); letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.8; }

        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-lang {
          color: var(--neon); text-decoration: none; font-size: 13px; font-weight: 600;
          padding: 6px 14px; border-radius: 8px;
          border: 1px solid rgba(85,215,255,0.25);
          transition: all 0.18s;
        }
        .nav-lang:hover { background: rgba(85,215,255,0.1); border-color: rgba(85,215,255,0.5); }

        /* ── HERO ── */
        .hero {
          background: linear-gradient(160deg, var(--deep) 0%, #002080 50%, var(--primary) 100%);
          padding: 80px 48px 72px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 60% 50%, rgba(85,215,255,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(85,215,255,0.12);
          border: 1px solid rgba(85,215,255,0.3);
          color: var(--neon); font-size: 12px; font-weight: 600;
          padding: 6px 16px; border-radius: 20px;
          margin-bottom: 24px; letter-spacing: 0.05em;
        }
        .hero h1 {
          font-size: clamp(28px,5vw,48px); font-weight: 800; color: #fff;
          line-height: 1.2; margin-bottom: 16px;
          max-width: 720px; margin-left: auto; margin-right: auto;
        }
        .hero h1 span { color: var(--neon); }
        .hero-desc {
          font-size: 16px; color: rgba(255,255,255,0.65); max-width: 520px;
          margin: 0 auto 16px; line-height: 1.7;
        }
        .hero-desc2 {
          font-size: 14px; color: rgba(255,255,255,0.4); max-width: 480px;
          margin: 0 auto 40px; line-height: 1.6;
        }
        .hero-stats {
          display: inline-flex; gap: 40px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 16px 32px;
        }
        .hero-stat { text-align: center; }
        .hero-stat-num { font-size: 26px; font-weight: 800; color: var(--neon); }
        .hero-stat-lbl { font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 500; }

        /* ── SECTION ── */
        .section { max-width: 1200px; margin: 0 auto; padding: 56px 40px; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
        .section-title-wrap { display: flex; align-items: center; gap: 12px; }
        .section-line {
          width: 4px; height: 28px; border-radius: 2px;
          background: linear-gradient(to bottom, var(--primary), var(--neon));
        }
        .section-title { font-size: 22px; font-weight: 800; color: var(--deep); }
        .section-sub { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .section-count {
          background: rgba(13,64,252,0.07); color: var(--primary);
          font-size: 13px; font-weight: 700;
          padding: 4px 14px; border-radius: 20px;
          border: 1px solid rgba(13,64,252,0.15);
        }

        /* ── GRID ── */
        .supervisors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        /* ── SUPERVISOR CARD ── */
        .sup-card {
          background: #fff;
          border: 1px solid var(--gray-200);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(1,20,66,0.06);
          transition: all 0.22s;
          display: flex; flex-direction: column;
        }
        .sup-card:hover {
          box-shadow: 0 12px 32px rgba(13,64,252,0.14);
          transform: translateY(-4px);
          border-color: rgba(13,64,252,0.2);
        }
        .sup-card-top {
          background: linear-gradient(135deg, var(--deep) 0%, #001d6e 100%);
          padding: 24px 24px 0;
          display: flex; gap: 16px; align-items: flex-end;
        }
        .sup-avatar-wrap {
          width: 72px; height: 72px; border-radius: 16px; overflow: hidden;
          border: 3px solid rgba(255,255,255,0.15);
          background: linear-gradient(135deg, var(--primary), var(--neon));
          display: flex; align-items: center; justify-content: center;
          font-size: 28px; font-weight: 800; color: #fff;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .sup-avatar-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .sup-card-name-area { padding-bottom: 16px; flex: 1; }
        .sup-name { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .sup-spec {
          display: inline-block;
          background: rgba(85,215,255,0.15);
          color: var(--neon); font-size: 11px; font-weight: 600;
          padding: 2px 10px; border-radius: 20px;
          border: 1px solid rgba(85,215,255,0.25);
        }

        .sup-card-body { padding: 20px 24px; flex: 1; display: flex; flex-direction: column; }
        .sup-bio {
          font-size: 13px; color: var(--gray-600); line-height: 1.65;
          margin-bottom: 16px; flex: 1;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .sup-stats { display: flex; gap: 0; margin-bottom: 18px; border: 1px solid var(--gray-100); border-radius: 12px; overflow: hidden; }
        .sup-stat { flex: 1; padding: 10px 8px; text-align: center; background: var(--gray-50); }
        .sup-stat:not(:last-child) { border-left: 1px solid var(--gray-100); }
        .sup-stat-v { font-size: 18px; font-weight: 800; color: var(--deep); line-height: 1; }
        .sup-stat-l { font-size: 10px; color: var(--gray-400); font-weight: 500; margin-top: 2px; }

        .stars { color: #FBBF24; font-size: 14px; letter-spacing: 1px; }
        .stars-empty { color: var(--gray-200); }

        .sup-btn {
          display: block; width: 100%; text-align: center;
          background: var(--primary);
          color: #fff; text-decoration: none;
          font-size: 14px; font-weight: 700;
          padding: 12px; border-radius: 12px;
          box-shadow: 0 3px 10px rgba(13,64,252,0.25);
          transition: all 0.18s;
        }
        .sup-btn:hover {
          background: #0935d4;
          box-shadow: 0 6px 18px rgba(13,64,252,0.35);
          transform: translateY(-1px);
        }

        /* ── EMPTY ── */
        .empty-state {
          text-align: center; padding: 80px 24px;
          background: #fff; border-radius: 20px;
          border: 1px solid var(--gray-100);
        }
        .empty-ico { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .empty-txt { color: var(--gray-400); font-size: 15px; }

        /* ── HOW ── */
        .how-section {
          background: linear-gradient(135deg, var(--deep) 0%, #001d6e 100%);
          padding: 56px 48px;
        }
        .how-title { text-align: center; font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .how-sub { text-align: center; color: rgba(255,255,255,0.45); font-size: 14px; margin-bottom: 40px; }
        .how-steps { display: flex; gap: 24px; justify-content: center; max-width: 900px; margin: 0 auto; }
        @media(max-width:700px){ .how-steps { flex-direction: column; } }
        .how-step {
          flex: 1; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 24px 20px; text-align: center;
        }
        .how-num {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--primary); color: #fff;
          font-size: 16px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px;
          box-shadow: 0 4px 12px rgba(13,64,252,0.4);
        }
        .how-step-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .how-step-desc { font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.6; }

        /* ── FOOTER ── */
        .footer {
          background: var(--black); padding: 28px 48px;
          display: flex; align-items: center; justify-content: space-between;
        }
        @media(max-width:600px){ .footer { flex-direction: column; gap: 12px; text-align: center; } }
        .footer-brand { font-size: 16px; font-weight: 700; color: #fff; }
        .footer-brand span { color: var(--neon); }
        .footer-copy { font-size: 12px; color: rgba(255,255,255,0.25); }
      `}</style>

      <div dir="rtl">

        {/* NAV */}
        <nav className="nav">
          <div className="nav-brand">
            <div className="brand-mark">س</div>
            <div className="brand-text">
              <span className="brand-ar">سلوكيرا</span>
              <span className="brand-en">Sulukera</span>
            </div>
          </div>
          <div className="nav-right">
            <Link href={`/${locale}/booking-lookup`} style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.7)',textDecoration:'none',fontSize:13,fontWeight:500,padding:'7px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',transition:'all .18s'}}
              onMouseOver={e=>(e.currentTarget.style.background='rgba(255,255,255,0.08)')}
              onMouseOut={e=>(e.currentTarget.style.background='transparent')}>
              🔍 تتبع الحجز
            </Link>
            <Link href={`/${locale === 'ar' ? 'en' : 'ar'}`} className="nav-lang">
              {locale === 'ar' ? 'English' : 'عربي'}
            </Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-badge">🎓 منصة الإشراف الأكاديمي</div>
          <h1>احجز جلستك مع <span>مشرفك الأكاديمي</span> في دقيقتين</h1>
          <p className="hero-desc">
            سلوكيرا منصة متخصصة في تطبيق علم تحليل السلوك التطبيقي (ABA)، نربطك بأفضل المشرفين الأكاديميين المعتمدين لدعم مسيرتك المهنية.
          </p>
          <p className="hero-desc2">
            احجز موعدك بسهولة، تواصل مع مشرفك، وابدأ رحلتك نحو التميز الأكاديمي.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-num">{supervisors.length}+</div>
              <div className="hero-stat-lbl">مشرف متخصص</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">١٠٠٪</div>
              <div className="hero-stat-lbl">جلسات أونلاين</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">٢ دق</div>
              <div className="hero-stat-lbl">وقت الحجز</div>
            </div>
          </div>
        </section>

        {/* SUPERVISORS */}
        <section className="section">
          <div className="section-header">
            <div className="section-title-wrap">
              <div className="section-line" />
              <div>
                <div className="section-title">المشرفون المتاحون</div>
                <div className="section-sub">اختر مشرفك وابدأ الحجز الآن</div>
              </div>
            </div>
            {supervisors.length > 0 && (
              <span className="section-count">{supervisors.length} مشرف</span>
            )}
          </div>

          {supervisors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-ico">👨‍🏫</div>
              <div className="empty-txt">لا يوجد مشرفون متاحون حالياً، يرجى المحاولة لاحقاً</div>
            </div>
          ) : (
            <div className="supervisors-grid">
              {supervisors.map((sup) => {
                const rating = sup.ratingAverage || 0;
                const fullStars = Math.floor(rating);
                const initials = (sup.name || 'م')[0];

                return (
                  <div key={sup.id} className="sup-card">
                    <div className="sup-card-top">
                      <div className="sup-avatar-wrap">
                        {sup.photo
                          ? <img src={sup.photo} alt={sup.name} />
                          : initials
                        }
                      </div>
                      <div className="sup-card-name-area">
                        <div className="sup-name">{sup.name}</div>
                        <span className="sup-spec">مشرف أكاديمي</span>
                      </div>
                    </div>

                    <div className="sup-card-body">
                      <p className="sup-bio">{sup.bio || 'مشرف أكاديمي متخصص في تحليل السلوك التطبيقي.'}</p>

                      <div className="sup-stats">
                        <div className="sup-stat">
                          <div className="sup-stat-v">{sup.totalSessions ?? 0}</div>
                          <div className="sup-stat-l">الجلسات</div>
                        </div>
                        <div className="sup-stat">
                          <div className="sup-stat-v" style={{ color: '#FBBF24' }}>
                            {rating > 0 ? rating.toFixed(1) : '—'}
                          </div>
                          <div className="sup-stat-l">التقييم</div>
                        </div>
                        <div className="sup-stat">
                          <div className="sup-stat-v" style={{ color: '#10B981' }}>
                            {sup.availableSlots ?? '—'}
                          </div>
                          <div className="sup-stat-l">المقاعد</div>
                        </div>
                      </div>

                      {rating > 0 && (
                        <div style={{ marginBottom: 14, textAlign: 'center' }}>
                          {'★'.repeat(fullStars)}{'☆'.repeat(5 - fullStars)}
                        </div>
                      )}

                      <Link href={`/${locale}/supervisor/${sup.id}`} className="sup-btn">
                        عرض البروفايل والحجز ←
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section className="how-section">
          <div className="how-title">كيف يعمل النظام؟</div>
          <div className="how-sub">ثلاث خطوات بسيطة للبدء</div>
          <div className="how-steps">
            {[
              { n: '١', t: 'اختر مشرفك', d: 'تصفح قائمة المشرفين المتاحين واختر الأنسب لك' },
              { n: '٢', t: 'احجز موعدك', d: 'اختر التاريخ والوقت المناسب من المواعيد المتاحة' },
              { n: '٣', t: 'ابدأ الجلسة', d: 'احضر لقاءك عبر الإنترنت واستفد من خبرة المشرف' },
            ].map(s => (
              <div key={s.n} className="how-step">
                <div className="how-num">{s.n}</div>
                <div className="how-step-title">{s.t}</div>
                <div className="how-step-desc">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-brand">سلوكيرا <span>Sulukera</span></div>
          <div className="footer-copy">© {new Date().getFullYear()} جميع الحقوق محفوظة</div>
        </footer>

      </div>
    </>
  );
}
