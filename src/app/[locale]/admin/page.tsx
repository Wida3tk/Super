import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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
    console.error('Admin page error:', error);
    data = null;
  }

  if (!data) {
    redirect(`/${locale}/login`);
  }

  const { bookings, supervisors } = data;
  const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
  const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;

  const stats = [
    { label: 'إجمالي الحجوزات', value: bookings.length, icon: '📋', bg: '#0d1f3c', accent: '#3b82f6', borderColor: '#1d4ed8' },
    { label: 'مؤكدة', value: confirmed, icon: '✅', bg: '#0d2818', accent: '#22c55e', borderColor: '#15803d' },
    { label: 'ملغاة', value: cancelled, icon: '❌', bg: '#2a0d0d', accent: '#ef4444', borderColor: '#b91c1c' },
    { label: 'المشرفون', value: supervisors.length, icon: '👨‍🏫', bg: '#1a0d2e', accent: '#a855f7', borderColor: '#7c3aed' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
        body { background: #060c1a; direction: rtl; }

        .admin-root { min-height: 100vh; background: #060c1a; }

        .topnav {
          position: sticky; top: 0; z-index: 99;
          background: rgba(6,12,26,0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(59,130,246,0.15);
          padding: 0 32px;
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .topnav-brand { display: flex; align-items: center; gap: 8px; color: #fff; font-weight: 700; font-size: 17px; text-decoration: none; }
        .topnav-brand-accent { color: #60a5fa; }
        .topnav-back {
          color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 500;
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 8px;
          border: 1px solid rgba(148,163,184,0.15);
          transition: all 0.2s;
        }
        .topnav-back:hover { color: #e2e8f0; border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.07); }

        .main { max-width: 1240px; margin: 0 auto; padding: 36px 24px 64px; }

        .greeting { margin-bottom: 36px; }
        .greeting h1 { font-size: 26px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
        .greeting p { color: #475569; font-size: 14px; }

        .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 36px; }
        @media(max-width:900px){ .stats { grid-template-columns: repeat(2,1fr); } }
        @media(max-width:480px){ .stats { grid-template-columns: 1fr 1fr; } }

        .stat {
          border-radius: 18px; padding: 22px 20px;
          border: 1px solid; position: relative; overflow: hidden;
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .stat:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .stat-icon { font-size: 20px; margin-bottom: 14px; }
        .stat-num { font-size: 44px; font-weight: 800; line-height: 1; margin-bottom: 6px; }
        .stat-lbl { font-size: 12px; color: #94a3b8; font-weight: 500; letter-spacing: 0.02em; }

        .card {
          background: #0b1220; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px; overflow: hidden; margin-bottom: 24px;
        }
        .card-head {
          padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: space-between;
        }
        .card-title { font-size: 15px; font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 10px; }
        .pill { background: rgba(96,165,250,0.12); color: #60a5fa; font-size: 11px; padding: 2px 10px; border-radius: 20px; border: 1px solid rgba(96,165,250,0.2); font-weight: 600; }

        .csv-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg,#059669,#065f46);
          color: #fff; text-decoration: none; font-size: 13px; font-weight: 600;
          padding: 8px 18px; border-radius: 10px;
          box-shadow: 0 2px 10px rgba(5,150,105,0.25);
          transition: all 0.2s;
        }
        .csv-btn:hover { box-shadow: 0 4px 16px rgba(5,150,105,0.4); transform: translateY(-1px); }

        .tbl-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        thead { background: rgba(255,255,255,0.02); }
        th { padding: 11px 20px; color: #475569; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; text-align: right; }
        th.center { text-align: center; }
        td { padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.04); color: #94a3b8; }
        td.name { color: #e2e8f0; font-weight: 500; }
        td.center { text-align: center; }
        tbody tr { transition: background 0.12s; }
        tbody tr:hover { background: rgba(96,165,250,0.03); }

        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .b-confirmed { background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
        .b-cancelled { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
        .b-pending { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); }
        .b-active { background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
        .b-off { background: rgba(100,116,139,0.12); color: #64748b; border: 1px solid rgba(100,116,139,0.2); }

        .avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg,#3b82f6,#6366f1);
          display: inline-flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 13px;
          margin-left: 10px; flex-shrink: 0;
        }
        .name-row { display: flex; align-items: center; }

        .empty { padding: 48px 24px; text-align: center; }
        .empty-ico { font-size: 36px; margin-bottom: 10px; opacity: 0.4; }
        .empty-txt { color: #334155; font-size: 14px; }
      `}</style>

      <div className="admin-root" dir="rtl">
        <nav className="topnav">
          <span className="topnav-brand">
            <span className="topnav-brand-accent">◆</span> لوحة الإدارة
          </span>
          <Link href={`/${locale}`} className="topnav-back">← الرئيسية</Link>
        </nav>

        <div className="main">
          <div className="greeting">
            <h1>مرحباً بك 👋</h1>
            <p>نظرة عامة على منصة الإشراف الأكاديمي</p>
          </div>

          <div className="stats">
            {stats.map(s => (
              <div key={s.label} className="stat" style={{ background: s.bg, borderColor: s.borderColor + '55' }}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-num" style={{ color: s.accent }}>{s.value}</div>
                <div className="stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Bookings */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                الحجوزات <span className="pill">{bookings.length}</span>
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
                      <th>الطالب</th>
                      <th>البريد</th>
                      <th className="center">التاريخ</th>
                      <th className="center">الوقت</th>
                      <th className="center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b: any) => (
                      <tr key={b.id}>
                        <td className="name">{b.studentName || '—'}</td>
                        <td style={{ fontSize: 12 }}>{b.studentEmail || '—'}</td>
                        <td className="center">{b.date || '—'}</td>
                        <td className="center">{b.time || '—'}</td>
                        <td className="center">
                          <span className={`badge ${b.status === 'confirmed' ? 'b-confirmed' : b.status === 'cancelled' ? 'b-cancelled' : 'b-pending'}`}>
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

          {/* Supervisors */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                المشرفون <span className="pill">{supervisors.length}</span>
              </div>
            </div>
            <div className="tbl-wrap">
              {supervisors.length === 0 ? (
                <div className="empty"><div className="empty-ico">👤</div><div className="empty-txt">لا يوجد مشرفون</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>المشرف</th>
                      <th>البريد</th>
                      <th className="center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisors.map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <div className="name-row">
                            <span className="avatar">{(s.name || 'م')[0]}</span>
                            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{s.name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{s.email || '—'}</td>
                        <td className="center">
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
      </div>
    </>
  );
}
