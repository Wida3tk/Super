import Link from "next/link";
import { normalizeProviderPhotoUrl } from "@/lib/providerPhoto";

export const dynamic = "force-dynamic";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  let supervisors: any[] = [];
  let cms: any = {};

  try {
    const { adminDb, adminStorage } = await import("@/lib/firebase/admin");
    const [supervisorsSnap, cmsSnap] = await Promise.all([
      adminDb.collection("supervisors").get(),
      adminDb.collection("settings").doc("cms").get(),
    ]);
    supervisors = supervisorsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((s: any) => s.isActive === true);
    supervisors = await Promise.all(
      supervisors.map(async (provider: any) => {
        if (!provider.photoPath)
          return {
            ...provider,
            photo: provider.photo
              ? `/api/provider-photo?id=${encodeURIComponent(provider.id)}`
              : "",
          };
        try {
          const [signedPhoto] = await adminStorage
            .bucket()
            .file(provider.photoPath)
            .getSignedUrl({
              action: "read",
              expires: Date.now() + 60 * 60 * 1000,
            });
          return { ...provider, photo: signedPhoto };
        } catch {
          return {
            ...provider,
            photo: normalizeProviderPhotoUrl(provider.photo),
          };
        }
      }),
    );
    cms = cmsSnap.exists ? cmsSnap.data() : {};
  } catch (error) {
    supervisors = [];
  }

  const siteName = cms.siteName || "سلوكيرا";
  const siteNameEn = cms.siteNameEn || "Sulukera";
  const supervisorProviders = supervisors.filter(
    (provider) => provider.accountType !== "consultant",
  );
  const consultantProviders = supervisors.filter(
    (provider) => provider.accountType === "consultant",
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }

        :root {
          --primary:  #0D40FC;
          --deep:     #001442;
          --neon:     #55D7FF;
          --off-white:#F3FCFF;
          --gray-50:  #F8FAFC;
          --gray-100: #EEF2F7;
          --gray-200: #D1D9E6;
          --gray-400: #94A3B8;
          --gray-600: #475569;
        }

        body { background: var(--off-white); direction: rtl; color: var(--deep); }

        /* ── NAV ── */
        .nav {
          background: #fff;
          height: 68px; padding: 0 48px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 100;
          border-bottom: 1px solid var(--gray-100);
          box-shadow: 0 1px 8px rgba(1,20,66,0.06);
        }
        .nav-logo { height: 36px; width: auto; }
        .nav-right { display: flex; align-items: center; gap: 10px; }
        .nav-lookup {
          display: flex; align-items: center; gap: 6px;
          color: var(--gray-600); text-decoration: none;
          font-size: 13px; font-weight: 500;
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid var(--gray-200);
          transition: all 0.15s;
        }
        .nav-lookup:hover { background: var(--gray-50); color: var(--deep); }
        .nav-lang {
          color: var(--primary); text-decoration: none;
          font-size: 13px; font-weight: 600;
          padding: 6px 14px; border-radius: 8px;
          border: 1px solid rgba(13,64,252,0.2);
          background: rgba(13,64,252,0.04);
          transition: all 0.15s;
        }
        .nav-lang:hover { background: rgba(13,64,252,0.08); }
        .nav-login { color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 13px;border-radius:9px;background:var(--primary);box-shadow:0 3px 10px rgba(13,64,252,.2);white-space:nowrap }
        .nav-login.trainee{background:#fff;color:var(--primary);border:1px solid rgba(13,64,252,.25);box-shadow:none}.nav-login.signup{background:var(--deep)}
        .portal-note{max-width:760px;margin:18px auto 0;padding:12px 16px;border-radius:12px;background:#ffffffb8;border:1px solid var(--gray-200);font-size:12px;color:var(--gray-600)}

        /* ── HERO ── */
        .hero {
          background: linear-gradient(160deg, #f0f5ff 0%, var(--off-white) 60%);
          padding: 80px 48px 72px;
          text-align: center;
          border-bottom: 1px solid var(--gray-100);
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute;
          top: -100px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 700px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(13,64,252,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: #fff;
          border: 1px solid var(--gray-200);
          color: var(--primary); font-size: 12px; font-weight: 600;
          padding: 5px 14px; border-radius: 20px;
          margin-bottom: 28px;
          box-shadow: 0 1px 4px rgba(1,20,66,0.06);
        }
        .hero-badge-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #0D40FC;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .hero h1 {
          font-size: clamp(30px, 4.5vw, 52px);
          font-weight: 800;
          color: var(--deep);
          line-height: 1.2;
          margin-bottom: 10px;
        }
        .hero h1 span { color: var(--primary); }
        .hero-sub {
          font-size: clamp(16px, 2vw, 20px);
          font-weight: 400;
          color: var(--gray-600);
          margin-bottom: 32px;
        }
        .hero-cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--deep); color: #fff;
          text-decoration: none; font-size: 15px; font-weight: 700;
          padding: 14px 28px; border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,20,66,0.25);
          transition: all 0.18s;
          margin-bottom: 48px;
        }
        .hero-cta:hover { background: var(--primary); box-shadow: 0 6px 20px rgba(13,64,252,0.35); transform: translateY(-2px); }
        .hero-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:42px}.hero-actions .hero-cta{margin-bottom:0}.hero-cta.secondary{background:#fff;color:var(--deep);border:1px solid var(--gray-200);box-shadow:0 2px 10px rgba(1,20,66,.08)}
        .hero-stats {
          display: inline-flex; gap: 0;
          background: #fff;
          border: 1px solid var(--gray-200);
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 2px 8px rgba(1,20,66,0.06);
        }
        .hero-stat { padding: 16px 32px; text-align: center; }
        .hero-stat:not(:last-child) { border-left: 1px solid var(--gray-100); }
        .hero-stat-num { font-size: 24px; font-weight: 800; color: var(--deep); }
        .hero-stat-lbl { font-size: 11px; color: var(--gray-400); font-weight: 500; margin-top: 2px; }
        .services{max-width:1080px;margin:-34px auto 0;position:relative;z-index:3;padding:0 24px}.services-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.service-card{background:#fff;border:1px solid var(--gray-200);border-radius:20px;padding:24px;box-shadow:0 12px 34px rgba(1,20,66,.1);display:flex;gap:16px;align-items:flex-start}.service-icon{width:48px;height:48px;border-radius:14px;background:#EEF4FF;color:var(--primary);display:grid;place-items:center;font-size:22px;flex:none}.service-card.consult .service-icon{background:#ECFDF5;color:#047857}.service-card h2{font-size:18px;margin-bottom:5px}.service-card p{font-size:13px;color:var(--gray-600);line-height:1.7}.service-link{display:inline-block;margin-top:12px;color:var(--primary);font-size:13px;font-weight:800;text-decoration:none}.consult .service-link{color:#047857}.sup-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sup-actions .sup-btn{font-size:12px;padding:10px}.sup-btn.consult{background:#fff;color:#047857;border:1px solid #A7F3D0;box-shadow:none}

        /* ── SUPERVISORS ── */
        .section { max-width: 1200px; margin: 0 auto; padding: 56px 40px; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
        .section-title-wrap { display: flex; align-items: center; gap: 12px; }
        .section-line { width: 4px; height: 28px; border-radius: 2px; background: var(--primary); }
        .section-title { font-size: 22px; font-weight: 800; color: var(--deep); }
        .section-sub { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .section-count {
          background: rgba(13,64,252,0.07); color: var(--primary);
          font-size: 13px; font-weight: 700;
          padding: 4px 14px; border-radius: 20px;
          border: 1px solid rgba(13,64,252,0.15);
        }

        .supervisors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .sup-card {
          background: #fff;
          border: 1px solid var(--gray-200);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(1,20,66,0.05);
          transition: all 0.22s;
          display: flex; flex-direction: column;
        }
        .sup-card:hover {
          box-shadow: 0 12px 32px rgba(13,64,252,0.12);
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
        .sup-btn {
          display: block; width: 100%; text-align: center;
          background: var(--primary); color: #fff; text-decoration: none;
          font-size: 14px; font-weight: 700;
          padding: 12px; border-radius: 12px;
          box-shadow: 0 3px 10px rgba(13,64,252,0.2);
          transition: all 0.18s;
        }
        .sup-btn:hover { background: #0935d4; transform: translateY(-1px); }

        /* ── HOW ── */
        .how-section {
          background: var(--deep);
          padding: 64px 48px;
        }
        .how-title { text-align: center; font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .how-sub { text-align: center; color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 48px; }
        .how-steps { display: flex; gap: 20px; justify-content: center; max-width: 900px; margin: 0 auto; }
        @media(max-width:700px){ .how-steps { flex-direction: column; } }
        .how-step {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 28px 20px; text-align: center;
          transition: all 0.2s;
        }
        .how-step:hover { background: rgba(255,255,255,0.07); border-color: rgba(85,215,255,0.2); }
        .how-num {
          width: 44px; height: 44px; border-radius: 50%;
          background: var(--primary); color: #fff;
          font-size: 18px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 4px 12px rgba(13,64,252,0.4);
        }
        .how-step-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .how-step-desc { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.7; }

        /* ── EMPTY ── */
        .empty-state {
          text-align: center; padding: 80px 24px;
          background: #fff; border-radius: 20px;
          border: 1px solid var(--gray-100);
        }
        .empty-ico { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .empty-txt { color: var(--gray-400); font-size: 15px; }

        /* ── FOOTER ── */
        .footer {
          background: var(--deep); padding: 28px 48px;
          display: flex; align-items: center; justify-content: space-between;
        }
        @media(max-width:600px){ .footer { flex-direction: column; gap: 12px; text-align: center; } }
        .footer-copy { font-size: 12px; color: rgba(255,255,255,0.25); }

        @media(max-width:768px){
          .nav { padding: 0 20px; }
          .nav-lookup { display:none; }
          .nav-login { padding:7px 9px;font-size:10px; }
          .nav-lang{display:none}.nav{height:auto;min-height:68px;padding-top:8px;padding-bottom:8px}.nav-right{flex-wrap:wrap;justify-content:flex-start}
          .hero { padding: 56px 24px 48px; }
          .hero-stats { flex-direction: column; }
          .section { padding: 40px 20px; }
          .how-section { padding: 48px 24px; }
          .footer { padding: 24px 20px; }
          .services-grid{grid-template-columns:1fr}.services{margin-top:-20px}.service-card{padding:18px}.sup-actions{grid-template-columns:1fr}
        }
      `}</style>

      <div dir="rtl">
        {/* NAV */}
        <nav className="nav">
          <img src="/logo.svg" alt="سلوكيرا" className="nav-logo" />
          <div className="nav-right">
            <Link href={`/${locale}/register`} className="nav-login signup">
              تسجيل جديد
            </Link>
            <Link
              href={`/${locale}/login?portal=provider`}
              className="nav-login"
            >
              دخول المشرف | المستشار
            </Link>
            <Link
              href={`/${locale}/login?portal=trainee`}
              className="nav-login trainee"
            >
              دخول المتدرب
            </Link>
            <Link
              href={`/${locale === "ar" ? "en" : "ar"}`}
              className="nav-lang"
            >
              {locale === "ar" ? "English" : "عربي"}
            </Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-badge">
            <div className="hero-badge-dot"></div>
            إشراف واستشارات مهنية في تحليل السلوك وإدارة السلوك التنظيمي عن بُعد
          </div>
          <h1>
            الواجهة الموحّدة <span>للإشراف</span>
          </h1>
          <p className="hero-sub">
            مكان واحد لاختيار المشرف، حجز المقابلة الأولية، الاستشارات المهنية،
            ومتابعة رحلة الإشراف
          </p>
          <div className="hero-actions">
            <a href="#supervisors" className="hero-cta">
              احجز مقابلة أولية ←
            </a>
            <a href="#consultants" className="hero-cta secondary">
              احجز استشارة
            </a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-num">
                {supervisors.length > 0 ? `+${supervisors.length}` : "٣+"}
              </div>
              <div className="hero-stat-lbl">مشرف معتمد</div>
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
          <div className="portal-note">
            لديك حساب قائم؟ ادخل إلى بوابتك لمتابعة الساعات، خطط الإشراف،
            التقييمات ومحاضر الاجتماعات.
          </div>
        </section>

        <section
          className="services"
          id="services"
          aria-label="خدمات الواجهة الموحدة"
        >
          <div className="services-grid">
            <article className="service-card">
              <div className="service-icon">↗</div>
              <div>
                <h2>احجز مقابلة أولية</h2>
                <p>
                  لقاء تعارفي مع مشرف لمناقشة أهدافك المهنية، توضيح آلية الإشراف
                  ومتطلباته، والإجابة عن أسئلتك قبل اتخاذ قرار البدء.
                </p>
                <a href="#supervisors" className="service-link">
                  اختيار المشرف ←
                </a>
              </div>
            </article>
            <article className="service-card consult">
              <div className="service-icon">✦</div>
              <div>
                <h2>احجز استشارة</h2>
                <p>
                  جلسة مهنية متخصصة في تحليل السلوك أو إدارة السلوك التنظيمي،
                  مصممة وفق احتياج الفرد أو المؤسسة.
                </p>
                <a href="#consultants" className="service-link">
                  اختيار المستشار ←
                </a>
              </div>
            </article>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how-section">
          <div className="how-title">كيف تبدأ؟</div>
          <div className="how-sub">
            ثلاث خطوات واضحة للوصول إلى الخدمة المناسبة
          </div>
          <div className="how-steps">
            {[
              {
                n: "١",
                t: "اختر نوع الخدمة",
                d: "حدد مقابلة أولية لبدء الإشراف أو استشارة مهنية في المجال المناسب.",
              },
              {
                n: "٢",
                t: "اختر مقدم الخدمة",
                d: "تصفح قائمة المشرفين أو المستشارين واختر الخبرة الأنسب لاحتياجك.",
              },
              {
                n: "٣",
                t: "أنشئ حسابك واحجز",
                d: "اختر الموعد، أنشئ حسابك مرة واحدة، ثم تابع مواعيدك من لوحة واحدة.",
              },
            ].map((s) => (
              <div key={s.n} className="how-step">
                <div className="how-num">{s.n}</div>
                <div className="how-step-title">{s.t}</div>
                <div className="how-step-desc">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* SUPERVISORS */}
        <section className="section" id="supervisors">
          <div className="section-header">
            <div className="section-title-wrap">
              <div className="section-line" />
              <div>
                <div className="section-title">المشرفون المتاحون</div>
                <div className="section-sub">
                  اختر مشرفًا لحجز المقابلة الأولية وبدء مسار الإشراف
                </div>
              </div>
            </div>
            {supervisorProviders.length > 0 && (
              <span className="section-count">
                {supervisorProviders.length} مشرف
              </span>
            )}
          </div>

          {supervisorProviders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-ico">👨‍🏫</div>
              <div className="empty-txt">
                لا يوجد مشرفون متاحون حالياً، يرجى المحاولة لاحقاً
              </div>
            </div>
          ) : (
            <div className="supervisors-grid">
              {supervisorProviders.map((sup) => {
                const rating = sup.ratingAverage || 0;
                const fullStars = Math.floor(rating);
                const initials = (sup.name || "م")[0];

                return (
                  <div key={sup.id} className="sup-card">
                    <div className="sup-card-top">
                      <div className="sup-avatar-wrap">
                        {sup.photo ? (
                          <img src={sup.photo} alt={sup.name} />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="sup-card-name-area">
                        <div className="sup-name">{sup.name}</div>
                        <span className="sup-spec">
                          {sup.accountType === "consultant"
                            ? "مستشار تحليل سلوك"
                            : "مشرف أكاديمي"}
                        </span>
                      </div>
                    </div>

                    <div className="sup-card-body">
                      <p className="sup-bio">
                        {sup.bio ||
                          "مشرف أكاديمي متخصص في تحليل السلوك التطبيقي."}
                      </p>

                      <div className="sup-stats">
                        <div className="sup-stat">
                          <div className="sup-stat-v">
                            {sup.totalSessions ?? 0}
                          </div>
                          <div className="sup-stat-l">الجلسات</div>
                        </div>
                        <div className="sup-stat">
                          <div
                            className="sup-stat-v"
                            style={{ color: "#FBBF24" }}
                          >
                            {rating > 0 ? rating.toFixed(1) : "—"}
                          </div>
                          <div className="sup-stat-l">التقييم</div>
                        </div>
                        <div className="sup-stat">
                          <div
                            className="sup-stat-v"
                            style={{ color: "#10B981" }}
                          >
                            {sup.availableSeats ?? "—"}
                          </div>
                          <div className="sup-stat-l">المقاعد</div>
                        </div>
                      </div>

                      <div
                        className="sup-actions"
                        style={{ gridTemplateColumns: "1fr" }}
                      >
                        {sup.accountType === "consultant" ? (
                          <Link
                            href={`/${locale}/supervisor/${sup.id}?type=consultation`}
                            className="sup-btn consult"
                          >
                            احجز استشارة
                          </Link>
                        ) : (
                          <Link
                            href={`/${locale}/supervisor/${sup.id}?type=initial_interview`}
                            className="sup-btn"
                          >
                            احجز مقابلة أولية
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="section" id="consultants" style={{ paddingTop: 0 }}>
          <div className="section-header">
            <div className="section-title-wrap">
              <div className="section-line" style={{ background: "#047857" }} />
              <div>
                <div className="section-title">المستشارون المتاحون</div>
                <div className="section-sub">
                  اختر المستشار المناسب لاحتياجك في تحليل السلوك أو إدارة السلوك
                  التنظيمي
                </div>
              </div>
            </div>
            {consultantProviders.length > 0 && (
              <span
                className="section-count"
                style={{
                  color: "#047857",
                  background: "#ECFDF5",
                  borderColor: "#A7F3D0",
                }}
              >
                {consultantProviders.length} مستشار
              </span>
            )}
          </div>
          {consultantProviders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-ico">✦</div>
              <div className="empty-txt">لا يوجد مستشارون متاحون حاليًا</div>
            </div>
          ) : (
            <div className="supervisors-grid">
              {consultantProviders.map((consultant) => (
                <div key={consultant.id} className="sup-card">
                  <div className="sup-card-top">
                    <div className="sup-avatar-wrap">
                      {consultant.photo ? (
                        <img src={consultant.photo} alt={consultant.name} />
                      ) : (
                        (consultant.name || "م")[0]
                      )}
                    </div>
                    <div className="sup-card-name-area">
                      <div className="sup-name">{consultant.name}</div>
                      <span className="sup-spec">مستشار مهني</span>
                    </div>
                  </div>
                  <div className="sup-card-body">
                    <p className="sup-bio">
                      {consultant.bio ||
                        "مستشار متخصص يقدم استشارات مهنية في تحليل السلوك وإدارة السلوك التنظيمي وفق طبيعة الاحتياج."}
                    </p>
                    <div className="sup-stats">
                      <div className="sup-stat">
                        <div className="sup-stat-v">
                          {consultant.totalSessions ?? 0}
                        </div>
                        <div className="sup-stat-l">الاستشارات</div>
                      </div>
                      <div className="sup-stat">
                        <div
                          className="sup-stat-v"
                          style={{ color: "#FBBF24" }}
                        >
                          {consultant.ratingAverage
                            ? consultant.ratingAverage.toFixed(1)
                            : "—"}
                        </div>
                        <div className="sup-stat-l">التقييم</div>
                      </div>
                    </div>
                    <Link
                      href={`/${locale}/supervisor/${consultant.id}?type=consultation`}
                      className="sup-btn consult"
                    >
                      احجز استشارة
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <img
            src="/logo.svg"
            alt="سلوكيرا"
            style={{
              height: "28px",
              width: "auto",
              filter: "brightness(0) invert(1)",
            }}
          />
          <div className="footer-copy">
            © {new Date().getFullYear()} سلوكيرا — جميع الحقوق محفوظة
          </div>
        </footer>
      </div>
    </>
  );
}
