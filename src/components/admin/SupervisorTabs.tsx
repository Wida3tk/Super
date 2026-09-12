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
  assignedTrainees?: number; isProtectedAdmin?: boolean;
}

export default function SupervisorTabs({ supervisors }: { supervisors: Supervisor[] }) {
  const [records, setRecords] = useState(supervisors);
  const [tab, setTab] = useState<'edit' | 'table'>('table');
  const [authSupervisor, setAuthSupervisor] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'stopped'>('all');
  const [workingId, setWorkingId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const visibleSupervisors = records.filter((supervisor) =>
    (statusFilter === 'all' || (statusFilter === 'active' ? supervisor.isActive : !supervisor.isActive)) &&
    [supervisor.name, supervisor.email].some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))
  );
  const activeCount = records.filter((supervisor) => supervisor.isActive).length;
  const toggleStatus = async (supervisor: Supervisor) => {
    const nextActive = !supervisor.isActive;
    if (!nextActive && !window.confirm(`إيقاف حساب ${supervisor.name}؟ لن يتمكن من تسجيل الدخول حتى إعادة تفعيله.`)) return;
    setWorkingId(supervisor.id); setActionMessage('');
    const response = await fetch('/api/admin/supervisor', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({supervisorId:supervisor.id,isActive:nextActive})});
    const data = await response.json().catch(()=>({}));
    if (response.ok) setRecords(current=>current.map(item=>item.id===supervisor.id?{...item,isActive:nextActive}:item));
    else setActionMessage(data.error==='ADMIN_PROTECTED'?'لا يمكن إيقاف حساب الإدارة الرئيسي.':'تعذر تحديث حالة الحساب.');
    setWorkingId('');
  };
  const deleteSupervisor = async (supervisor: Supervisor) => {
    if (supervisor.isProtectedAdmin) return setActionMessage('حساب الإدارة الرئيسي محمي ولا يمكن حذفه.');
    if (Number(supervisor.assignedTrainees||0)>0) return setActionMessage(`لا يمكن حذف ${supervisor.name} قبل نقل المتدربين المسندين إليه.`);
    if (Number(supervisor.upcomingBookings||0)>0) return setActionMessage(`لا يمكن حذف ${supervisor.name} لوجود مقابلات قادمة.`);
    const typed = window.prompt(`حذف حساب ${supervisor.name} نهائيًا؟\nاكتبي كلمة حذف للتأكيد:`);
    if (typed?.trim() !== 'حذف') return;
    setWorkingId(supervisor.id); setActionMessage('');
    const response = await fetch('/api/admin/supervisor', {method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({supervisorId:supervisor.id,confirmation:'DELETE_SUPERVISOR'})});
    const data = await response.json().catch(()=>({}));
    if (response.ok) { setRecords(current=>current.filter(item=>item.id!==supervisor.id)); setActionMessage(`تم حذف حساب ${supervisor.name}.`); }
    else {
      const messages:Record<string,string>={ADMIN_PROTECTED:'حساب الإدارة الرئيسي محمي.',HAS_ASSIGNED_TRAINEES:'المشرف مرتبط بمتدربين؛ انقليهم أولًا.',HAS_UPCOMING_BOOKINGS:'يوجد للمشرف مقابلات قادمة؛ ألغِيها أو انقليها أولًا.'};
      setActionMessage(messages[data.error]||'تعذر حذف الحساب.');
    }
    setWorkingId('');
  };

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
        .accounts-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:linear-gradient(125deg,#001442,#0D40FC);border-radius:18px;margin-bottom:14px;color:#fff}.accounts-hero h2{font-size:18px;margin:0 0 4px}.accounts-hero p{font-size:12px;color:#cad8ff;margin:0}.account-stats{display:flex;gap:8px}.account-stat{background:#ffffff12;border:1px solid #ffffff20;border-radius:12px;padding:9px 14px;text-align:center;min-width:88px}.account-stat b{display:block;font-size:20px}.account-stat span{font-size:10px;color:#cbd8ff}.account-tools{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #EEF2F7}.tool-filters{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.account-search{width:min(330px,100%);padding:9px 12px;border:1px solid #D1D9E6;border-radius:9px;font-family:inherit}.filter-btn{border:1px solid #D8E0EC;background:#fff;color:#64748B;padding:8px 11px;border-radius:9px;font:inherit;font-size:11px;cursor:pointer}.filter-btn.active{background:#EAF0FF;color:#0D40FC;border-color:#B8C8FF;font-weight:800}.row-actions{display:flex;gap:5px;justify-content:center}.row-action{border:0;border-radius:7px;padding:6px 9px;font:inherit;font-size:10px;font-weight:700;cursor:pointer}.row-action.stop{background:#FFF7ED;color:#C2410C}.row-action.start{background:#ECFDF5;color:#047857}.row-action.delete{background:#FEF2F2;color:#DC2626}.row-action:disabled{opacity:.45;cursor:not-allowed}.action-message{margin:8px 16px;padding:9px 12px;border-radius:9px;background:#EFF6FF;color:#1D4ED8;font-size:12px}@media(max-width:760px){.accounts-hero{align-items:flex-start;flex-direction:column}.account-tools{align-items:stretch;flex-direction:column}.account-stats{width:100%}.account-stat{flex:1}th,td{padding:11px 12px}}
      `}</style>

      <section className="accounts-hero">
        <div><h2>إدارة المشرفين من مكان واحد</h2><p>أنشئ الحسابات، راقب الإسناد والمواعيد، وأوقف أو احذف الحسابات غير المستخدمة.</p></div>
        <div className="account-stats"><div className="account-stat"><b>{records.length}</b><span>إجمالي الحسابات</span></div><div className="account-stat"><b>{activeCount}</b><span>حساب نشط</span></div><div className="account-stat"><b>{records.filter((item)=>item.accountType!=="consultant").reduce((sum, item) => sum + Number(item.availableSeats || 0), 0)}</b><span>مقاعد المشرفين</span></div></div>
      </section>

      <div className="sup-tabs">
        <button className={`sup-tab${tab==='table'?' active':''}`} onClick={()=>setTab('table')}>📋 الحسابات والعمليات</button>
        <button className={`sup-tab${tab==='edit'?' active':''}`} onClick={()=>setTab('edit')}>✏️ الصفحات التعريفية</button>
      </div>

      {tab === 'edit' && <EditSupervisorPanel supervisors={records} />}

      {tab === 'table' && (
        <div className="tbl-wrap">
          <div className="account-tools"><div className="tool-filters"><input className="account-search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="ابحث باسم المشرف أو بريده..."/>{([['all','الكل'],['active','النشطون'],['stopped','الموقوفون']] as const).map(([key,label])=><button key={key} className={`filter-btn${statusFilter===key?' active':''}`} onClick={()=>setStatusFilter(key)}>{label}</button>)}</div><AddSupervisorButton /></div>
          {actionMessage && <div className="action-message">{actionMessage}</div>}
          {records.length === 0 ? (
            <div style={{padding:'48px 24px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10,opacity:.3}}>👤</div>
              <div style={{color:'#8898AA',fontSize:14}}>لا يوجد مشرفون</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>المشرف</th><th>البريد</th>
                  <th className="c">المتدربون</th><th className="c">المقاعد</th><th className="c">المقابلات</th><th className="c">الحالة</th><th className="c">المواعيد</th><th className="c">الحساب</th><th className="c">الصفحة</th><th className="c">إجراءات</th>
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
                        <a href={`/ar/admin/supervisors/${s.id}`} style={{color:'#001442',fontWeight:700,textDecoration:'none'}}>{s.name||'—'}<small style={{display:'block',color:'#0D40FC',fontSize:10,fontWeight:600,marginTop:2}}>فتح ملف العمل ←</small></a>
                      </div>
                    </td>
                    <td style={{color:'#8898AA',fontSize:12}}>{s.email||'—'}</td>
                    <td className="c" style={{fontWeight:700}}>{s.assignedTrainees??0}</td>
                    <td className="c" style={{color:'#059669',fontWeight:700}}>{s.accountType === 'consultant' ? '—' : (s.availableSeats??0)}</td>
                    <td className="c" style={{color:'#0D40FC',fontWeight:700}}>{s.upcomingBookings??0}</td>
                    <td className="c">
                      <span className={`badge ${s.isActive?'b-ok':'b-off'}`}>
                        {s.isActive?'● نشط':'○ موقوف'}
                      </span>
                    </td>
                    <td className="c"><a href={`/ar/admin/supervisors/${s.id}#schedule`} style={{fontSize:11,color:'#047857',textDecoration:'none',background:'#ECFDF5',padding:'5px 10px',borderRadius:8,border:'1px solid #A7F3D0'}}>{s.accountType === 'consultant' ? 'إدارة المواعيد ←' : 'إدارة المواعيد والمقاعد ←'}</a></td>
                    <td className="c">
                      <button onClick={()=>setAuthSupervisor(s)} style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',color:'#d97706',fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
                        🔑 الحساب
                      </button>
                    </td>
                    <td className="c">
                      <a href={`/ar/supervisor/${(s as any).publicProfileId || s.id}`} target="_blank" rel="noopener noreferrer"
                        style={{fontSize:12,color:'#0D40FC',textDecoration:'none',background:'rgba(13,64,252,0.07)',padding:'5px 12px',borderRadius:8,border:'1px solid rgba(13,64,252,0.15)'}}>
                        🔗 فتح
                      </a>
                    </td>
                    <td className="c"><div className="row-actions"><button className={`row-action ${s.isActive?'stop':'start'}`} disabled={workingId===s.id||s.isProtectedAdmin} onClick={()=>toggleStatus(s)}>{s.isActive?'إيقاف':'تفعيل'}</button><button className="row-action delete" disabled={workingId===s.id||s.isProtectedAdmin||Number(s.assignedTrainees||0)>0||Number(s.upcomingBookings||0)>0} title={s.isProtectedAdmin?'حساب الإدارة محمي':Number(s.assignedTrainees||0)>0?'انقلي المتدربين أولًا':Number(s.upcomingBookings||0)>0?'توجد مقابلات قادمة':'حذف الحساب'} onClick={()=>deleteSupervisor(s)}>حذف</button></div></td>
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
