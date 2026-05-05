import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { redirect } from 'next/navigation';
import AvailabilityManager from '@/components/supervisor/AvailabilityManager';
import { cookies } from 'next/headers';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

interface Props {
  params: { locale: string };
}

async function getAuthenticatedSupervisor() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const supervisorSnap = await adminDb
      .collection('supervisors')
      .where('email', '==', decoded.email)
      .limit(1)
      .get();

    if (supervisorSnap.empty) return null;
    return { id: supervisorSnap.docs[0].id, ...supervisorSnap.docs[0].data() } as any;
  } catch {
    return null;
  }
}

export default async function SupervisorDashboardPage({ params }: Props) {
  const { locale } = await params;
  const supervisor = await getAuthenticatedSupervisor();

  if (!supervisor) redirect(`/${locale}/login`);

  const today = new Date().toISOString().split('T')[0];
  const bookingsSnap = await adminDb
    .collection('bookings')
    .where('supervisorId', '==', supervisor.id)
    .where('status', '==', 'confirmed')
    .where('date', '>=', today)
    .orderBy('date', 'asc')
    .get();

  const upcomingBookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
        :root {
          --white: #F3FCFF; --neon-blue: #55D7FF;
          --primary: #0D40FC; --deep-blue: #001442;
          --gray-100: #F8FAFC; --gray-200: #EEF2F7;
          --gray-300: #D1D9E6; --gray-500: #8898AA;
          --gray-700: #4A5568; --success: #10B981; --danger: #EF4444;
        }
        body { background: var(--gray-100); direction: rtl; color: var(--deep-blue); }

        .nav {
          background: var(--deep-blue); padding: 0 40px; height: 64px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 2px 16px rgba(1,20,66,0.18);
        }
        .nav-brand { display: flex; align-items: center; gap: 14px; }
        .nav-logo-text { font-size: 26px; font-weight: 800; color: var(--primary); letter-spacing: -1px; }
        .nav-logo-sub { font-size: 11px; font-weight: 500; color: var(--neon-blue); letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
        .nav-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.12); }
        .nav-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); }
        .nav-back {
          display: flex; align-items: center; gap: 6px;
          color: var(--neon-blue); text-decoration: none;
          font-size: 13px; font-weight: 500;
          padding: 7px 16px; border-radius: 8px;
          border: 1px solid rgba(85,215,255,0.25); transition: all 0.18s;
        }
        .nav-back:hover { background: rgba(85,215,255,0.1); color: #fff; border-color: rgba(85,215,255,0.5); }

        .hero {
          background: linear-gradient(135deg, var(--primary) 0%, var(--deep-blue) 100%);
          padding: 32px 40px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .hero h1 { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .hero p { font-size: 13px; color: rgba(255,255,255,0.6); }
        .hero-badge {
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7); font-size: 12px;
          padding: 6px 14px; border-radius: 20px;
        }

        .main { max-width: 1100px; margin: 0 auto; padding: 32px 40px 64px; }
        @media(max-width:768px){ .main { padding: 24px 16px 48px; } }

        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 28px; }

        .stat-card {
          background: #fff; border-radius: 16px; padding: 24px 20px;
          border: 1px solid var(--gray-200); box-shadow: 0 1px 4px rgba(1,20,66,0.06);
          display: flex; align-items: flex-start; gap: 16px;
          transition: box-shadow 0.18s, transform 0.18s;
        }
        .stat-card:hover { box-shadow: 0 6px 20px rgba(13,64,252,0.1); transform: translateY(-2px); }
        .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .stat-value { font-size: 36px; font-weight: 800; line-height: 1; margin-bottom: 4px; color: var(--primary); }
        .stat-label { font-size: 12px; font-weight: 500; color: var(--gray-500); }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media(max-width:800px){ .grid-2 { grid-template-columns: 1fr; } }

        .card {
          background: #fff; border-radius: 20px; border: 1px solid var(--gray-200);
          box-shadow: 0 1px 4px rgba(1,20,66,0.05); overflow: hidden;
        }
        .card-head {
          padding: 16px 24px; border-bottom: 1px solid var(--gray-200);
          display: flex; align-items: center; gap: 10px;
        }
        .card-icon { width: 34px; height: 34px; border-radius: 10px; background: rgba(13,64,252,0.07); display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .card-title { font-size: 15px; font-weight: 700; color: var(--deep-blue); }
        .count-chip {
          margin-right: auto; background: rgba(13,64,252,0.07); color: var(--primary);
          font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 20px;
          border: 1px solid rgba(13,64,252,0.15);
        }
        .card-body { padding: 20px 24px; }

        .booking-item {
          background: var(--gray-100); border-radius: 12px; padding: 14px 16px;
          margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start;
          border: 1px solid var(--gray-200);
        }
        .booking-item:last-child { margin-bottom: 0; }
        .b-name { font-size: 14px; font-weight: 600; color: var(--deep-blue); margin-bottom: 2px; }
        .b-email { font-size: 12px; color: var(--gray-500); }
        .b-date { font-size: 13px; font-weight: 600; color: var(--primary); text-align: end; }
        .b-time { font-size: 12px; color: var(--gray-500); text-align: end; }
        .b-meet { display: block; font-size: 12px; color: #10B981; margin-top: 6px; text-decoration: none; }
        .b-meet:hover { text-decoration: underline; }

        .empty { padding: 40px 24px; text-align: center; }
        .empty-ico { font-size: 32px; opacity: 0.3; margin-bottom: 8px; }
        .empty-txt { color: var(--gray-500); font-size: 14px; }

        .footer { text-align: center; padding: 24px; color: var(--gray-500); font-size: 12px; border-top: 1px solid var(--gray-200); background: #fff; margin-top: 40px; }
        .footer a { color: var(--primary); text-decoration: none; font-weight: 600; }
      `}</style>

      <div dir="rtl">
        {/* NAV */}
        <nav className="nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="nav-brand">
              <div>
                <div className="nav-logo-text">سلوكيرا</div>
                <div className="nav-logo-sub">Sulukera</div>
              </div>
            </div>
            <div className="nav-divider" />
            <span className="nav-title">لوحة المشرف</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Link href={`/${locale}`} className="nav-back">← الرئيسية</Link>
          <LogoutButton locale={locale} />
        </div>
        </nav>

        {/* HERO */}
        <div className="hero">
          <div>
            <h1>مرحباً، {supervisor.name} 👋</h1>
            <p>{supervisor.bio || 'مشرف أكاديمي في منصة سلوكيرا'}</p>
          </div>
          <div className="hero-badge">
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="main">
          {/* STATS */}
          <div className="stats">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(13,64,252,0.08)' }}>📋</div>
              <div>
                <div className="stat-value">{supervisor.totalSessions ?? 0}</div>
                <div className="stat-label">إجمالي الجلسات</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.08)' }}>⭐</div>
              <div>
                <div className="stat-value" style={{ color: '#d97706' }}>
                  {(supervisor.ratingAverage ?? 0).toFixed(1)}
                </div>
                <div className="stat-label">متوسط التقييم</div>
              </div>
            </div>
          </div>

          {/* GRID */}
          <div className="grid-2">
            {/* Availability Manager */}
            <AvailabilityManager supervisorId={supervisor.id} locale={locale} />

            {/* Upcoming Sessions */}
            <div className="card">
              <div className="card-head">
                <div className="card-icon">🗓️</div>
                <span className="card-title">الجلسات القادمة</span>
                <span className="count-chip">{upcomingBookings.length}</span>
              </div>
              <div className="card-body">
                {upcomingBookings.length === 0 ? (
                  <div className="empty">
                    <div className="empty-ico">📭</div>
                    <div className="empty-txt">لا توجد جلسات قادمة</div>
                  </div>
                ) : (
                  upcomingBookings.map((b: any) => (
                    <div key={b.id} className="booking-item">
                      <div>
                        <div className="b-name">{b.studentName || '—'}</div>
                        <div className="b-email">{b.studentEmail || '—'}</div>
                        {b.meetLink && (
                          <a href={b.meetLink} target="_blank" rel="noopener noreferrer" className="b-meet">
                            🎥 رابط Google Meet
                          </a>
                        )}
                      </div>
                      <div>
                        <div className="b-date">{b.date}</div>
                        <div className="b-time">{b.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="footer">
          منصة الإشراف الأكاديمي · <a href="https://sulukera.com" target="_blank">سلوكيرا</a> © {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
}
