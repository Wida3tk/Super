import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";
import { redirect } from "next/navigation";
import AvailabilityManager from "@/components/supervisor/AvailabilityManager";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import SeatsManager from "@/components/supervisor/SeatsManager";
import SupervisorTabs from "@/components/supervisor/SupervisorTabs";
import SupervisorNotifications from "@/components/supervisor/SupervisorNotifications";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function SupervisorDashboardPage({ params }: Props) {
  const { locale } = await params;
  const supervisor = (await getAuthenticatedSupervisor()) as any;
  if (!supervisor) redirect(`/${locale}/login`);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().split("T")[0];

  const [
    bookingsSnap,
    traineesSnap,
    sessionsSnap,
    snapshotsSnap,
    notifsSnap,
    fieldworkSnap,
    approvedActivitiesSnap,
  ] = await Promise.all([
    adminDb
      .collection("bookings")
      .where("supervisorId", "==", supervisor.id)
      .where("status", "==", "confirmed")
      .orderBy("date", "asc")
      .get(),
    adminDb
      .collection("trainees")
      .where("currentSupervisorId", "==", supervisor.id)
      .where("status", "==", "active")
      .get(),
    adminDb
      .collection("sessions")
      .where("supervisorId", "==", supervisor.id)
      .where("month", "==", currentMonth)
      .get(),
    adminDb
      .collection("monthlySnapshots")
      .where("supervisorId", "==", supervisor.id)
      .where("month", "==", currentMonth)
      .get(),
    adminDb
      .collection("notifications")
      .where("supervisorId", "==", supervisor.id)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get(),
    adminDb
      .collection("fieldworkActivities")
      .where("supervisorId", "==", supervisor.id)
      .where("status", "==", "submitted")
      .limit(500)
      .get(),
    adminDb
      .collection("fieldworkActivities")
      .where("supervisorId", "==", supervisor.id)
      .where("status", "==", "approved")
      .get(),
  ]);

  const allBookings = bookingsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const initialTrainees = traineesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const initialSessions = sessionsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const initialSnapshots = snapshotsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const notificationCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const notifications = (
    notifsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[]
  ).filter(
    (notification) =>
      !notification.read &&
      (!notification.createdAt ||
        new Date(notification.createdAt).getTime() >= notificationCutoff),
  );
  const fieldworkActivities = (
    fieldworkSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
  ).filter((a) => a.status === "submitted");
  const approvedActivities = approvedActivitiesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const isConsultant = supervisor.accountType === "consultant";

  const upcomingCount = allBookings.filter(
    (b: any) =>
      b.date >= today && (!b.meetingStatus || b.meetingStatus === "pending"),
  ).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        :root{--primary:#0D40FC;--deep:#001442;--neon:#55D7FF;--gray-100:#F8FAFC;--gray-200:#EEF2F7;--gray-300:#D1D9E6;--gray-500:#8898AA;--success:#10B981;--danger:#EF4444;}
        body{background:var(--gray-100);direction:rtl;color:var(--deep);}
        .nav{background:var(--deep);padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(1,20,66,0.18);}
        .nav-logo{font-size:24px;font-weight:800;color:var(--primary);letter-spacing:-1px;}
        .nav-sub{font-size:10px;font-weight:500;color:var(--neon);letter-spacing:0.12em;text-transform:uppercase;opacity:.85;}
        .nav-div{width:1px;height:28px;background:rgba(255,255,255,0.12);}
        .nav-title{font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);}
        .nav-back{display:flex;align-items:center;gap:6px;color:var(--neon);text-decoration:none;font-size:13px;font-weight:500;padding:6px 14px;border-radius:8px;border:1px solid rgba(85,215,255,0.25);transition:all .18s;}
        .nav-back:hover{background:rgba(85,215,255,0.1);color:#fff;}
        .hero{background:linear-gradient(135deg,var(--primary) 0%,var(--deep) 100%);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;}
        .hero h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;}
        .hero p{font-size:13px;color:rgba(255,255,255,0.6);}
        .hero-date{font-size:12px;color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.08);padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);}
        .main{max-width:1400px;margin:0 auto;padding:28px 32px 64px;}
        @media(max-width:768px){.main{padding:20px 16px 48px;}}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
        @media(max-width:700px){.stats{grid-template-columns:1fr 1fr;}}
        .stat-card{background:#fff;border-radius:14px;padding:20px 16px;border:1px solid var(--gray-200);box-shadow:0 1px 4px rgba(1,20,66,0.06);display:flex;align-items:center;gap:14px;transition:box-shadow .18s,transform .18s;}
        .stat-card:hover{box-shadow:0 6px 20px rgba(13,64,252,0.1);transform:translateY(-2px);}
        .stat-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
        .stat-val{font-size:30px;font-weight:800;line-height:1;margin-bottom:2px;}
        .stat-lbl{font-size:11px;font-weight:500;color:var(--gray-500);}
        .footer{text-align:center;padding:20px;color:var(--gray-500);font-size:12px;border-top:1px solid var(--gray-200);background:#fff;margin-top:32px;}
        .footer a{color:var(--primary);text-decoration:none;font-weight:600;}
        .operations-grid{display:grid;grid-template-columns:minmax(0,3fr) minmax(250px,1fr);gap:12px;margin-bottom:18px;align-items:stretch}
        @media(max-width:1050px){.operations-grid{grid-template-columns:1fr}}
        .supervisor-page{min-height:100vh;background:radial-gradient(circle at 8% 4%,#dff7ff 0,transparent 27%),radial-gradient(circle at 95% 8%,#eae7ff 0,transparent 25%),#f5f7fb;padding:0 28px 32px}
        .dashboard-wrap{max-width:1180px;margin:0 auto}
        .supervisor-page .nav{height:68px;padding:0;background:transparent;position:static;box-shadow:none}
        .supervisor-page .nav-div{background:#dbe3ef}
        .supervisor-page .nav-title{color:#53657d;background:#fff;border:1px solid #dfe6f0;padding:6px 11px;border-radius:99px;font-size:11px}
        .supervisor-page .nav-back{background:#fff;border:1px solid #d9e1ed;color:#64748b}
        .supervisor-page .nav-back:hover{background:#eef4ff;color:#0d40fc}
        .supervisor-page .hero{position:relative;overflow:hidden;background:linear-gradient(125deg,#001442 0%,#0935ce 62%,#0d70fc 100%);border-radius:24px;padding:30px 34px;display:grid;grid-template-columns:1.5fr .72fr;gap:24px;box-shadow:0 20px 50px #0d40fc25}
        .supervisor-page .hero:after{content:'';position:absolute;width:310px;height:310px;border-radius:50%;background:#55d7ff18;left:-80px;top:-155px}
        .hero-copy{position:relative;z-index:1}
        .hero-eyebrow{font-size:12px;color:#73e3ff;font-weight:700;margin-bottom:7px}
        .supervisor-page .hero h1{font-size:29px;margin-bottom:8px}
        .supervisor-page .hero p{font-size:14px;color:#d5e1ff;line-height:1.8;max-width:620px}
        .hero-glance{position:relative;z-index:1;background:#ffffff13;border:1px solid #ffffff24;border-radius:18px;padding:18px;backdrop-filter:blur(8px)}
        .hero-glance-title{font-size:12px;color:#a9c4ff;margin-bottom:11px}
        .hero-glance-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .hero-glance-item{background:#ffffff0d;border:1px solid #ffffff16;border-radius:11px;padding:10px}
        .hero-glance-item b{display:block;color:#fff;font-size:22px;line-height:1.2}
        .hero-glance-item span{font-size:10px;color:#c9d8ff}
        .supervisor-page .hero-date{display:inline-flex;margin-top:14px;color:#c9d8ff;background:#ffffff0d}
        .supervisor-page .main{max-width:none;padding:18px 0 42px}
        .supervisor-page .stats{gap:14px;margin-bottom:18px}
        .supervisor-page .stat-card{border-radius:18px;padding:17px;background:#ffffffeb;box-shadow:0 9px 28px #0014420b;border-top:3px solid #dce6ff}
        .supervisor-page .stat-card:nth-child(2){border-top-color:#ef9f27}.supervisor-page .stat-card:nth-child(3){border-top-color:#7668ff}.supervisor-page .stat-card:nth-child(4){border-top-color:#10b981}
        .supervisor-page .stat-val{font-size:25px}.supervisor-page .stat-icon{width:38px;height:38px;font-size:17px}
        .supervisor-page .footer{background:transparent;border:0;margin:0;padding:10px}
        @media(max-width:850px){.supervisor-page{padding:0 16px 24px}.supervisor-page .hero{grid-template-columns:1fr;padding:25px}.supervisor-page .hero h1{font-size:25px}.hero-glance{display:none}.supervisor-page .nav-title{display:none}}
      `}</style>

      <div className="supervisor-page" dir="rtl">
        <div className="dashboard-wrap">
          <nav className="nav">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div>
                <img
                  src="/logo.svg"
                  alt="سلوكيرا"
                  style={{ height: "32px", width: "auto" }}
                />
              </div>
              <div className="nav-div" />
              <span className="nav-title">
                {isConsultant ? "لوحة المستشار" : "لوحة المشرف"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href={`/${locale}`} className="nav-back">
                ← الرئيسية
              </Link>
              <LogoutButton locale={locale} />
            </div>
          </nav>

          <div className="hero">
            <div className="hero-copy">
              <div className="hero-eyebrow">
                مساحة الإشراف والمتابعة المهنية ✦
              </div>
              <h1>مرحباً، {supervisor.name} 👋</h1>
              <p>
                {supervisor.bio ||
                  (isConsultant
                    ? "مستشار إدارة السلوك التنظيمي في الواجهة الموحّدة للإشراف"
                    : "تابع متدربيك، راجع الساعات، ووثّق تقدمهم المهني من مساحة عمل واحدة.")}
              </p>
              <div className="hero-date">
                {new Date().toLocaleDateString("ar-SA", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
            <aside className="hero-glance">
              <div className="hero-glance-title">ملخص مساحة العمل اليوم</div>
              <div className="hero-glance-grid">
                <div className="hero-glance-item">
                  <b>{initialTrainees.length}</b>
                  <span>متدربون مسندون</span>
                </div>
                <div className="hero-glance-item">
                  <b>{fieldworkActivities.length}</b>
                  <span>ساعات للمراجعة</span>
                </div>
                <div className="hero-glance-item">
                  <b>{upcomingCount}</b>
                  <span>مواعيد قادمة</span>
                </div>
                <div className="hero-glance-item">
                  <b>{unreadCount}</b>
                  <span>رسائل جديدة</span>
                </div>
              </div>
            </aside>
          </div>

          <div className="main">
            {/* Stats */}
            <div className="stats">
              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ background: "rgba(13,64,252,0.08)" }}
                >
                  📋
                </div>
                <div>
                  <div className="stat-val">
                    {supervisor.totalSessions ?? 0}
                  </div>
                  <div className="stat-lbl">إجمالي الجلسات</div>
                </div>
              </div>
              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ background: "rgba(239,68,68,0.08)" }}
                >
                  ✓
                </div>
                <div>
                  <div
                    className="stat-val"
                    style={{
                      color: fieldworkActivities.length ? "#dc2626" : "#059669",
                    }}
                  >
                    {fieldworkActivities.length}
                  </div>
                  <div className="stat-lbl">ساعات تنتظر المراجعة</div>
                </div>
              </div>
              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ background: "rgba(245,158,11,0.08)" }}
                >
                  ⭐
                </div>
                <div>
                  <div className="stat-val" style={{ color: "#d97706" }}>
                    {(supervisor.ratingAverage ?? 0).toFixed(1)}
                  </div>
                  <div className="stat-lbl">متوسط التقييم</div>
                </div>
              </div>
              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ background: "rgba(16,185,129,0.08)" }}
                >
                  🗓️
                </div>
                <div>
                  <div className="stat-val" style={{ color: "#059669" }}>
                    {upcomingCount}
                  </div>
                  <div className="stat-lbl">مقابلات قادمة</div>
                </div>
              </div>
            </div>

            {/* Availability + Seats */}
            <div className="operations-grid">
              <AvailabilityManager
                supervisorId={supervisor.id}
                locale={locale}
              />
              {!isConsultant && (
                <SeatsManager
                  supervisorId={supervisor.id}
                  currentSeats={supervisor.availableSeats ?? 0}
                />
              )}
            </div>

            {/* إشعارات الإدارة */}
            {notifications.length > 0 && (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #E2E8F0",
                  overflow: "hidden",
                  marginBottom: 20,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid #F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#FAFAFA",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 18 }}>🔔</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                      }}
                    >
                      رسائل الإدارة
                    </span>
                    {unreadCount > 0 && (
                      <span
                        style={{
                          background: "#EF4444",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 7px",
                          borderRadius: 99,
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <SupervisorNotifications
                    notifications={notifications}
                    supervisorId={supervisor.id}
                  />
                </div>
              </div>
            )}

            {/* Main Tabs */}
            <SupervisorTabs
              bookings={allBookings}
              supervisorId={supervisor.id}
              initialTrainees={initialTrainees}
              initialSessions={initialSessions}
              initialSnapshots={initialSnapshots}
              upcomingCount={upcomingCount}
              traineesCount={initialTrainees.length}
              fieldworkActivities={fieldworkActivities}
              approvedActivities={approvedActivities}
              supervisor={supervisor}
            />
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
