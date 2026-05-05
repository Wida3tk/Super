import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AddSupervisorButton from '@/components/admin/AddSupervisorButton';
import EditSupervisorPanel from '@/components/admin/EditSupervisorPanel';

interface Props { params: { locale: string }; }

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
  } catch { data = null; }

  if (!data) redirect(`/${locale}/login`);

  const { bookings, supervisors } = data;
  const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
  const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        :root{--primary:#0D40FC;--deep:#001442;--neon:#55D7FF;--gray-100:#F8FAFC;--gray-200:#EEF2F7;--gray-300:#D1D9E6;--gray-500:#8898AA;--gray-700:#4A5568;--success:#10B981;--danger:#EF4444;}
        body{background:var(--gray-100);direction:rtl;color:var(--deep);}
        .nav{background:var(--deep);padding:0 40px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(1,20,66,0.18);}
        .nav-brand{display:flex;align-items:center;gap:14px;}
        .nav-logo{font-size:26px;font-weight:800;color:var(--primary);letter-spacing:-1px;}
        .nav-sub{font-size:11px;font-weight:500;color:var(--neon);letter-spacing:0.12em;text-transform:uppercase;opacity:.85;}
        .nav-div{width:1px;height:28px;background:rgba(255,255,255,0.12);}
        .nav-title{font-size:14px;font-weight:600;color:rgba(255,255,255,0.7);}
        .nav-back{display:flex;align-items:center;gap:6px;color:var(--neon);text-decoration:none;font-size:13px;font-weight:500;padding:7px 16px;border-radius:8px;border:1px solid rgba(85,215,255,0.25);transition:all .18s;}
        .nav-back:hover{background:rgba(85,215,255,0.1);border-color:rgba(85,215,255,0.5);color:#fff;}
        .hero{background:linear-gradient(135deg,var(--primary) 0%,var(--deep) 100%);padding:32px 40px;display:flex;align-items:center;justify-content:space-between;}
        .hero h1{font-size:22px;font-weight:700;color:#fff;margin-bottom:4px;}
        .hero p{font-size:13px;color:rgba(255,255,255,0.6);}
        .hero-date{font-size:12px;color:rgba(255,255,255,0.45);background:rgba(255,255,255,0.08);padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);}
        .main{max-width:1280px;margin:0 auto;padding:32px 40px 64px;}
        @media(max-width:768px){.main{padding:24px 16px 48px;}}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;}
        @media(max-width:900px){.stats{grid-template-columns:repeat(2,1fr);}}
        .stat-card{background:#fff;border-radius:16px;padding:24px 20px;border:1px solid var(--gray-200);box-shadow:0 1px 4px rgba(1,20,66,0.06);display:flex;align-items:flex-start;gap:16px;transition:box-shadow .18s,transform .18s;}
        .stat-card:hover{box-shadow:0 6px 20px rgba(13,64,252,0.1);transform:translateY(-2px);}
        .stat-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
        .stat-val{font-size:36px;font-weight:800;line-height:1;margin-bottom:4px;}
        .stat-lbl{font-size:12px;font-weight:500;color:var(--gray-500);}
        .section{background:#fff;border-radius:20px;border:1px solid var(--gray-200);box-shadow:0 1px 4px rgba(1,20,66,0.05);overflow:hidden;margin-bottom:24px;}
        .section-head{padding:18px 24px;border-bottom:1px solid var(--gray-200);display:flex;align-items:center;justify-content:space-between;background:#fff;}
        .section-head-left{display:flex;align-items:center;gap:12px;}
        .section-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;background:rgba(13,64,252,0.07);}
        .section-title{font-size:15px;font-weight:700;color:var(--deep);}
        .count-chip{background:rgba(13,64,252,0.07);color:var(--primary);font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;border:1px solid rgba(13,64,252,0.15);}
        .csv-btn{display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 18px;border-radius:10px;box-shadow:0 2px 8px rgba(13,64,252,0.25);transition:all .18s;}
        .csv-btn:hover{background:#0935d4;transform:translateY(-1px);}
        .tbl-wrap{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;font-size:13.5px;}
        thead{background:var(--gray-100);}
        th{padding:11px 20px;color:var(--gray-500);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;text-align:right;border-bottom:1px solid var(--gray-200);}
        th.c{text-align:center;}
        td{padding:14px 20px;border-bottom:1px solid var(--gray-200);color:var(--gray-700);vertical-align:middle;}
        td.c{text-align:center;}
        tbody tr:last-child td{border-bottom:none;}
        tbody tr{transition:background .12s;}
        tbody tr:hover{background:rgba(13,64,252,0.025);}
        .badge{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;}
        .b-ok{background:rgba(16,185,129,0.1);color:#059669;border:1px solid rgba(16,185,129,0.2);}
        .b-cancel{background:rgba(239,68,68,0.08);color:#dc2626;border:1px solid rgba(239,68,68,0.15);}
        .b-pend{background:rgba(245,158,11,0.1);color:#d97706;border:1px solid rgba(245,158,11,0.2);}
        .sup-tabs{display:flex;border-bottom:1px solid var(--gray-200);}
        .sup-tab{padding:13px 24px;font-size:13px;font-weight:600;color:var(--gray-500);cursor:pointer;border-bottom:2px solid transparent;transition:all .18s;}
        .sup-tab.active{color:var(--primary);border-bottom-color:var(--primary);}
        .footer{text-align:center;padding:24px;color:var(--gray-500);font-size:12px;border-top:1px solid var(--gray-200);background:#fff;margin-top:40px;}
        .footer a{color:var(--primary);text-decoration:none;font-weight:600;}
      `}</style>

      <div dir="rtl">
        <nav className="nav">
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div className="nav-brand">
              <div>
                <div className="nav-logo">سلوكيرا</div>
                <div className="nav-sub">Sulukera</div>
              </div>
            </div>
            <div className="nav-div"/>
            <span className="nav-title">لوحة الإدارة</span>
          </div>
          <Link href={`/${locale}`} className="nav-back">← الرئيسية</Link>
        </nav>

        <div className="hero">
          <div>
            <h1>مرحباً 👋 — لوحة التحكم الرئيسية</h1>
            <p>إدارة الحجوزات والمشرفين في منصة الإشراف الأكاديمي</p>
          </div>
          <div className="hero-date">
            {new Date().toLocaleDateString('ar-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </div>
        </div>

        <div className="main">
          {/* STATS */}
          <div className="stats">
            {[
              {icon:'📋',val:bookings.length,lbl:'إجمالي الحجوزات',clr:'#0D40FC',bg:'rgba(13,64,252,0.08)'},
              {icon:'✅',val:confirmed,lbl:'حجوزات مؤكدة',clr:'#10B981',bg:'rgba(16,185,129,0.08)'},
              {icon:'❌',val:cancelled,lbl:'حجوزات ملغاة',clr:'#EF4444',bg:'rgba(239,68,68,0.08)'},
              {icon:'👨‍🏫',val:supervisors.length,lbl:'المشرفون النشطون',clr:'#001442',bg:'rgba(85,215,255,0.1)'},
            ].map(s => (
              <div key={s.lbl} className="stat-card">
                <div className="stat-icon" style={{background:s.bg}}>{s.icon}</div>
                <div>
                  <div className="stat-val" style={{color:s.clr}}>{s.val}</div>
                  <div className="stat-lbl">{s.lbl}</div>
                </div>
              </div>
            ))}
          </div>

          {/* BOOKINGS */}
          <div className="section">
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
                <div style={{padding:'48px 24px',textAlign:'center'}}>
                  <div style={{fontSize:36,marginBottom:10,opacity:.3}}>📭</div>
                  <div style={{color:'var(--gray-500)',fontSize:14}}>لا توجد حجوزات بعد</div>
                </div>
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
                        <td style={{color:'var(--deep)',fontWeight:600}}>{b.studentName||'—'}</td>
                        <td style={{color:'var(--gray-500)',fontSize:12}}>{b.studentEmail||'—'}</td>
                        <td className="c">{b.date||'—'}</td>
                        <td className="c">{b.time||'—'}</td>
                        <td className="c">
                          <span className={`badge ${b.status==='confirmed'?'b-ok':b.status==='cancelled'?'b-cancel':'b-pend'}`}>
                            {b.status==='confirmed'?'✓ مؤكد':b.status==='cancelled'?'✕ ملغى':'⏳ معلق'}
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
          <div className="section">
            <div className="section-head">
              <div className="section-head-left">
                <div className="section-icon">👨‍🏫</div>
                <span className="section-title">المشرفون</span>
                <span className="count-chip">{supervisors.length}</span>
              </div>
              <AddSupervisorButton />
            </div>

            {/* TABS */}
            <div className="sup-tabs">
              <div className="sup-tab active" id="tab-edit" onClick={() => {
                document.getElementById('panel-edit')!.style.display = 'block';
                document.getElementById('panel-table')!.style.display = 'none';
                document.getElementById('tab-edit')!.classList.add('active');
                document.getElementById('tab-table')!.classList.remove('active');
              }}>✏️ تعديل البيانات</div>
              <div className="sup-tab" id="tab-table" onClick={() => {
                document.getElementById('panel-table')!.style.display = 'block';
                document.getElementById('panel-edit')!.style.display = 'none';
                document.getElementById('tab-table')!.classList.add('active');
                document.getElementById('tab-edit')!.classList.remove('active');
              }}>📋 عرض الجدول</div>
            </div>

            {/* EDIT PANEL */}
            <div id="panel-edit">
              <EditSupervisorPanel supervisors={supervisors} />
            </div>

            {/* TABLE PANEL */}
            <div id="panel-table" style={{display:'none'}} className="tbl-wrap">
              {supervisors.length === 0 ? (
                <div style={{padding:'48px 24px',textAlign:'center'}}>
                  <div style={{fontSize:36,marginBottom:10,opacity:.3}}>👤</div>
                  <div style={{color:'var(--gray-500)',fontSize:14}}>لا يوجد مشرفون</div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>المشرف</th><th>البريد</th><th className="c">الجلسات</th><th className="c">الحالة</th><th className="c">الصفحة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisors.map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#0D40FC,#55D7FF)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,overflow:'hidden',flexShrink:0}}>
                              {s.photo ? <img src={s.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (s.name||'م')[0]}
                            </div>
                            <span style={{color:'var(--deep)',fontWeight:600}}>{s.name||'—'}</span>
                          </div>
                        </td>
                        <td style={{color:'var(--gray-500)',fontSize:12}}>{s.email||'—'}</td>
                        <td className="c" style={{color:'var(--primary)',fontWeight:700}}>{s.totalSessions??'—'}</td>
                        <td className="c">
                          <span className={`badge ${s.isActive?'b-ok':'badge b-cancel'}`}>
                            {s.isActive?'● نشط':'○ موقوف'}
                          </span>
                        </td>
                        <td className="c">
                          <a href={`/ar/supervisor/${s.id}`} target="_blank" rel="noopener noreferrer"
                            style={{fontSize:12,color:'var(--primary)',textDecoration:'none',background:'rgba(13,64,252,0.07)',padding:'4px 10px',borderRadius:8,border:'1px solid rgba(13,64,252,0.15)'}}>
                            🔗 فتح
                          </a>
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
