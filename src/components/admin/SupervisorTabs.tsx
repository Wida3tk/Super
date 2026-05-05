'use client';

import { useState } from 'react';
import EditSupervisorPanel from './EditSupervisorPanel';
import ManageSupervisorAuth from './ManageSupervisorAuth';

interface Supervisor {
  id: string; name: string; email: string;
  bio?: string; specialization?: string;
  photo?: string; isActive: boolean; totalSessions?: number;
}

export default function SupervisorTabs({ supervisors }: { supervisors: Supervisor[] }) {
  const [tab, setTab] = useState<'edit' | 'table'>('edit');
  const [authSupervisor, setAuthSupervisor] = useState<any>(null);

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
      `}</style>

      <div className="sup-tabs">
        <button className={`sup-tab${tab==='edit'?' active':''}`} onClick={()=>setTab('edit')}>✏️ تعديل البيانات</button>
        <button className={`sup-tab${tab==='table'?' active':''}`} onClick={()=>setTab('table')}>📋 عرض الجدول</button>
      </div>

      {tab === 'edit' && <EditSupervisorPanel supervisors={supervisors} />}

      {tab === 'table' && (
        <div className="tbl-wrap">
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
                  <th className="c">الجلسات</th><th className="c">الحالة</th><th className="c">الصفحة</th>
                </tr>
              </thead>
              <tbody>
                {supervisors.map(s => (
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
                    <td className="c" style={{color:'#0D40FC',fontWeight:700}}>{s.totalSessions??'—'}</td>
                    <td className="c">
                      <span className={`badge ${s.isActive?'b-ok':'b-off'}`}>
                        {s.isActive?'● نشط':'○ موقوف'}
                      </span>
                    </td>
                    <td className="c">
                      <a href={`/ar/supervisor/${s.id}`} target="_blank" rel="noopener noreferrer"
                        style={{fontSize:12,color:'#0D40FC',textDecoration:'none',background:'rgba(13,64,252,0.07)',padding:'4px 10px',borderRadius:8,border:'1px solid rgba(13,64,252,0.15)'}}>
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
