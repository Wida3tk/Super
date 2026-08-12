import { notFound } from "next/navigation";
import BookingSection from "@/components/booking/BookingSection";
import Link from "next/link";
import { normalizeProviderPhotoUrl } from "@/lib/providerPhoto";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function SupervisorPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const query = await searchParams;
  let bookingType: "initial_interview" | "consultation" =
    query.type === "consultation" ? "consultation" : "initial_interview";

  let supervisor: any = null;
  let availableDates: string[] = [];
  let reviews: any[] = [];

  try {
    const { adminDb, adminStorage } = await import("@/lib/firebase/admin");
    const snap = await adminDb.collection("supervisors").doc(id).get();
    if (!snap.exists) notFound();
    supervisor = { id: snap.id, ...snap.data() };
    if (!supervisor.isActive) notFound();
    if (supervisor.photoPath) {
      try {
        const [signedPhoto] = await adminStorage
          .bucket()
          .file(supervisor.photoPath)
          .getSignedUrl({
            action: "read",
            expires: Date.now() + 60 * 60 * 1000,
          });
        supervisor.photo = signedPhoto;
      } catch {}
    } else if (supervisor.photo) {
      supervisor.photo = `/api/provider-photo?id=${encodeURIComponent(id)}`;
    }

    const today = new Date().toISOString().split("T")[0];
    const slotsSnap = await adminDb
      .collection("availability")
      .where("supervisorId", "==", id)
      .where("isBooked", "==", false)
      .where("date", ">=", today)
      .get();

    const dates = slotsSnap.docs.map((d) => d.data().date as string);
    availableDates = [...new Set(dates)].sort();

    try {
      const rSnap = await adminDb
        .collection("reviews")
        .where("supervisorId", "==", id)
        .limit(5)
        .get();
      reviews = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      reviews = [];
    }
  } catch (e) {
    if (!supervisor) notFound();
  }
  bookingType =
    supervisor?.accountType === "consultant"
      ? "consultation"
      : "initial_interview";

  const rating = supervisor?.ratingAverage || 0;
  const initials = (supervisor?.name || "م")[0];
  const seats = supervisor?.availableSeats ?? 0;
  const specialization =
    supervisor?.specialization ||
    (supervisor?.accountType === "consultant"
      ? "مستشار مهني في تحليل السلوك وإدارة السلوك التنظيمي"
      : "مشرف أكاديمي");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        :root{--primary:#0D40FC;--deep:#001442;--neon:#55D7FF;--gray-50:#F8FAFC;--gray-100:#EEF2F7;--gray-200:#D1D9E6;--gray-400:#94A3B8;--gray-600:#475569;--success:#10B981;--warning:#F59E0B;}
        body{background:var(--gray-50);direction:rtl;color:var(--deep);}

        .nav{background:var(--deep);height:64px;padding:0 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(1,20,66,0.2);}
        .nav-brand{display:flex;align-items:center;gap:10px;text-decoration:none;}
        .brand-logo{font-size:22px;font-weight:900;color:var(--primary);}
        .brand-sub{font-size:10px;font-weight:600;color:var(--neon);letter-spacing:0.15em;opacity:.8;}
        .nav-back{color:var(--neon);text-decoration:none;font-size:13px;font-weight:500;padding:6px 14px;border-radius:8px;border:1px solid rgba(85,215,255,0.25);transition:all .18s;}
        .nav-back:hover{background:rgba(85,215,255,0.1);}

        .wrap{max-width:1000px;margin:0 auto;padding:32px 24px 64px;}
        @media(max-width:768px){.wrap{padding:20px 16px 48px;}}

        /* PROFILE CARD */
        .profile-card{background:#fff;border-radius:24px;border:1px solid var(--gray-100);box-shadow:0 4px 24px rgba(1,20,66,0.08);overflow:hidden;margin-bottom:20px;}
        .profile-banner{background:linear-gradient(135deg,var(--deep) 0%,#0D2080 100%);padding:32px 32px 0;display:flex;gap:24px;align-items:flex-end;}
        @media(max-width:600px){.profile-banner{flex-direction:column;align-items:center;text-align:center;padding:24px 20px 0;}}
        .profile-avatar{width:96px;height:96px;border-radius:20px;border:3px solid rgba(255,255,255,0.2);background:linear-gradient(135deg,var(--primary),var(--neon));display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:#fff;flex-shrink:0;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.3);}
        .profile-avatar img{width:100%;height:100%;object-fit:cover;}
        .profile-info{padding-bottom:24px;flex:1;}
        .profile-name{font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;}
        .profile-spec{display:inline-block;background:rgba(85,215,255,0.15);color:var(--neon);font-size:12px;font-weight:600;padding:3px 12px;border-radius:20px;border:1px solid rgba(85,215,255,0.25);margin-bottom:10px;}
        .profile-stars{display:flex;align-items:center;gap:6px;}
        .stars{font-size:16px;color:#FBBF24;letter-spacing:2px;}
        .rating-num{font-size:14px;font-weight:700;color:#FBBF24;}
        .rating-count{font-size:12px;color:rgba(255,255,255,0.35);}

        .profile-body{padding:24px 32px;}
        @media(max-width:600px){.profile-body{padding:20px;}}

        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
        @media(max-width:600px){.kpis{grid-template-columns:repeat(2,1fr);}}
        .kpi{background:var(--gray-50);border:1px solid var(--gray-100);border-radius:14px;padding:14px 10px;text-align:center;transition:all .18s;}
        .kpi:hover{border-color:rgba(13,64,252,0.2);box-shadow:0 4px 12px rgba(13,64,252,0.08);}
        .kpi-icon{font-size:18px;margin-bottom:5px;}
        .kpi-val{font-size:24px;font-weight:800;color:var(--deep);margin-bottom:2px;}
        .kpi-lbl{font-size:10px;color:var(--gray-400);font-weight:500;}

        .seats-badge{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:16px;}
        .seats-ok{background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.2);color:#059669;}
        .seats-low{background:rgba(245,158,11,0.08);border:1.5px solid rgba(245,158,11,0.2);color:#d97706;}
        .seats-none{background:rgba(239,68,68,0.06);border:1.5px solid rgba(239,68,68,0.15);color:#dc2626;}
        .seats-dot{width:8px;height:8px;border-radius:50%;animation:pulse 1.5s infinite;}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.2)}}
        .seats-dot-ok{background:#059669;}
        .seats-dot-low{background:#d97706;}

        .bio-text{font-size:14px;color:var(--gray-600);line-height:1.8;margin-bottom:16px;}

        .avail-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);color:#059669;font-size:13px;font-weight:600;padding:8px 16px;border-radius:10px;}
        .avail-dot{width:7px;height:7px;border-radius:50%;background:#059669;animation:pulse 1.5s infinite;}

        /* LAYOUT */
        .main-grid{display:grid;grid-template-columns:1fr 380px;gap:20px;align-items:start;}
        @media(max-width:860px){.main-grid{grid-template-columns:1fr;}}

        /* REVIEWS */
        .section-card{background:#fff;border-radius:20px;border:1px solid var(--gray-100);box-shadow:0 2px 8px rgba(1,20,66,0.05);overflow:hidden;margin-bottom:20px;}
        .section-head{padding:16px 24px;border-bottom:1px solid var(--gray-100);display:flex;align-items:center;gap:10px;}
        .section-icon{width:32px;height:32px;border-radius:9px;background:rgba(13,64,252,0.07);display:flex;align-items:center;justify-content:center;font-size:15px;}
        .section-title{font-size:14px;font-weight:700;color:var(--deep);}
        .section-body{padding:20px 24px;}

        .review-item{padding:14px 0;border-bottom:1px solid var(--gray-50);}
        .review-item:last-child{border-bottom:none;padding-bottom:0;}
        .review-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
        .review-author{font-size:13px;font-weight:600;color:var(--deep);}
        .review-stars{color:#FBBF24;font-size:13px;}
        .review-text{font-size:13px;color:var(--gray-600);line-height:1.65;}
        .no-reviews{text-align:center;color:var(--gray-400);font-size:13px;padding:16px 0;}

        /* BOOKING CARD */
        .booking-card{background:#fff;border-radius:20px;border:1px solid var(--gray-100);box-shadow:0 4px 16px rgba(1,20,66,0.08);overflow:hidden;position:sticky;top:80px;}
        .booking-head{background:linear-gradient(135deg,var(--primary) 0%,#0929b4 100%);padding:18px 24px;display:flex;align-items:center;gap:10px;}
        .booking-head-icon{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:17px;}
        .booking-head-title{font-size:15px;font-weight:700;color:#fff;}
        .booking-head-sub{font-size:11px;color:rgba(255,255,255,0.55);margin-top:1px;}
        .booking-body{padding:20px;}

        .footer{text-align:center;padding:20px;color:var(--gray-400);font-size:12px;border-top:1px solid var(--gray-100);background:#fff;margin-top:32px;}
        .footer a{color:var(--primary);text-decoration:none;font-weight:600;}
      `}</style>

      <div dir="rtl">
        <nav className="nav">
          <Link href={`/${locale}`} className="nav-brand">
            <div>
              <div className="brand-logo">سلوكيرا</div>
              <div className="brand-sub">SULUKERA</div>
            </div>
          </Link>
          <Link href={`/${locale}`} className="nav-back">
            ← العودة للرئيسية
          </Link>
        </nav>

        <div className="wrap">
          {/* PROFILE CARD */}
          <div className="profile-card">
            <div className="profile-banner">
              <div className="profile-avatar">
                {supervisor?.photo ? (
                  <img
                    src={normalizeProviderPhotoUrl(supervisor.photo)}
                    alt={supervisor.name}
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="profile-info">
                <div className="profile-name">{supervisor?.name}</div>
                <div className="profile-spec">{specialization}</div>
                {rating > 0 && (
                  <div className="profile-stars">
                    <span className="stars">
                      {"★".repeat(Math.floor(rating))}
                      {"☆".repeat(5 - Math.floor(rating))}
                    </span>
                    <span className="rating-num">{rating.toFixed(1)}</span>
                    <span className="rating-count">
                      ({reviews.length} تقييم)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="profile-body">
              <div className="kpis">
                <div className="kpi">
                  <div className="kpi-icon">📚</div>
                  <div className="kpi-val">
                    {supervisor?.totalSessions ?? 0}
                  </div>
                  <div className="kpi-lbl">إجمالي الجلسات</div>
                </div>
                <div className="kpi">
                  <div className="kpi-icon">⭐</div>
                  <div className="kpi-val" style={{ color: "#F59E0B" }}>
                    {rating > 0 ? rating.toFixed(1) : "—"}
                  </div>
                  <div className="kpi-lbl">متوسط التقييم</div>
                </div>
                <div className="kpi">
                  <div className="kpi-icon">📅</div>
                  <div className="kpi-val" style={{ color: "#10B981" }}>
                    {availableDates.length}
                  </div>
                  <div className="kpi-lbl">أيام متاحة</div>
                </div>
                <div className="kpi">
                  <div className="kpi-icon">🪑</div>
                  <div
                    className="kpi-val"
                    style={{
                      color:
                        seats > 5
                          ? "#10B981"
                          : seats > 0
                            ? "#F59E0B"
                            : "#EF4444",
                    }}
                  >
                    {seats}
                  </div>
                  <div className="kpi-lbl">مقاعد متاحة</div>
                </div>
              </div>

              {/* SEATS STATUS */}
              {seats > 5 ? (
                <div className="seats-badge seats-ok">
                  <div className="seats-dot seats-dot-ok" />
                  {seats} مقعد متاح — الحجز مفتوح
                </div>
              ) : seats > 0 ? (
                <div className="seats-badge seats-low">
                  <div className="seats-dot seats-dot-low" />
                  تبقّى {seats} مقاعد فقط — احجز الآن!
                </div>
              ) : (
                <div className="seats-badge seats-none">
                  ● المقاعد ممتلئة حالياً
                </div>
              )}

              {supervisor?.bio && <p className="bio-text">{supervisor.bio}</p>}

              {availableDates.length > 0 && (
                <div className="avail-badge">
                  <div className="avail-dot" />
                  متاح للحجز — {availableDates.length} يوم متاح
                </div>
              )}
            </div>
          </div>

          <div className="main-grid">
            {/* LEFT: Reviews */}
            <div>
              <div className="section-card">
                <div className="section-head">
                  <div className="section-icon">💬</div>
                  <span className="section-title">آراء الطلاب</span>
                </div>
                <div className="section-body">
                  {reviews.length === 0 ? (
                    <div className="no-reviews">
                      لا توجد تقييمات بعد — كن أول من يقيّم!
                    </div>
                  ) : (
                    reviews.map((r) => (
                      <div key={r.id} className="review-item">
                        <div className="review-top">
                          <span className="review-author">
                            {r.studentName || "طالب"}
                          </span>
                          <span className="review-stars">
                            {"★".repeat(r.rating || 5)}
                            {"☆".repeat(5 - (r.rating || 5))}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="review-text">{r.comment}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Booking */}
            <div className="booking-card">
              <div className="booking-head">
                <div className="booking-head-icon">🗓</div>
                <div>
                  <div className="booking-head-title">
                    {bookingType === "consultation"
                      ? "احجز استشارتك"
                      : "احجز المقابلة الأولية"}
                  </div>
                  <div className="booking-head-sub">
                    جلسة عن بُعد · اختر التاريخ والوقت المناسب
                  </div>
                </div>
              </div>
              <div className="booking-body">
                {seats === 0 && bookingType === "initial_interview" ? (
                  <div style={{ textAlign: "center", padding: "32px 16px" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🪑</div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#001442",
                        marginBottom: 8,
                      }}
                    >
                      المقاعد ممتلئة
                    </div>
                    <div style={{ fontSize: 13, color: "#8898AA" }}>
                      لا تتوفر مقاعد حالياً، تابعنا للمزيد
                    </div>
                  </div>
                ) : (
                  <BookingSection
                    supervisor={supervisor}
                    availableDates={availableDates}
                    locale={locale}
                    bookingType={bookingType}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="footer">
          منصة الإشراف الأكاديمي ·{" "}
          <a href="https://sulukera.com" target="_blank">
            سلوكيرا
          </a>{" "}
          © {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
}
