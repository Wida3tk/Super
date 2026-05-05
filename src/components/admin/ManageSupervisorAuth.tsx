'use client';

import { useState } from 'react';

interface Props {
  supervisor: { id: string; name: string; email: string; isActive: boolean };
  onClose: () => void;
}

export default function ManageSupervisorAuth({ supervisor, onClose }: Props) {
  const [tab, setTab] = useState<'password' | 'email'>('password');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState(supervisor.email);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  const call = async (action: string, extra: any = {}) => {
    setLoading(true); setMsg(''); setIsError(false);
    try {
      const res = await fetch('/api/admin/manage-supervisor-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: supervisor.id, action, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`✅ ${data.message}`);
        if (action === 'resetPassword') setNewPassword('');
        setTimeout(() => { if (action !== 'disable' && action !== 'enable') {} }, 1500);
      } else {
        setIsError(true);
        setMsg(`❌ ${data.error}`);
      }
    } catch {
      setIsError(true); setMsg('❌ خطأ في الاتصال');
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        .ma-overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,20,66,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;animation:maFade .18s ease;}
        @keyframes maFade{from{opacity:0}to{opacity:1}}
        .ma-modal{background:#fff;border-radius:24px;width:100%;max-width:460px;box-shadow:0 24px 64px rgba(1,20,66,0.25);animation:maSlide .22s ease;overflow:hidden;}
        @keyframes maSlide{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .ma-head{background:linear-gradient(135deg,#001442,#0D2080);padding:20px 28px;display:flex;align-items:center;justify-content:space-between;}
        .ma-head-info{display:flex;align-items:center;gap:12px;}
        .ma-avatar{width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;}
        .ma-name{font-size:15px;font-weight:700;color:#fff;}
        .ma-email-txt{font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;}
        .ma-close{background:rgba(255,255,255,0.1);border:none;width:32px;height:32px;border-radius:8px;color:rgba(255,255,255,0.7);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
        .ma-close:hover{background:rgba(255,255,255,0.2);color:#fff;}
        .ma-tabs{display:flex;border-bottom:1px solid #EEF2F7;}
        .ma-tab{flex:1;padding:12px;font-size:13px;font-weight:600;color:#8898AA;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all .18s;font-family:inherit;}
        .ma-tab.active{color:#0D40FC;border-bottom-color:#0D40FC;}
        .ma-body{padding:24px 28px;}
        .ma-label{display:block;font-size:12px;font-weight:700;color:#8898AA;margin-bottom:7px;letter-spacing:.04em;}
        .ma-input{width:100%;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;border-radius:10px;padding:11px 14px;font-size:14px;transition:all .15s;font-family:inherit;direction:ltr;text-align:left;}
        .ma-input:focus{outline:none;border-color:#0D40FC;box-shadow:0 0 0 3px rgba(13,64,252,0.08);background:#fff;}
        .ma-field{margin-bottom:16px;}
        .ma-hint{font-size:11px;color:#94A3B8;margin-top:5px;}
        .ma-msg{padding:10px 14px;border-radius:10px;font-size:13px;font-weight:500;margin-bottom:16px;}
        .ma-msg.ok{background:rgba(16,185,129,0.08);color:#059669;border:1px solid rgba(16,185,129,0.2);}
        .ma-msg.err{background:rgba(239,68,68,0.08);color:#dc2626;border:1px solid rgba(239,68,68,0.2);}
        .ma-btn{width:100%;background:#0D40FC;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;transition:all .18s;font-family:inherit;box-shadow:0 2px 8px rgba(13,64,252,0.25);}
        .ma-btn:hover:not(:disabled){background:#0929b4;box-shadow:0 5px 16px rgba(13,64,252,0.35);}
        .ma-btn:disabled{background:#CBD5E1;box-shadow:none;cursor:not-allowed;}
        .ma-danger{background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.2);border-radius:14px;padding:16px 20px;margin-top:16px;}
        .ma-danger-title{font-size:13px;font-weight:700;color:#dc2626;margin-bottom:10px;}
        .ma-danger-btn{width:100%;background:none;border:1.5px solid rgba(239,68,68,0.3);color:#dc2626;border-radius:10px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;font-family:inherit;}
        .ma-danger-btn:hover{background:rgba(239,68,68,0.08);}
      `}</style>

      <div className="ma-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ma-modal" dir="rtl">
          <div className="ma-head">
            <div className="ma-head-info">
              <div className="ma-avatar">{(supervisor.name||'م')[0]}</div>
              <div>
                <div className="ma-name">{supervisor.name}</div>
                <div className="ma-email-txt">{supervisor.email}</div>
              </div>
            </div>
            <button className="ma-close" onClick={onClose}>✕</button>
          </div>

          <div className="ma-tabs">
            <button className={`ma-tab${tab==='password'?' active':''}`} onClick={()=>setTab('password')}>🔑 كلمة المرور</button>
            <button className={`ma-tab${tab==='email'?' active':''}`} onClick={()=>setTab('email')}>✉️ البريد الإلكتروني</button>
          </div>

          <div className="ma-body">
            {msg && <div className={`ma-msg ${isError?'err':'ok'}`}>{msg}</div>}

            {tab === 'password' && (
              <>
                <div className="ma-field">
                  <label className="ma-label">كلمة المرور الجديدة</label>
                  <input className="ma-input" type="password" placeholder="8 أحرف على الأقل"
                    value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} />
                  <div className="ma-hint">سيتمكن المشرف من الدخول بكلمة المرور الجديدة فوراً</div>
                </div>
                <button className="ma-btn" disabled={loading||newPassword.length<8}
                  onClick={()=>call('resetPassword',{newPassword})}>
                  {loading?'⏳ جارٍ التغيير...':'🔑 تغيير كلمة المرور'}
                </button>
              </>
            )}

            {tab === 'email' && (
              <>
                <div className="ma-field">
                  <label className="ma-label">البريد الإلكتروني الجديد</label>
                  <input className="ma-input" type="email" placeholder="new@email.com"
                    value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
                  <div className="ma-hint">يتم تحديثه في Firebase Auth وFirestore معاً</div>
                </div>
                <button className="ma-btn" disabled={loading||!newEmail||newEmail===supervisor.email}
                  onClick={()=>call('changeEmail',{newEmail})}>
                  {loading?'⏳ جارٍ التغيير...':'✉️ تغيير البريد الإلكتروني'}
                </button>
              </>
            )}

            <div className="ma-danger">
              <div className="ma-danger-title">⚠️ إجراءات الحساب</div>
              {supervisor.isActive ? (
                <button className="ma-danger-btn" disabled={loading}
                  onClick={()=>call('disable')}>
                  {loading?'⏳...':'🔴 تعطيل الحساب مؤقتاً'}
                </button>
              ) : (
                <button className="ma-danger-btn" style={{color:'#059669',borderColor:'rgba(16,185,129,0.3)'}}
                  disabled={loading} onClick={()=>call('enable')}>
                  {loading?'⏳...':'🟢 إعادة تفعيل الحساب'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
