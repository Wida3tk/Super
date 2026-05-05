'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const sections = [
  { id: 'brand',   label: 'الهوية والاسم',    icon: '🏷️' },
  { id: 'hero',    label: 'الصفحة الرئيسية',  icon: '🖼️' },
  { id: 'stats',   label: 'الإحصائيات',       icon: '📊' },
  { id: 'colors',  label: 'الألوان',           icon: '🎨' },
  { id: 'session', label: 'إعدادات الجلسة',   icon: '⚙️' },
];

export default function CMSPage() {
  const [active, setActive] = useState('brand');
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch('/api/admin/cms').then(r => r.json()).then(d => {
      setSettings(d.settings || {});
      setLoading(false);
    });
  }, []);

  const set = (key: string, val: string) => setSettings((p: any) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true); setMsg(''); setIsError(false);
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) { setMsg('✅ تم الحفظ بنجاح'); }
      else { setIsError(true); setMsg('❌ ' + data.error); }
    } catch { setIsError(true); setMsg('❌ خطأ في الاتصال'); }
    setSaving(false);
  };

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#001442',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:16,direction:'rtl'}}>
      ⏳ جارٍ التحميل...
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        body{background:#F8FAFC;direction:rtl;}

        .nav{background:#001442;height:64px;padding:0 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(1,20,66,0.2);}
        .nav-logo{font-size:22px;font-weight:800;color:#0D40FC;}
        .nav-sub{font-size:10px;color:#55D7FF;letter-spacing:.12em;opacity:.8;}
        .nav-div{width:1px;height:28px;background:rgba(255,255,255,0.12);}
        .nav-title{font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);}
        .nav-back{color:#55D7FF;text-decoration:none;font-size:13px;font-weight:500;padding:6px 14px;border-radius:8px;border:1px solid rgba(85,215,255,0.25);transition:all .18s;}
        .nav-back:hover{background:rgba(85,215,255,0.1);}

        .layout{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 64px);}
        @media(max-width:768px){.layout{grid-template-columns:1fr;}}

        .sidebar{background:#fff;border-left:1px solid #EEF2F7;padding:24px 0;}
        .sidebar-title{font-size:11px;font-weight:700;color:#8898AA;letter-spacing:.06em;padding:0 20px 12px;text-transform:uppercase;}
        .sidebar-item{display:flex;align-items:center;gap:10px;padding:11px 20px;font-size:14px;font-weight:500;color:#4A5568;cursor:pointer;transition:all .15s;border-right:3px solid transparent;}
        .sidebar-item:hover{background:#F8FAFC;color:#001442;}
        .sidebar-item.active{background:rgba(13,64,252,0.06);color:#0D40FC;font-weight:700;border-right-color:#0D40FC;}
        .sidebar-icon{font-size:18px;}

        .content{padding:32px;}
        @media(max-width:768px){.content{padding:20px;}}

        .section-header{margin-bottom:24px;}
        .section-title{font-size:20px;font-weight:800;color:#001442;margin-bottom:4px;}
        .section-sub{font-size:13px;color:#8898AA;}

        .fields-card{background:#fff;border-radius:18px;border:1px solid #EEF2F7;box-shadow:0 1px 4px rgba(1,20,66,0.05);padding:28px;margin-bottom:20px;}
        .fields-card-title{font-size:14px;font-weight:700;color:#001442;margin-bottom:20px;display:flex;align-items:center;gap:8px;}

        .field{margin-bottom:20px;}
        .field:last-child{margin-bottom:0;}
        .field-label{display:block;font-size:12px;font-weight:700;color:#8898AA;margin-bottom:7px;letter-spacing:.04em;}
        .field-input{width:100%;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;border-radius:10px;padding:11px 14px;font-size:14px;transition:all .15s;font-family:inherit;}
        .field-input:focus{outline:none;border-color:#0D40FC;box-shadow:0 0 0 3px rgba(13,64,252,0.08);background:#fff;}
        .field-textarea{width:100%;background:#F8FAFC;border:1.5px solid #D1D9E6;color:#001442;border-radius:10px;padding:11px 14px;font-size:14px;transition:all .15s;font-family:inherit;resize:vertical;min-height:90px;line-height:1.7;}
        .field-textarea:focus{outline:none;border-color:#0D40FC;box-shadow:0 0 0 3px rgba(13,64,252,0.08);background:#fff;}
        .field-hint{font-size:11px;color:#94A3B8;margin-top:5px;}

        .color-row{display:flex;align-items:center;gap:12px;}
        .color-preview{width:40px;height:40px;border-radius:10px;border:2px solid #EEF2F7;flex-shrink:0;cursor:pointer;transition:transform .15s;}
        .color-preview:hover{transform:scale(1.1);}
        .color-input-text{flex:1;}

        .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .stat-pair{background:#F8FAFC;border:1px solid #EEF2F7;border-radius:12px;padding:16px;}
        .stat-pair-title{font-size:12px;font-weight:700;color:#8898AA;margin-bottom:12px;}

        .save-bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #EEF2F7;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 -4px 16px rgba(1,20,66,0.06);}
        .save-msg{font-size:13px;font-weight:500;}
        .save-msg.ok{color:#059669;}
        .save-msg.err{color:#dc2626;}
        .save-btn{background:#0D40FC;color:#fff;border:none;border-radius:12px;padding:12px 32px;font-size:14px;font-weight:700;cursor:pointer;transition:all .18s;font-family:inherit;box-shadow:0 2px 8px rgba(13,64,252,0.25);}
        .save-btn:hover:not(:disabled){background:#0929b4;box-shadow:0 5px 16px rgba(13,64,252,0.35);}
        .save-btn:disabled{background:#CBD5E1;box-shadow:none;cursor:not-allowed;}

        .preview-box{background:linear-gradient(135deg,#001442,#0D2080);border-radius:14px;padding:20px 24px;margin-bottom:16px;}
        .preview-label{font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:.08em;margin-bottom:10px;text-transform:uppercase;}
        .preview-site-name{font-size:28px;font-weight:900;line-height:1;margin-bottom:2px;}
        .preview-site-sub{font-size:11px;letter-spacing:.15em;opacity:.7;}
      `}</style>

      <div dir="rtl">
        <nav className="nav">
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div>
              <div className="nav-logo">سلوكيرا</div>
              <div className="nav-sub">Sulukera</div>
            </div>
            <div className="nav-div"/>
            <span className="nav-title">لوحة التحكم بالمحتوى</span>
          </div>
          <Link href="/ar/admin" className="nav-back">← لوحة الإدارة</Link>
        </nav>

        <div className="layout">
          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="sidebar-title">الأقسام</div>
            {sections.map(s => (
              <div key={s.id} className={`sidebar-item${active===s.id?' active':''}`} onClick={()=>setActive(s.id)}>
                <span className="sidebar-icon">{s.icon}</span>
                {s.label}
              </div>
            ))}
          </div>

          {/* CONTENT */}
          <div className="content">

            {/* BRAND */}
            {active === 'brand' && (
              <>
                <div className="section-header">
                  <div className="section-title">🏷️ الهوية والاسم</div>
                  <div className="section-sub">اسم الموقع والعلامة التجارية</div>
                </div>

                <div className="preview-box">
                  <div className="preview-label">معاينة مباشرة</div>
                  <div className="preview-site-name" style={{color: settings.primaryColor||'#0D40FC'}}>{settings.siteName||'سلوكيرا'}</div>
                  <div className="preview-site-sub" style={{color:'#55D7FF'}}>{settings.siteNameEn||'SULUKERA'}</div>
                </div>

                <div className="fields-card">
                  <div className="fields-card-title">📝 اسم الموقع</div>
                  <div className="field">
                    <label className="field-label">الاسم بالعربي</label>
                    <input className="field-input" value={settings.siteName||''} onChange={e=>set('siteName',e.target.value)} placeholder="سلوكيرا" />
                  </div>
                  <div className="field">
                    <label className="field-label">الاسم بالإنجليزي</label>
                    <input className="field-input" value={settings.siteNameEn||''} onChange={e=>set('siteNameEn',e.target.value)} placeholder="Sulukera" style={{direction:'ltr'}} />
                  </div>
                  <div className="field">
                    <label className="field-label">وصف الموقع (للـ SEO)</label>
                    <textarea className="field-textarea" value={settings.heroTagline||''} onChange={e=>set('heroTagline',e.target.value)} placeholder="منصة الإشراف الأكاديمي" />
                  </div>
                </div>
              </>
            )}

            {/* HERO */}
            {active === 'hero' && (
              <>
                <div className="section-header">
                  <div className="section-title">🖼️ الصفحة الرئيسية</div>
                  <div className="section-sub">النصوص الظاهرة في أعلى الصفحة</div>
                </div>
                <div className="fields-card">
                  <div className="fields-card-title">📣 العنوان الرئيسي</div>
                  <div className="field">
                    <label className="field-label">العنوان الكبير</label>
                    <textarea className="field-textarea" value={settings.heroTitle||''} onChange={e=>set('heroTitle',e.target.value)} placeholder="احجز جلستك مع مشرفك الأكاديمي في دقيقتين" rows={2} />
                    <div className="field-hint">الكلمة الزرقاء هي الكلمة الثانية تلقائياً</div>
                  </div>
                  <div className="field">
                    <label className="field-label">النص التوضيحي</label>
                    <textarea className="field-textarea" value={settings.heroSubtitle||''} onChange={e=>set('heroSubtitle',e.target.value)} rows={3} />
                  </div>
                  <div className="field">
                    <label className="field-label">السطر الصغير تحت العنوان</label>
                    <input className="field-input" value={settings.heroCaption||''} onChange={e=>set('heroCaption',e.target.value)} placeholder="احجز موعدك بسهولة، تواصل مع مشرفك..." />
                  </div>
                </div>
              </>
            )}

            {/* STATS */}
            {active === 'stats' && (
              <>
                <div className="section-header">
                  <div className="section-title">📊 الإحصائيات</div>
                  <div className="section-sub">الأرقام التي تظهر في الصفحة الرئيسية</div>
                </div>
                <div className="fields-card">
                  <div className="fields-card-title">🔢 الأرقام والتسميات</div>
                  <div className="stats-grid">
                    {[
                      {v:'stat1Value',l:'stat1Label',name:'الإحصائية الأولى'},
                      {v:'stat2Value',l:'stat2Label',name:'الإحصائية الثانية'},
                      {v:'stat3Value',l:'stat3Label',name:'الإحصائية الثالثة'},
                    ].map(s => (
                      <div key={s.v} className="stat-pair">
                        <div className="stat-pair-title">{s.name}</div>
                        <div className="field" style={{marginBottom:10}}>
                          <label className="field-label">الرقم أو القيمة</label>
                          <input className="field-input" value={settings[s.v]||''} onChange={e=>set(s.v,e.target.value)} placeholder="+3" />
                        </div>
                        <div className="field" style={{marginBottom:0}}>
                          <label className="field-label">التسمية</label>
                          <input className="field-input" value={settings[s.l]||''} onChange={e=>set(s.l,e.target.value)} placeholder="مشرف متخصص" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* COLORS */}
            {active === 'colors' && (
              <>
                <div className="section-header">
                  <div className="section-title">🎨 الألوان</div>
                  <div className="section-sub">ألوان الهوية البصرية للموقع</div>
                </div>
                <div className="fields-card">
                  <div className="fields-card-title">🖌️ ألوان النظام</div>
                  {[
                    {key:'primaryColor', label:'اللون الأساسي (الأزرق)', default:'#0D40FC'},
                    {key:'deepColor',    label:'اللون الداكن (الخلفية)', default:'#001442'},
                    {key:'neonColor',    label:'اللون النيون (التمييز)', default:'#55D7FF'},
                  ].map(c => (
                    <div key={c.key} className="field">
                      <label className="field-label">{c.label}</label>
                      <div className="color-row">
                        <div className="color-preview" style={{background:settings[c.key]||c.default}}
                          onClick={()=>document.getElementById('cp-'+c.key)?.click()} />
                        <input id={'cp-'+c.key} type="color" value={settings[c.key]||c.default}
                          onChange={e=>set(c.key,e.target.value)} style={{display:'none'}} />
                        <input className={`field-input color-input-text`} value={settings[c.key]||c.default}
                          onChange={e=>set(c.key,e.target.value)} style={{direction:'ltr'}} />
                      </div>
                    </div>
                  ))}

                  <div style={{marginTop:20,background:'#F8FAFC',borderRadius:12,padding:16,border:'1px solid #EEF2F7'}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#8898AA',marginBottom:10}}>معاينة الألوان</div>
                    <div style={{display:'flex',gap:10}}>
                      {['primaryColor','deepColor','neonColor'].map(k => (
                        <div key={k} style={{flex:1,height:48,borderRadius:10,background:settings[k]||'#ccc',boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}} />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SESSION */}
            {active === 'session' && (
              <>
                <div className="section-header">
                  <div className="section-title">⚙️ إعدادات الجلسة</div>
                  <div className="section-sub">الإعدادات التشغيلية للنظام</div>
                </div>
                <div className="fields-card">
                  <div className="fields-card-title">🕐 مدة الجلسة</div>
                  <div className="field">
                    <label className="field-label">مدة الجلسة الواحدة (بالدقائق)</label>
                    <input className="field-input" type="number" min="15" max="120" step="15"
                      value={settings.sessionDuration||'30'} onChange={e=>set('sessionDuration',e.target.value)}
                      style={{direction:'ltr',maxWidth:120}} />
                    <div className="field-hint">القيمة الافتراضية 30 دقيقة. تؤثر على كيفية توليد المواعيد</div>
                  </div>
                </div>
                <div className="fields-card">
                  <div className="fields-card-title">📝 نصوص الفوتر</div>
                  <div className="field">
                    <label className="field-label">نص الفوتر</label>
                    <input className="field-input" value={settings.footerText||''} onChange={e=>set('footerText',e.target.value)} placeholder="منصة الإشراف الأكاديمي" />
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

        {/* SAVE BAR */}
        <div className="save-bar">
          <div className={`save-msg${isError?' err':' ok'}`}>{msg}</div>
          <button className="save-btn" disabled={saving} onClick={save}>
            {saving ? '⏳ جارٍ الحفظ...' : '💾 حفظ التغييرات'}
          </button>
        </div>
      </div>
    </>
  );
}
