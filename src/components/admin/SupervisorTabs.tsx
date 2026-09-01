'use client';

import { useState } from 'react';
import EditSupervisorPanel from './EditSupervisorPanel';
import ManageSupervisorAuth from './ManageSupervisorAuth';
import AddSupervisorButton from './AddSupervisorButton';

interface Supervisor {
  id: string; name: string; email: string;
  bio?: string; specialization?: string;
  photo?: string; isActive: boolean; totalSessions?: number;
  availableSeats?: number; upcomingBookings?: number; authUid?: string; accountType?: string;
}

export default function SupervisorTabs({ supervisors }: { supervisors: Supervisor[] }) {
  const [tab, setTab] = useState<'edit' | 'table'>('table');
  const [authSupervisor, setAuthSupervisor] = useState<any>(null);
  const [search, setSearch] = useState('');
  const visibleSupervisors = supervisors.filter((supervisor) => [supervisor.name, supervisor.email].some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const activeCount = supervisors.filter((supervisor) => supervisor.isActive).length;

  return (
    <>
      <style>{`
        .sup-tabs{display:flex;border-bottom:1px solid #EEF2F7;}
        .sup-tab{padding:13px 24px;font-size:13px;font-weight:600;color:#8898AA;cursor:pointer;border-bottom:2px solid transparent;transition:all .18s;background:none;border-top:none;border-left:none;border-right:none;font-family:inherit;}
        .sup-tab.active{color:#0D40FC;border-bottom-color:#0D40FC;}
        .tbl-wrap{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;font-size:13.5px;}
        thead{background:#F8FAFC;}
        th{padding:11px 20px;color:#8898AA;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;text-align:right;border-bottom:1px solid #EEF2F7;}
        th.c{text-align:center;}
        td{padding:14px 20px;border-bottom:1px solid #EEF2F7;color:#4A5568;vertical-align:middle;}
        td.c{text-align:center;}
        tbody tr:last-child td{border-bottom:none;}
        tbody tr:hover{background:rgba(13,64,252,0.025);}
        .badge{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;}
        .b-ok{background:rgba(16,185,129,0.1);color:#059669;border:1px solid rgba(16,185,129,0.2);}
        .b-off{background:rgba(100,116,139,0.08);color:#64748b;border:1px solid rgba(100,116,139,0.15);}
        .accounts-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:linear-gradient(125deg,#001442,#0D40FC);border-radius:18px;margin-bottom:14px;color:#fff}.accounts-hero h2{font-size:18px;margin:0 0 4px}.accounts-hero p{font-size:12px;color:#cad8ff;margin:0}.account-stats{display:flex;gap:8px}.account-stat{background:#ffffff12;border:1px solid #ffffff20;border-radius:12px;padding:9px 14px;text-align:center;min-width:88px}.account-stat b{display:block;font-size:20px}.account-stat span{font-size:10px;color:#cbd8ff}.account-tools{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #EEF2F7}.account-search{width:min(330px,100%);padding:9px 12px;border:1px solid #D1D9E6;border-radius:9px;font-family:inherit}@media(max-width:760px){.accounts-hero{align-items:flex-start;flex-direction:column}.account-tools{align-items:stretch;flex-direction:column}.account-stats{width:100%}.account-stat{flex:1}th,td{padding:11px 12px}}
      `}</style>

      <section className="accounts-hero">
        <div><h2>الحساب والصفحة التعريفية في مكان واحد</h2><p>تابع المواعيد للجميع، ومقاعد المشرفين فقط، وحدّث صفحاتهم العامة.</p></div>
        <div className="account-stats"><div className="account-stat"><b>{supervisors.length}</b><span>إجمالي الحسابات</span></div><div className="account-stat"><b>{activeCount}</b><span>حساب نشط</span></div><div className="account-stat"><b>{supervisors.filter((item)=>item.accountType!=="consultant").reduce((sum, item) => sum + Number(item.availableSeats || 0), 0)}</b><span>مقاعد المشرفين</span></div></div>
      </section>

      <div className="sup-tabs">
        <button className={`sup-tab${tab==='table'?' active':''}`} onClick={()=>setTab('table')}>📋 الحسابات والعمليات</button>
        <button className={`sup-tab${tab==='edit'?' active':''}`} onClick={()=>setTab('edit')}>✏️ الصفحات التعريفية</button>
      </div>

      {tab === 'edit' && <EditSupervisorPanel supervisors={supervisors} />}

      {tab === 'table' && (
        <div className="tbl-wrap">
          <div className="account-tools"><input className="account-search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="ابحث باسم المشرف أو بريده..."/><AddSupervisorButton /></div>
          {supervisors.length === 0 ? (
            <div style={{padding:'48px 24px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10,opacity:.3}}>👤</div>
              <div style={{color:'#8898AA',fontSize:14}}>لا يوجد مشرفون</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>المشرف</th><th>البريد</th>
                  <th className="c">المقاعد</th><th className="c">المقابلات القادمة</th><th className="c">الحالة</th><th className="c">التشغيل</th><th className="c">الحساب</th><th className="c">الصفحة</th>
                </tr>
              </thead>
              <tbody>
                {visibleSupervisors.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#0D40FC,#55D7FF)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,overflow:'hidden',flexShrink:0}}>
                          {s.photo
                            ? <img src={s.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                            : (s.name||'م')[0]
                          }
                        </div>
                        <span style={{color:'#001442',fontWeight:600}}>{s.name||'—'}</span>
                      </div>
                    </td>
                    <td style={{color:'#8898AA',fontSize:12}}>{s.email||'—'}</td>
                    <td className="c" style={{color:'#059669',fontWeight:700}}>{s.accountType === 'consultant' ? '—' : (s.availableSeats??0)}</td>
                    <td className="c" style={{color:'#0D40FC',fontWeight:700}}>{s.upcomingBookings??0}</td>
                    <td className="c">
                      <span className={`badge ${s.isActive?'b-ok':'b-off'}`}>
                        {s.isActive?'● نشط':'○ موقوف'}
                      </span>
                    </td>
                    <td className="c"><a href={`/ar/admin/supervisors/${s.id}`} style={{fontSize:11,color:'#047857',textDecoration:'none',background:'#ECFDF5',padding:'5px 10px',borderRadius:8,border:'1px solid #A7F3D0'}}>{s.accountType === 'consultant' ? 'المواعيد ←' : 'المواعيد والمقاعد ←'}</a></td>
                    <td className="c">
                      <button onClick={()=>setAuthSupervisor(s)} style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',color:'#d97706',fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
                        🔑 الحساب
                      </button>
                    </td>
                    <td className="c">
                      <a href={`/ar/supervisor/${s.id}`} target="_blank" rel="noopener noreferrer"
                        style={{fontSize:12,color:'#0D40FC',textDecoration:'none',background:'rgba(13,64,252,0.07)',padding:'5px 12px',borderRadius:8,border:'1px solid rgba(13,64,252,0.15)'}}>
                        🔗 فتح
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {authSupervisor && (
        <ManageSupervisorAuth
          supervisor={authSupervisor}
          onClose={() => { setAuthSupervisor(null); window.location.reload(); }}
        />
      )}
    </>
  );
}
