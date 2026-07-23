import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/layout/AdminSidebar';
import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';

interface Props { params: Promise<{ locale: string }>; }

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) return null;
    return { adminDb };
  } catch { return null; }
}

export default async function AdminDashboardPage({ params }: Props) {
  const { locale } = await params;
  const auth = await verifyAdmin();
  if (!auth) redirect(`/${locale}/login`);
  const { adminDb } = auth;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [traineesSnap, supervisorsSnap, sessionsSnap, snapshotsSnap, activitySnap, notifsSnap] = await Promise.all([
    adminDb.collection('trainees').get(),
    adminDb.collection('supervisors').get(),
    adminDb.collection('sessions').where('month', '==', currentMonth).get(),
    adminDb.collection('monthlySnapshots').where('month', '==', currentMonth).get(),
    adminDb.collection('activityLog').orderBy('createdAt', 'desc').limit(8).get(),
    adminDb.collection('notifications').where('read', '==', false).get(),
  ]);

  const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const snapshots = snapshotsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const activities = activitySnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const notifCount = notifsSnap.size;

  const activeTrainees = trainees.filter(t => t.status === 'active');
  const onboardingTrainees = trainees.filter(t => t.status === 'onboarding');
  const readyToAssign = trainees.filter(t => t.status === 'onboarding' && t.onboardingStage === 'contracting');
  const totalHours = snapshots.reduce((a, s) => a + (s.totalHours || 0), 0);
  const weekSessions = sessions.filter(s => s.date >= weekAgo);
  const over25 = snapshots.filter(s => (s.groupPercentage || 0) > 25);
  const atRisk = trainees.filter(t => {
    if (t.status !== 'active') return false;
    const snap = snapshots.find(s => s.traineeId === t.id);
    return snap && (snap.absenceCount || 0) >= 3;
  });

  const traineeProgress = activeTrainees.map(t => {
    const snap = snapshots.find(s => s.traineeId === t.id);
    const pct = t.requiredHours > 0 ? Math.round(((snap?.totalHours || 0) / t.requiredHours) * 100) : 0;
    return { ...t, pct, totalHours: snap?.totalHours || 0, snap };
  }).sort((a, b) => b.pct - a.pct).slice(0, 6);

  const timeAgo = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  const activityIcon = (type: string) => {
    if (type === 'session') return { icon: '⏱️', bg: '#EEF2FF', color: '#4F46E5' };
    if (type === 'trainee_added') return { icon: '👤', bg: '#F0FDF4', color: '#16A34A' };
    if (type === 'assigned') return { icon: '🔗', bg: '#FFF7ED', color: '#EA580C' };
    return { icon: '📋', bg: '#F8FAFC', color: '#64748B' };
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
        body { background: #F1F5F9; direction: rtl; color: #0F172A; }
        .layout { display: flex; min-height: 100vh; }
        .main { flex: 1; overflow: auto; }

        .topbar {
          background: #fff;
          border-bottom: 1px solid #E2E8F0;
          padding: 0 28px;
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 10;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .topbar-left { display: flex; flex-direction: column; }
        .topbar-title { font-size: 16px; font-weight: 700; color: #0F172A; }
        .topbar-date { font-size: 11px; color: #94A3B8; margin-top: 1px; }

        .content { padding: 24px 28px; max-width: 1400px; }

        /* Alert Cards */
        .alerts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
        .alert-card {
          background: #fff; border-radius: 16px; padding: 18px 20px;
          border: 1px solid #E2E8F0;
          display: flex; align-items: center; gap: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: transform 0.15s, box-shadow 0.15s;
          text-decoration: none; color: inherit;
        }
        .alert-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .alert-icon-wrap {
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; flex-shrink: 0;
        }
        .alert-count { font-size: 28px; font-weight: 800; line-height: 1; margin-bottom: 3px; }
        .alert-label { font-size: 13px; font-weight: 500; color: #334155; }
        .alert-sub { font-size: 11px; color: #94A3B8; margin-top: 2px; }

        /* Stats */
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        .stat-card {
          background: #fff; border-radius: 16px; padding: 18px 20px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          position: relative; overflow: hidden;
        }
        .stat-card::before {
          content: ''; position: absolute;
          top: 0; right: 0; width: 80px; height: 80px;
          border-radius: 0 16px 0 80px;
          opacity: 0.06;
        }
        .stat-icon { font-size: 28px; margin-bottom: 10px; }
        .stat-val { font-size: 30px; font-weight: 800; color: #0F172A; line-height: 1; }
        .stat-label { font-size: 12px; color: #64748B; margin-top: 4px; font-weight: 500; }
        .stat-note { font-size: 11px; color: #94A3B8; margin-top: 3px; }

        /* Bottom grid */
        .bottom { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }

        .card {
          background: #fff; border-radius: 16px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          overflow: hidden;
        }
        .card-head {
          padding: 14px 18px; border-bottom: 1px solid #F1F5F9;
          display: flex; align-items: center; justify-content: space-between;
          background: #FAFAFA;
        }
        .card-title { font-size: 13px; font-weight: 600; color: #0F172A; display: flex; align-items: center; gap: 7px; }
        .card-title-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .card-body { padding: 8px 0; }

        /* Feed */
        .feed-item { display: flex; gap: 12px; padding: 11px 18px; border-bottom: 1px solid #F8FAFC; align-items: flex-start; }
        .feed-item:last-child { border-bottom: none; }
        .feed-avatar { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .feed-text { font-size: 12.5px; color: #334155; line-height: 1.5; }
        .feed-time { font-size: 11px; color: #94A3B8; margin-top: 3px; }

        /* Progress */
        .prog-item { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-bottom: 1px solid #F8FAFC; }
        .prog-item:last-child { border-bottom: none; }
        .prog-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; background: #EEF2FF; color: #4F46E5; }
        .prog-name { font-size: 12px; font-weight: 500; color: #1E293B; width: 80px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .prog-bar-wrap { flex: 1; height: 6px; background: #F1F5F9; border-radius: 99px; overflow: hidden; }
        .prog-fill { height: 100%; border-radius: 99px; transition: width 0.3s; }
        .prog-pct { font-size: 11px; font-weight: 600; min-width: 34px; text-align: left; }
        .badge { font-size: 10px; padding: 2px 7px; border-radius: 99px; font-weight: 600; white-space: nowrap; }

        /* Right col */
        .right-col { display: flex; flex-direction: column; gap: 16px; }

        /* Supervisor rows */
        .sup-row { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-bottom: 1px solid #F8FAFC; }
        .sup-row:last-child { border-bottom: none; }
        .sup-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #0D40FC, #55D7FF); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .sup-hours { font-size: 20px; font-weight: 800; color: #0D40FC; min-width: 36px; text-align: center; }

        @media(max-width:1100px){.alerts{grid-template-columns:1fr 1fr;}.stats{grid-template-columns:1fr 1fr;}.bottom{grid-template-columns:1fr;}}
        @media(max-width:700px){.alerts{grid-template-columns:1fr;}.stats{grid-template-columns:1fr 1fr;}}
      `}</style>

      <div className="layout" dir="rtl">
        <AdminSidebar locale={locale} notifCount={notifCount} />

        <div className="main">
          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-left">
              <div className="topbar-title">لوحة التحكم</div>
              <div className="topbar-date">
                {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link href={`/${locale}/admin/notifications`}
                style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                <i className="ti ti-bell" style={{ fontSize: 18, color: '#64748B' }} aria-hidden="true" />
                {notifCount > 0 && (
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', border: '1.5px solid #fff' }} />
                )}
              </Link>
              <LogoutButton locale={locale} />
            </div>
          </div>

          <div className="content">

            {/* تنبيهات */}
            <div className="alerts">
              <Link href={`/${locale}/admin/onboarding`} className="alert-card" style={{ borderColor: readyToAssign.length > 0 ? '#FCA5A5' : '#E2E8F0' }}>
                <div className="alert-icon-wrap" style={{ background: readyToAssign.length > 0 ? '#FEF2F2' : '#F8FAFC' }}>
                  <span>🎯</span>
                </div>
                <div>
                  <div className="alert-count" style={{ color: readyToAssign.length > 0 ? '#DC2626' : '#64748B' }}>{readyToAssign.length}</div>
                  <div className="alert-label">جاهزون للإسناد</div>
                  <div className="alert-sub">أكملوا مرحلة التعاقد</div>
                </div>
              </Link>

              <Link href={`/${locale}/admin/trainees`} className="alert-card" style={{ borderColor: over25.length > 0 ? '#FCD34D' : '#E2E8F0' }}>
                <div className="alert-icon-wrap" style={{ background: over25.length > 0 ? '#FFFBEB' : '#F8FAFC' }}>
                  <span>⚠️</span>
                </div>
                <div>
                  <div className="alert-count" style={{ color: over25.length > 0 ? '#D97706' : '#64748B' }}>{over25.length}</div>
                  <div className="alert-label">تجاوزوا 25% جماعية</div>
                  <div className="alert-sub">يحتاجون مراجعة</div>
                </div>
              </Link>

              <Link href={`/${locale}/admin/trainees`} className="alert-card" style={{ borderColor: atRisk.length > 0 ? '#FCA5A5' : '#E2E8F0' }}>
                <div className="alert-icon-wrap" style={{ background: atRisk.length > 0 ? '#FEF2F2' : '#F8FAFC' }}>
                  <span>🚨</span>
                </div>
                <div>
                  <div className="alert-count" style={{ color: atRisk.length > 0 ? '#DC2626' : '#64748B' }}>{atRisk.length}</div>
                  <div className="alert-label">متدربون في خطر</div>
                  <div className="alert-sub">3+ غيابات هذا الشهر</div>
                </div>
              </Link>
            </div>

            {/* إحصائيات */}
            <div className="stats">
              <div className="stat-card" style={{ borderTop: '3px solid #0D40FC' }}>
                <div className="stat-icon">⏱️</div>
                <div className="stat-val" style={{ color: '#0D40FC' }}>{totalHours}</div>
                <div className="stat-label">ساعات الشهر</div>
                <div className="stat-note">إجمالي كل المشرفين</div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid #10B981' }}>
                <div className="stat-icon">👥</div>
                <div className="stat-val" style={{ color: '#10B981' }}>{activeTrainees.length}</div>
                <div className="stat-label">متدربون نشطون</div>
                <div className="stat-note">من أصل {trainees.length}</div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid #8B5CF6' }}>
                <div className="stat-icon">📋</div>
                <div className="stat-val" style={{ color: '#8B5CF6' }}>{weekSessions.length}</div>
                <div className="stat-label">جلسات هذا الأسبوع</div>
                <div className="stat-note">فردية وجماعية</div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid #F59E0B' }}>
                <div className="stat-icon">🎓</div>
                <div className="stat-val" style={{ color: '#F59E0B' }}>{onboardingTrainees.length}</div>
                <div className="stat-label">قيد البوردنق</div>
                <div className="stat-note">منهم {readyToAssign.length} جاهز للإسناد</div>
              </div>
            </div>

            {/* Bottom */}
            <div className="bottom">

              {/* Feed */}
              <div className="card">
                <div className="card-head">
                  <div className="card-title">
                    <div className="card-title-icon" style={{ background: '#EEF2FF' }}>
                      <i className="ti ti-activity" style={{ fontSize: 15, color: '#4F46E5' }} aria-hidden="true" />
                    </div>
                    آخر النشاطات
                  </div>
                  <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '3px 8px', borderRadius: 99 }}>{activities.length} حدث</span>
                </div>
                <div className="card-body">
                  {activities.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>📭</div>
                      <div style={{ color: '#94A3B8', fontSize: 13 }}>لا توجد نشاطات بعد</div>
                      <div style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>ستظهر هنا عند تسجيل الجلسات وإضافة المتدربين</div>
                    </div>
                  ) : activities.map(a => {
                    const cfg = activityIcon(a.type);
                    return (
                      <div key={a.id} className="feed-item">
                        <div className="feed-avatar" style={{ background: cfg.bg }}>
                          {cfg.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="feed-text">{a.message}</div>
                          <div className="feed-time">{timeAgo(a.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* اليمين */}
              <div className="right-col">

                {/* تقدم المتدربين */}
                <div className="card">
                  <div className="card-head">
                    <div className="card-title">
                      <div className="card-title-icon" style={{ background: '#F0FDF4' }}>
                        <i className="ti ti-target" style={{ fontSize: 15, color: '#16A34A' }} aria-hidden="true" />
                      </div>
                      تقدم نحو الرخصة
                    </div>
                    <span style={{ fontSize: 11, color: '#0D40FC', background: '#EEF2FF', padding: '3px 8px', borderRadius: 99, fontWeight: 600 }}>الشهر الحالي</span>
                  </div>
                  <div className="card-body">
                    {traineeProgress.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>لا يوجد متدربون نشطون</div>
                    ) : traineeProgress.map(t => (
                      <div key={t.id} className="prog-item">
                        <div className="prog-avatar">{t.name?.slice(0, 2)}</div>
                        <div className="prog-name">{t.name}</div>
                        <div className="prog-bar-wrap">
                          <div className="prog-fill" style={{ width: `${t.pct}%`, background: t.pct >= 100 ? '#10B981' : t.pct >= 75 ? '#0D40FC' : t.pct >= 50 ? '#8B5CF6' : '#F59E0B' }} />
                        </div>
                        <div className="prog-pct" style={{ color: t.pct >= 100 ? '#10B981' : '#64748B' }}>{t.pct}%</div>
                        {t.pct >= 100 && <span className="badge" style={{ background: '#F0FDF4', color: '#16A34A' }}>✓</span>}
                        {t.pct >= 85 && t.pct < 100 && <span className="badge" style={{ background: '#FFF7ED', color: '#EA580C' }}>قريب</span>}
                        {(t.snap?.absenceCount || 0) >= 3 && <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>خطر</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* المشرفون */}
                <div className="card">
                  <div className="card-head">
                    <div className="card-title">
                      <div className="card-title-icon" style={{ background: '#EFF6FF' }}>
                        <i className="ti ti-chart-bar" style={{ fontSize: 15, color: '#2563EB' }} aria-hidden="true" />
                      </div>
                      إنتاجية المشرفين
                    </div>
                    <Link href={`/${locale}/admin/supervisors`} style={{ fontSize: 11, color: '#0D40FC', textDecoration: 'none', fontWeight: 500 }}>
                      عرض الكل ←
                    </Link>
                  </div>
                  <div className="card-body">
                    {supervisors.map(sup => {
                      const supSnaps = snapshots.filter(s => s.supervisorId === sup.id);
                      const total = supSnaps.reduce((a, s) => a + (s.totalHours || 0), 0);
                      const count = activeTrainees.filter(t => t.currentSupervisorId === sup.id).length;
                      return (
                        <div key={sup.id} className="sup-row">
                          <div className="sup-avatar">{sup.name?.slice(0, 2)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1E293B' }}>{sup.name}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{count} متدرب نشط</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div className="sup-hours">{total}</div>
                            <div style={{ fontSize: 10, color: '#94A3B8' }}>ساعة</div>
                          </div>
                        </div>
                      );
                    })}
                    {supervisors.length === 0 && (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>لا يوجد مشرفون</div>
                    )}
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
