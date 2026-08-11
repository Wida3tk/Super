import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { redirect } from "next/navigation";
import AvailabilityManager from "@/components/supervisor/AvailabilityManager";
import { cookies } from "next/headers";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import SeatsManager from "@/components/supervisor/SeatsManager";
import SupervisorTabs from "@/components/supervisor/SupervisorTabs";
import SupervisorNotifications from "@/components/supervisor/SupervisorNotifications";

interface Props {
  params: Promise<{ locale: string }>;
}

async function getAuthenticatedSupervisor() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const email = decoded.email?.toLowerCase() || "";
    const allSnap = await adminDb.collection("supervisors").get();
    const match = allSnap.docs.find(
      (d) => (d.data().email || "").toLowerCase() === email,
    );
    if (!match) return null;
    return { id: match.id, ...match.data() } as any;
  } catch {
    return null;
  }
}

export default async function SupervisorDashboardPage({ params }: Props) {
  const { locale } = await params;
  const supervisor = await getAuthenticatedSupervisor();
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
      .limit(300)
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
  const notifications = notifsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const fieldworkActivities = (
    fieldworkSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
  ).filter((a) => a.status === "submitted");
  const unreadCount = notifications.filter((n: any) => !n.read).length;

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
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;}
        @media(max-width:700px){.stats{grid-template-columns:1fr 1fr;}}
        .stat-card{background:#fff;border-radius:14px;padding:20px 16px;border:1px solid var(--gray-200);box-shadow:0 1px 4px rgba(1,20,66,0.06);display:flex;align-items:center;gap:14px;transition:box-shadow .18s,transform .18s;}
        .stat-card:hover{box-shadow:0 6px 20px rgba(13,64,252,0.1);transform:translateY(-2px);}
        .stat-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
        .stat-val{font-size:30px;font-weight:800;line-height:1;margin-bottom:2px;}
        .stat-lbl{font-size:11px;font-weight:500;color:var(--gray-500);}
        .footer{text-align:center;padding:20px;color:var(--gray-500);font-size:12px;border-top:1px solid var(--gray-200);background:#fff;margin-top:32px;}
        .footer a{color:var(--primary);text-decoration:none;font-weight:600;}
      `}</style>

      <div dir="rtl">
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
            <span className="nav-title">لوحة المشرف</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href={`/${locale}`} className="nav-back">
              ← الرئيسية
            </Link>
            <LogoutButton locale={locale} />
          </div>
        </nav>

        <div className="hero">
          <div>
            <h1>مرحباً، {supervisor.name} 👋</h1>
            <p>{supervisor.bio || "مشرف أكاديمي في منصة سلوكيرا"}</p>
          </div>
          <div className="hero-date">
            {new Date().toLocaleDateString("ar-SA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
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
                <div className="stat-val">{supervisor.totalSessions ?? 0}</div>
                <div className="stat-lbl">إجمالي الجلسات</div>
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
          <div style={{ marginBottom: 20 }}>
            <AvailabilityManager supervisorId={supervisor.id} locale={locale} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <SeatsManager
              supervisorId={supervisor.id}
              currentSeats={supervisor.availableSeats ?? 0}
            />
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🔔</span>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}
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
            supervisor={supervisor}
          />
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
