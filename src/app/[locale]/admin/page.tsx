import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AddSupervisorButton from '@/components/admin/AddSupervisorButton';

interface Props {
  params: { locale: string };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;

  let data: any = null;

  try {
    const { adminDb, adminAuth } = await import('@/lib/firebase/admin');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;

    if (sessionCookie) {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      if (decoded.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) {
        const [bookingsSnap, supervisorsSnap] = await Promise.all([
          adminDb.collection('bookings').get(),
          adminDb.collection('supervisors').get(),
        ]);
        data = {
          bookings: bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          supervisors: supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        };
      }
    }
  } catch (error) {
    data = null;
  }

  if (!data) redirect(`/${locale}/login`);

  const { bookings, supervisors } = data;
  const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
  const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;

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
          --gray-700: #4A5568; --success: #10B981;
          --danger: #EF4444; --warning: #F59E0B;
        }
        body { background: var(--gray-100); direction: rtl; color: var(--deep-blue); }
        .nav { background: var(--deep-blue); padding: 0 40px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 16px rgba(1,20,66,0.18); }
        .nav-brand { display: flex; align-items: center; gap: 14px; }
        .nav-logo-text { font-size: 26px; font-weight: 800; color: var(--primary); letter-spacing: -1px; line-height: 1; }
        .nav-logo-sub { font-size: 11px; font-weight: 500; color: var(--neon-blue); letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
        .nav-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.12); }
        .nav-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); letter-spacing: 0.03em; }
        .nav-back { display: flex; align-items: center; gap: 6px; color: var(--neon-blue); text-decoration: none; font-size: 13px; font-weight: 500; padding: 7px 16px; border-radius: 8px; border: 1px solid rgba(85,215,255,0.25); transition: all 0.18s; }
        .nav-back:hover { background: rgba(85,215,255,0.1); border-color: rgba(85,215,255,0.5); color: #fff; }
        .hero-strip { background: linear-gradient(135deg, var(--primary) 0%, var(--deep-blue) 100%); padding: 32px 40px; display: flex; align-items: center; justify-content: space-between; }
        .hero-greet h1 { font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .hero-greet p { font-size: 13px; color: rgba(255,255,255,0.6); }
        .hero-date { font-size: 12px; color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.08); padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); }
        .main { max-width: 1280px; margin: 0 auto; padding: 32px 40px 64px; }
        @media(max-width:768px){ .main { padding: 24px 16px 48px; } }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        @media(max-width:900px){ .stats { grid-template-columns: repeat(2,1fr); } }
        .stat-card { background: #fff; border-radius: 16px; padding: 24px 20px; border: 1px solid var(--gray-200); box-shadow: 0 1px 4px rgba(1,20,66,0.06); display: flex; align-items: flex-start; gap: 16px; transition: box-shadow 0.18s, transform 0.18s; }
        .stat-card:hover { box-shadow: 0 6px 20px rgba(13,64,252,0.1); transform: translateY(-2px); }
        .stat-icon-wrap { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .stat-value { font-size: 36px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
        .stat-label { font-size: 12px; font-weight: 500; color: var(--gray-500); letter-spacing: 0.02em; }
        .stat-total .stat-icon-wrap { background: rgba(13,64,252,0.08); } .stat-total .stat-value { color: var(--primary); }
        .stat-ok .stat-icon-wrap { background: rgba(16,185,129,0.08); } .stat-ok .stat-value { color: var(--success); }
        .stat-cancel .stat-icon-wrap { background: rgba(239,68,68,0.08); } .stat-cancel .stat-value { color: var(--danger); }
        .stat-sup .stat-icon-wrap { background: rgba(85,215,255,0.1); } .stat-sup .stat-value { color: var(--deep-blue); }
        .section-card { background: #fff; border-radius: 20px; border: 1px solid var(--gray-200); box-shadow: 0 1px 4px rgba(1,20,66,0.05); overflow: hidden; margin-bottom: 24px; }
        .section-head { padding: 18px 24px; border-bottom: 1px solid var(--gray-200); display: flex; align-items: center; justify-content: space-between; background: #fff; }
        .section-head-left { display: flex; align-items: center; gap: 12px; }
        .section-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; background: rgba(13,64,252,0.07); }
        .section-title { font-size: 15px; font-weight: 700; color: var(--deep-blue); }
        .count-chip { background: rgba(13,64,252,0.07); color: var(--primary); font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 20px; border: 1px solid rgba(13,64,252,0.15); }
        .head-actions { display: flex; align-items: center; gap: 10px; }
        .csv-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--primary); color: #fff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 10px; box-shadow: 0 2px 8px rgba(13,64,252,0.25); transition: all 0.18s; }
        .csv-btn:hover { background: #0935d4; box-shadow: 0 4px 14px rgba(13,64,252,0.35); transform: translateY(-1px); }
        .tbl-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        thead { background: var(--gray-100); }
        th { padding: 11px 20px; color: var(--gray-500); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap; text-align: right; border-bottom: 1px solid var(--gray-200); }
        th.c { text-align: center; }
        td { padding: 14px 20px; border-bottom: 1px solid var(--gray-200); color: var(--gray-700); vertical-align: middle; }
        td.c { text-align: center; }
        td.name { color: var(--deep-blue); font-weight: 600; }
        td.email { color: var(--gray-500); font-size: 12px; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr { transition: background 0.12s; }
        tbody tr:hover { background: rgba(13,64,252,0.025); }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; }
        .b-ok { background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .b-cancel { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.15); }
        .b-pend { background: rgba(245,158,11,0.1); color: #d97706; border: 1px solid rgba(245,158,11,0.2); }
        .b-active { background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .b-off { background: rgba(100,116,139,0.08); color: #64748b; border: 1px solid rgba(100,116,139,0.15); }
        .avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--neon-blue)); display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(13,64,252,0.2); }
        .name-row { display: flex; align-items: center; gap: 10px; }
        .empty { padding: 48px 24px; text-align: center; }
        .empty-ico { font-size: 36px; margin-bottom: 10px; opacity: 0.3; }
        .empty-txt { color: var(--gray-500); font-size: 14px; }
        .footer { text-align: center; padding: 24px; color: var(--gray-500); font-size: 12px; border-top: 1px solid var(--gray-200); background: #fff; margin-top: 40px; }
        .footer a { color: var(--primary); text-decoration: none; font-weight: 600; }
      `}</style>

      <div dir="rtl">
        <nav className="nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="nav-brand">
              <div>
                <div className="nav-logo-text">سلوكيرا</div>
                <div className="nav-logo-sub">Sulukera</div>
              </div>
            </div>
            <div className="nav-divider" />
            <span className="nav-title">لوحة الإدارة</span>
          </div>
          <Link href={`/${locale}`} className="nav-back">← الرئيسية</Link>
        </nav>

        <div className="hero-strip">
          <div className="hero-greet">
            <h1>مرحباً 👋 — لوحة التحكم الرئيسية</h1>
            <p>إدارة الحجوزات والمشرفين في منصة الإشراف الأكاديمي</p>
          </div>
          <div className="hero-date">
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="main">
          <div className="stats">
            <div className="stat-card stat-total">
              <div className="stat-icon-wrap">📋</div>
              <div className="stat-info">
                <div className="stat-value">{bookings.length}</div>
                <div className="stat-label">إجمالي الحجوزات</div>
              </div>
            </div>
            <div className="stat-card stat-ok">
              <div className="stat-icon-wrap">✅</div>
              <div className="stat-info">
                <div className="stat-value">{confirmed}</div>
                <div className="stat-label">حجوزات مؤكدة</div>
              </div>
            </div>
            <div className="stat-card stat-cancel">
              <div className="stat-icon-wrap">❌</div>
              <div className="stat-info">
                <div className="stat-value">{cancelled}</div>
                <div className="stat-label">حجوزات ملغاة</div>
              </div>
            </div>
            <div className="stat-card stat-sup">
              <div className="stat-icon-wrap">👨‍🏫</div>
              <div className="stat-info">
                <div className="stat-value">{supervisors.length}</div>
                <div className="stat-label">المشرفون النشطون</div>
              </div>
            </div>
          </div>

          {/* BOOKINGS */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-head-left">
                <div className="section-icon">📅</div>
                <span className="section-title">الحجوزات</span>
                <span className="count-chip">{bookings.length}</span>
              </div>
              <a href="/api/admin/export" className="csv-btn">📥 تصدير CSV</a>
            </div>
            <div className="tbl-wrap">
              {bookings.length === 0 ? (
                <div className="empty"><div className="empty-ico">📭</div><div className="empty-txt">لا توجد حجوزات بعد</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>الطالب</th><th>البريد الإلكتروني</th>
                      <th className="c">التاريخ</th><th className="c">الوقت</th><th className="c">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b: any) => (
                      <tr key={b.id}>
                        <td className="name">{b.studentName || '—'}</td>
                        <td className="email">{b.studentEmail || '—'}</td>
                        <td className="c">{b.date || '—'}</td>
                        <td className="c">{b.time || '—'}</td>
                        <td className="c">
                          <span className={`badge ${b.status === 'confirmed' ? 'b-ok' : b.status === 'cancelled' ? 'b-cancel' : 'b-pend'}`}>
                            {b.status === 'confirmed' ? '✓ مؤكد' : b.status === 'cancelled' ? '✕ ملغى' : '⏳ معلق'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* SUPERVISORS */}
          <div className="section-card">
            <div className="section-head">
              <div className="section-head-left">
                <div className="section-icon">👨‍🏫</div>
                <span className="section-title">المشرفون</span>
                <span className="count-chip">{supervisors.length}</span>
              </div>
              <AddSupervisorButton />
            </div>
            <div className="tbl-wrap">
              {supervisors.length === 0 ? (
                <div className="empty"><div className="empty-ico">👤</div><div className="empty-txt">لا يوجد مشرفون — أضف أول مشرف الآن</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>المشرف</th><th>البريد الإلكتروني</th>
                      <th className="c">الجلسات</th><th className="c">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisors.map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <div className="name-row">
                            <span className="avatar">{(s.name || 'م')[0]}</span>
                            <span className="name">{s.name || '—'}</span>
                          </div>
                        </td>
                        <td className="email">{s.email || '—'}</td>
                        <td className="c" style={{ color: 'var(--primary)', fontWeight: 700 }}>{s.totalSessions ?? '—'}</td>
                        <td className="c">
                          <span className={`badge ${s.isActive ? 'b-active' : 'b-off'}`}>
                            {s.isActive ? '● نشط' : '○ موقوف'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
