import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";
import { credentialRules } from "@/lib/qaba/compliance";

interface Props {
  params: Promise<{ locale: string }>;
}

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return null;
  try {
    const { adminAuth, adminDb } = await import("@/lib/firebase/admin");
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase())
      return null;
    return { adminDb };
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage({ params }: Props) {
  const { locale } = await params;
  const auth = await verifyAdmin();
  if (!auth) redirect(`/${locale}/login`);
  const { adminDb } = auth;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    traineesSnap,
    supervisorsSnap,
    sessionsSnap,
    snapshotsSnap,
    activitySnap,
    notifsSnap,
  ] = await Promise.all([
    adminDb.collection("trainees").get(),
    adminDb.collection("supervisors").get(),
    adminDb.collection("sessions").where("month", "==", currentMonth).get(),
    adminDb
      .collection("monthlySnapshots")
      .where("month", "==", currentMonth)
      .get(),
    adminDb
      .collection("activityLog")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get(),
    adminDb.collection("notifications").where("read", "==", false).get(),
  ]);

  const trainees = traineesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const supervisors = supervisorsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const sessions = sessionsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const snapshots = snapshotsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const activities = activitySnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const notifCount = notifsSnap.size;

  // إحصائيات
  const activeTrainees = trainees.filter((t) => t.status === "active");
  const onboardingTrainees = trainees.filter((t) => t.status === "onboarding");
  const readyToAssign = trainees.filter(
    (t) => t.status === "onboarding" && t.onboardingStage === "contracting",
  );
  const totalHours = snapshots.reduce((a, s) => a + (s.totalHours || 0), 0);
  const weekSessions = sessions.filter((s) => s.date >= weekAgo);

  // تنبيهات
  const over25 = snapshots.filter((s) => (s.groupPercentage || 0) > 25);
  const noWorkHours = snapshots.filter(
    (s) => !s.workHours || s.workHours === 0,
  );
  const atRisk = trainees.filter((t) => {
    if (t.status !== "active") return false;
    const snap = snapshots.find((s) => s.traineeId === t.id);
    return snap && (snap.absenceCount || 0) >= 3;
  });

  // تقدم المتدربين
  const traineeProgress = activeTrainees
    .map((t) => {
      const snap = snapshots.find((s) => s.traineeId === t.id);
      const targetHours =
        t.fieldworkTargetHours || credentialRules(t.license || "QASP-S").total;
      const pct = Math.round(((snap?.totalHours || 0) / targetHours) * 100);
      return {
        ...t,
        pct,
        targetHours,
        totalHours: snap?.totalHours || 0,
        snap,
      };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const timeAgo = (iso: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        body{background:#F8FAFC;direction:rtl;color:#001442;}
        .layout{display:flex;min-height:100vh;}
        .main{flex:1;overflow:auto;}
        .topbar{background:#fff;border-bottom:0.5px solid #EEF2F7;padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;}
        .page-title{font-size:16px;font-weight:600;color:#001442;}
        .page-date{font-size:12px;color:#8898AA;}
        .content{padding:24px 28px;}
        .quick-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.quick-nav a{background:#fff;border:1px solid #E2E8F0;color:#475569;text-decoration:none;padding:8px 12px;border-radius:9px;font-size:12px;font-weight:600}.quick-nav a:first-child{background:#0D40FC;color:#fff;border-color:#0D40FC}
        .alerts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
        .alert-card{background:#fff;border-radius:14px;padding:14px 16px;border:0.5px solid #EEF2F7;display:flex;align-items:flex-start;gap:12px;box-shadow:0 1px 4px rgba(1,20,66,0.04);}
        .alert-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;}
        .alert-count{font-size:24px;font-weight:700;line-height:1;margin-bottom:2px;}
        .alert-label{font-size:12px;font-weight:500;}
        .alert-sub{font-size:11px;color:#8898AA;margin-top:2px;}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
        .stat{background:#F8FAFC;border-radius:10px;padding:14px 16px;border:0.5px solid #EEF2F7;}
        .stat-label{font-size:11px;color:#8898AA;margin-bottom:4px;}
        .stat-val{font-size:26px;font-weight:700;}
        .stat-note{font-size:11px;color:#8898AA;margin-top:2px;}
        .bottom{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .card{background:#fff;border-radius:16px;border:0.5px solid #EEF2F7;overflow:hidden;box-shadow:0 1px 4px rgba(1,20,66,0.04);}
        .card-head{padding:12px 16px;border-bottom:0.5px solid #EEF2F7;display:flex;align-items:center;justify-content:space-between;}
        .card-title{font-size:13px;font-weight:600;color:#001442;display:flex;align-items:center;gap:6px;}
        .card-body{padding:12px 16px;}
        .feed-item{display:flex;gap:10px;padding:9px 0;border-bottom:0.5px solid #EEF2F7;}
        .feed-item:last-child{border-bottom:none;}
        .feed-avatar{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0;}
        .feed-text{font-size:12px;color:#001442;line-height:1.5;}
        .feed-time{font-size:11px;color:#8898AA;margin-top:2px;}
        .progress-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:0.5px solid #EEF2F7;}
        .progress-row:last-child{border-bottom:none;}
        .progress-name{font-size:12px;font-weight:500;width:80px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .progress-bar{flex:1;height:5px;background:#EEF2F7;border-radius:99px;overflow:hidden;}
        .progress-fill{height:100%;border-radius:99px;}
        .tag{font-size:10px;padding:2px 8px;border-radius:99px;display:inline-flex;align-items:center;white-space:nowrap;}
        .right-col{display:flex;flex-direction:column;gap:16px;}
        @media(max-width:900px){.alerts{grid-template-columns:1fr 1fr;}.stats{grid-template-columns:1fr 1fr;}.bottom{grid-template-columns:1fr;}}
      `}</style>

      <div className="layout" dir="rtl">
        <AdminSidebar locale={locale} notifCount={notifCount} />

        <div className="main">
          {/* Topbar */}
          <div className="topbar">
            <div>
              <div className="page-title">الداشبورد</div>
              <div className="page-date">
                {new Date().toLocaleDateString("ar-SA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <LogoutButton locale={locale} />
            </div>
          </div>

          <div className="content">
            <div className="quick-nav">
              <Link href={`/${locale}/admin/onboarding`}>
                الإسناد والتهيئة{" "}
                {readyToAssign.length ? `(${readyToAssign.length})` : ""}
              </Link>
              <Link href={`/${locale}/admin/trainees`}>ملفات المتدربين</Link>
              <Link href={`/${locale}/admin/supervisors`}>متابعة المشرفين</Link>
              <Link href={`/${locale}/admin/months`}>السجلات الشهرية</Link>
            </div>

            {/* تنبيهات عاجلة */}
            <div className="alerts">
              <div
                className="alert-card"
                style={{
                  borderColor: readyToAssign.length > 0 ? "#F7C1C1" : "#EEF2F7",
                }}
              >
                <div className="alert-icon" style={{ background: "#FCEBEB" }}>
                  <i
                    className="ti ti-user-check"
                    style={{ color: "#A32D2D" }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <div className="alert-count" style={{ color: "#A32D2D" }}>
                    {readyToAssign.length}
                  </div>
                  <div className="alert-label">جاهزون للإسناد</div>
                  <div className="alert-sub">أكملوا مرحلة التعاقد</div>
                </div>
              </div>

              <div
                className="alert-card"
                style={{
                  borderColor: over25.length > 0 ? "#FAC775" : "#EEF2F7",
                }}
              >
                <div className="alert-icon" style={{ background: "#FAEEDA" }}>
                  <i
                    className="ti ti-alert-triangle"
                    style={{ color: "#854F0B" }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <div className="alert-count" style={{ color: "#854F0B" }}>
                    {over25.length}
                  </div>
                  <div className="alert-label">تجاوزوا 25% جماعية</div>
                  <div className="alert-sub">يحتاجون مراجعة</div>
                </div>
              </div>

              <div
                className="alert-card"
                style={{
                  borderColor: atRisk.length > 0 ? "#F7C1C1" : "#EEF2F7",
                }}
              >
                <div className="alert-icon" style={{ background: "#FCEBEB" }}>
                  <i
                    className="ti ti-heart-broken"
                    style={{ color: "#A32D2D" }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <div className="alert-count" style={{ color: "#A32D2D" }}>
                    {atRisk.length}
                  </div>
                  <div className="alert-label">متدربون في خطر</div>
                  <div className="alert-sub">3+ غيابات هذا الشهر</div>
                </div>
              </div>
            </div>

            {/* إحصائيات */}
            <div className="stats">
              <div className="stat">
                <div className="stat-label">ساعات الشهر</div>
                <div className="stat-val" style={{ color: "#0D40FC" }}>
                  {totalHours}
                </div>
                <div className="stat-note">إجمالي كل المشرفين</div>
              </div>
              <div className="stat">
                <div className="stat-label">متدربون نشطون</div>
                <div className="stat-val">{activeTrainees.length}</div>
                <div className="stat-note">من أصل {trainees.length}</div>
              </div>
              <div className="stat">
                <div className="stat-label">جلسات هذا الأسبوع</div>
                <div className="stat-val" style={{ color: "#10B981" }}>
                  {weekSessions.length}
                </div>
                <div className="stat-note">فردية وجماعية</div>
              </div>
              <div className="stat">
                <div className="stat-label">قيد البوردنق</div>
                <div className="stat-val" style={{ color: "#8898AA" }}>
                  {onboardingTrainees.length}
                </div>
                <div className="stat-note">
                  منهم {readyToAssign.length} جاهز
                </div>
              </div>
            </div>

            {/* Bottom */}
            <div className="bottom">
              {/* Feed */}
              <div className="card">
                <div className="card-head">
                  <div className="card-title">
                    <i
                      className="ti ti-activity"
                      style={{ fontSize: 15 }}
                      aria-hidden="true"
                    />
                    آخر النشاطات
                  </div>
                  <span style={{ fontSize: 11, color: "#8898AA" }}>
                    {activities.length} حدث
                  </span>
                </div>
                <div className="card-body">
                  {activities.length === 0 ? (
                    <div
                      style={{
                        padding: "2rem",
                        textAlign: "center",
                        color: "#8898AA",
                        fontSize: 13,
                      }}
                    >
                      لا توجد نشاطات بعد — ستظهر هنا عند تسجيل الجلسات
                    </div>
                  ) : (
                    activities.map((a) => (
                      <div key={a.id} className="feed-item">
                        <div
                          className="feed-avatar"
                          style={{
                            background:
                              a.type === "session"
                                ? "#E6F1FB"
                                : a.type === "trainee_added"
                                  ? "#EAF3DE"
                                  : "#FAEEDA",
                            color:
                              a.type === "session"
                                ? "#185FA5"
                                : a.type === "trainee_added"
                                  ? "#3B6D11"
                                  : "#854F0B",
                          }}
                        >
                          {(a.actorName || "م").slice(0, 2)}
                        </div>
                        <div>
                          <div className="feed-text">{a.message}</div>
                          <div className="feed-time">
                            {timeAgo(a.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* اليمين */}
              <div className="right-col">
                {/* تقدم المتدربين */}
                <div className="card">
                  <div className="card-head">
                    <div className="card-title">
                      <i
                        className="ti ti-target"
                        style={{ fontSize: 15 }}
                        aria-hidden="true"
                      />
                      تقدم نحو الرخصة
                    </div>
                    <span
                      className="tag"
                      style={{ background: "#E6F1FB", color: "#185FA5" }}
                    >
                      الشهر الحالي
                    </span>
                  </div>
                  <div className="card-body">
                    {traineeProgress.length === 0 ? (
                      <div
                        style={{
                          padding: "1rem",
                          textAlign: "center",
                          color: "#8898AA",
                          fontSize: 12,
                        }}
                      >
                        لا يوجد متدربون نشطون
                      </div>
                    ) : (
                      traineeProgress.map((t) => (
                        <div key={t.id} className="progress-row">
                          <div className="progress-name">{t.name}</div>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${t.pct}%`,
                                background:
                                  t.pct >= 100 ? "#10B981" : "#0D40FC",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: t.pct >= 100 ? "#10B981" : "#8898AA",
                              minWidth: 30,
                            }}
                          >
                            {t.pct}%
                          </span>
                          {t.pct >= 90 && t.pct < 100 && (
                            <span
                              className="tag"
                              style={{
                                background: "#FAEEDA",
                                color: "#854F0B",
                              }}
                            >
                              قريب
                            </span>
                          )}
                          {t.pct >= 100 && (
                            <span
                              className="tag"
                              style={{
                                background: "#EAF3DE",
                                color: "#3B6D11",
                              }}
                            >
                              ✓
                            </span>
                          )}
                          {(t.snap?.absenceCount || 0) >= 3 && (
                            <span
                              className="tag"
                              style={{
                                background: "#FCEBEB",
                                color: "#A32D2D",
                              }}
                            >
                              خطر
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* المشرفون */}
                <div className="card">
                  <div className="card-head">
                    <div className="card-title">
                      <i
                        className="ti ti-chart-bar"
                        style={{ fontSize: 15 }}
                        aria-hidden="true"
                      />
                      إنتاجية المشرفين
                    </div>
                  </div>
                  <div className="card-body">
                    {supervisors.map((sup) => {
                      const supSnaps = snapshots.filter(
                        (s) => s.supervisorId === sup.id,
                      );
                      const total = supSnaps.reduce(
                        (a, s) => a + (s.totalHours || 0),
                        0,
                      );
                      const count = activeTrainees.filter(
                        (t) => t.currentSupervisorId === sup.id,
                      ).length;
                      return (
                        <div key={sup.id} className="progress-row">
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: "#E6F1FB",
                              color: "#185FA5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {sup.name?.slice(0, 2)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {sup.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#8898AA" }}>
                              {count} متدرب
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: "#0D40FC",
                            }}
                          >
                            {total}
                          </div>
                          <div style={{ fontSize: 11, color: "#8898AA" }}>
                            ساعة
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
