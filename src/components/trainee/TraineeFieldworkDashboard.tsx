'use client';

import { useMemo, useState } from 'react';
import type { FieldworkActivity, FieldworkActivityType } from '@/types';

const labels: Record<FieldworkActivityType, string> = {
  direct: 'مباشرة مع العميل', indirect: 'غير مباشرة',
  supervision_direct: 'إشراف مباشر', supervision_indirect: 'إشراف غير مباشر',
};
const statusLabels: Record<string, string> = { draft: 'مسودة', submitted: 'بانتظار الاعتماد', approved: 'معتمد', revision_requested: 'يحتاج تعديل', rejected: 'مرفوض' };

export default function TraineeFieldworkDashboard({ trainee, supervisorName, initialActivities }: { trainee: any; supervisorName: string; initialActivities: FieldworkActivity[] }) {
  const [activities, setActivities] = useState(initialActivities);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), startTime: '', endTime: '', activityType: 'direct' as FieldworkActivityType, setting: 'video', format: 'individual', observedWithClient: false, description: '' });
  const isSupervision = form.activityType.startsWith('supervision_');
  const duration = useMemo(() => {
    if (!form.startTime || !form.endTime) return 0;
    const [sh, sm] = form.startTime.split(':').map(Number), [eh, em] = form.endTime.split(':').map(Number);
    return Math.max(0, Math.round((((eh * 60 + em) - (sh * 60 + sm)) / 60) * 100) / 100);
  }, [form.startTime, form.endTime]);
  const approved = activities.filter(a => a.status === 'approved');
  const sum = (types: FieldworkActivityType[]) => approved.filter(a => types.includes(a.activityType)).reduce((n, a) => n + a.duration, 0);
  const direct = sum(['direct']), indirect = sum(['indirect']);
  const supervision = sum(['supervision_direct', 'supervision_indirect']);
  const total = direct + indirect + supervision;
  const supervisionPct = total ? supervision / total * 100 : 0;
  const maxBar = Math.max(direct, indirect, supervision, 1);
  const requiredHours = Number(trainee.requiredHours || 100);
  const progress = Math.min(100, total / requiredHours * 100);
  const pendingCount = activities.filter(a => a.status === 'submitted').length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthHours = approved.filter(a => a.month === currentMonth).reduce((n, a) => n + a.duration, 0);
  const motivation = progress >= 100
    ? 'إنجاز رائع! وصلت إلى هدفك، وثمار التزامك أصبحت واضحة.'
    : progress >= 60
      ? 'أنت في المرحلة الأخيرة — استمر، فكل ساعة تقرّبك من هدفك.'
      : progress >= 25
        ? 'تقدّم جميل وثابت. الاستمرارية الصغيرة تصنع خبرة كبيرة.'
        : 'كل خبير كان يومًا متدربًا. ابدأ بخطوة، وسنحتفل بكل تقدم.';

  const submit = async (saveAsDraft: boolean) => {
    setSaving(true); setError('');
    const res = await fetch('/api/trainee/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, saveAsDraft }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'تعذر حفظ النشاط'); setSaving(false); return; }
    const refreshed = await fetch('/api/trainee/activities').then(r => r.json());
    setActivities(refreshed.activities || []); setOpen(false); setSaving(false);
    setForm({ ...form, startTime: '', endTime: '', description: '' });
  };

  return <main className="fw-page" dir="rtl">
    <style>{`
      *{box-sizing:border-box}.fw-page{min-height:100vh;background:#f5f7fb;color:#001442;padding:28px;font-family:'IBM Plex Sans Arabic',Arial,sans-serif}.fw-wrap{max-width:1180px;margin:auto}.fw-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}.fw-head h1{font-size:28px;margin:0}.muted{color:#718096;font-size:13px}.primary{border:0;background:#0d40fc;color:#fff;padding:11px 18px;border-radius:11px;font-weight:700;cursor:pointer}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.card,.panel{background:#fff;border:1px solid #e4e9f1;border-radius:15px;box-shadow:0 2px 8px #0014420a}.card{padding:17px}.card b{display:block;font-size:23px;margin-top:6px}.grid{display:grid;grid-template-columns:1.05fr 1.95fr;gap:16px}.panel{padding:20px}.bars{display:flex;align-items:flex-end;gap:18px;height:210px;padding:18px 12px 0}.bar-col{flex:1;text-align:center;font-size:12px;color:#718096}.bar{width:100%;min-height:5px;border-radius:8px 8px 3px 3px;margin-bottom:8px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:11px 9px;text-align:right;border-bottom:1px solid #edf0f5;font-size:12px}th{color:#718096;background:#fafbfc}.status{padding:4px 8px;border-radius:20px;background:#eef2ff;color:#2947a9;white-space:nowrap}.modal-bg{position:fixed;inset:0;background:#00144299;display:grid;place-items:center;padding:16px;z-index:50}.modal{background:#fff;border-radius:18px;padding:22px;width:min(650px,100%);max-height:92vh;overflow:auto}.fields{display:grid;grid-template-columns:1fr 1fr;gap:13px}.field label{display:block;font-size:12px;color:#64748b;margin-bottom:6px}.field input,.field select,.field textarea{width:100%;padding:10px;border:1px solid #d8dfeb;border-radius:9px;font:inherit}.field textarea{min-height:90px}.full{grid-column:1/-1}.duration{background:#eef4ff;padding:12px;border-radius:10px;color:#0d40fc;font-weight:700}.actions{display:flex;gap:8px;margin-top:18px}.secondary{background:#fff;border:1px solid #cfd8e6;padding:10px 15px;border-radius:9px;cursor:pointer}@media(max-width:850px){.cards{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.fw-page{padding:16px}.fw-head{align-items:flex-start;flex-direction:column}}
    `}</style>
    <style>{`
      .fw-page{background:radial-gradient(circle at 8% 4%,#dff7ff 0,transparent 27%),radial-gradient(circle at 95% 8%,#eae7ff 0,transparent 25%),#f5f7fb;padding-top:0!important}
      .top-nav{height:68px;display:flex;align-items:center;justify-content:space-between}.brand{font-size:22px;font-weight:900;color:#0d40fc}.role-pill{font-size:11px;color:#53657d;background:#fff;border:1px solid #dfe6f0;padding:6px 11px;border-radius:99px}
      .welcome-hero{position:relative;overflow:hidden;background:linear-gradient(125deg,#001442 0%,#0935ce 62%,#0d70fc 100%);border-radius:24px;padding:32px 34px;color:#fff;display:grid;grid-template-columns:1.5fr .8fr;gap:24px;align-items:center;box-shadow:0 20px 50px #0d40fc25;margin-bottom:18px}.welcome-hero:after{content:'';position:absolute;width:310px;height:310px;border-radius:50%;background:#55d7ff18;left:-80px;top:-155px}.hero-main{position:relative;z-index:1}.eyebrow{font-size:12px;color:#73e3ff;font-weight:700;margin-bottom:7px}.welcome-hero h1{font-size:30px;margin:0 0 8px}.hero-sub{font-size:14px;color:#d5e1ff;line-height:1.8;max-width:620px}.welcome-hero .primary{background:#fff;color:#0d40fc;box-shadow:none;margin-top:18px}.welcome-hero .primary:hover{transform:translateY(-2px)}
      .quote-card{position:relative;z-index:1;background:#ffffff13;border:1px solid #ffffff24;border-radius:18px;padding:20px;backdrop-filter:blur(8px)}.quote-icon{font-size:27px;margin-bottom:8px}.quote{font-size:14px;line-height:1.8;font-weight:600}.supervisor-line{font-size:11px;color:#a9c4ff;margin-top:12px}.progress-wrap{margin-top:18px}.progress-label{display:flex;justify-content:space-between;font-size:11px;color:#c9d8ff;margin-bottom:7px}.progress-track{height:8px;background:#ffffff20;border-radius:99px;overflow:hidden}.progress-fill{height:100%;background:linear-gradient(90deg,#55d7ff,#6fffc2);border-radius:99px}
      .fw-head{display:none!important}.cards{gap:14px!important}.card,.panel{border-radius:18px!important;box-shadow:0 9px 28px #0014420b!important;background:#ffffffeb!important}.card{border-top:3px solid #dce6ff!important;transition:.2s}.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px #0d40fc14!important}.card:nth-child(2){border-top-color:#7668ff!important}.card:nth-child(3){border-top-color:#43bedb!important}.card:nth-child(4){border-top-color:#10b981!important}.card:nth-child(5){border-top-color:#f59e0b!important}.panel h3{font-size:16px;margin-bottom:4px}.bar{border-radius:10px 10px 4px 4px!important}.status{font-weight:600}.motivation-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(90deg,#ecfdf5,#effaff);border:1px solid #c8f2e2;border-radius:14px;padding:13px 17px;margin-bottom:16px}.motivation-strip b{color:#047857;font-size:13px}.motivation-strip span{font-size:12px;color:#4b6472}
      @media(max-width:850px){.welcome-hero{grid-template-columns:1fr;padding:25px}.welcome-hero h1{font-size:25px}.quote-card{display:none}.top-nav{height:58px}.fw-page{padding-top:0!important}}
    `}</style>
    <div className="fw-wrap">
      <nav className="top-nav"><div className="brand">سلوكيرا</div><div className="role-pill">بوابة المتدرب · {trainee.license}</div></nav>
      <section className="welcome-hero"><div className="hero-main"><div className="eyebrow">رحلتك المهنية تبدأ من هنا ✦</div><h1>أهلًا {trainee.name} 👋</h1><div className="hero-sub">سجّل خبراتك، تابع تقدمك، واصنع سجلًا يعكس التزامك ونموّك كل يوم.</div><button className="primary" onClick={() => setOpen(true)}>＋ إضافة ساعات جديدة</button><div className="progress-wrap"><div className="progress-label"><span>التقدم نحو {requiredHours} ساعة</span><b>{progress.toFixed(0)}%</b></div><div className="progress-track"><div className="progress-fill" style={{width:`${progress}%`}}/></div></div></div><aside className="quote-card"><div className="quote-icon">🌱</div><div className="quote">{motivation}</div><div className="supervisor-line">معك في الرحلة: {supervisorName || 'فريق الإشراف'}</div></aside></section>
      <div className="motivation-strip"><b>✨ {motivation}</b><span>{monthHours.toFixed(1)} ساعة هذا الشهر · {pendingCount} بانتظار الاعتماد</span></div>
      <div className="fw-head"><div><h1>مرحبًا، {trainee.name}</h1><div className="muted">المشرف: {supervisorName || '—'} · {trainee.license}</div></div><button className="primary" onClick={() => setOpen(true)}>+ إضافة ساعات</button></div>
      <section className="cards">
        <div className="card"><span className="muted">إجمالي المعتمد</span><b>{total.toFixed(2)}</b></div>
        <div className="card"><span className="muted">مباشرة</span><b>{direct.toFixed(2)}</b></div>
        <div className="card"><span className="muted">غير مباشرة</span><b>{indirect.toFixed(2)}</b></div>
        <div className="card"><span className="muted">إشراف</span><b>{supervision.toFixed(2)}</b></div>
        <div className="card"><span className="muted">نسبة الإشراف</span><b style={{color:supervisionPct>=5?'#059669':'#dc2626'}}>{supervisionPct.toFixed(1)}%</b></div>
      </section>
      <div className="grid">
        <section className="panel"><h3>توزيع الساعات</h3><div className="bars">{[[direct,'#0d40fc','مباشرة'],[indirect,'#55b7d7','غير مباشرة'],[supervision,'#10b981','إشراف']].map(([v,c,l])=><div className="bar-col" key={String(l)}><div className="bar" style={{height:`${Number(v)/maxBar*150}px`,background:String(c)}}/><b>{Number(v).toFixed(1)}</b><div>{l}</div></div>)}</div></section>
        <section className="panel"><h3>سجل الأنشطة</h3><div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الوقت</th><th>المدة</th><th>الوصف</th><th>الحالة</th></tr></thead><tbody>{activities.map(a=><tr key={a.id}><td>{a.date}</td><td>{labels[a.activityType]}</td><td dir="ltr">{a.startTime}–{a.endTime}</td><td>{a.duration}</td><td>{a.description || '—'}</td><td><span className="status">{statusLabels[a.status]}</span>{a.reviewerNote&&<div className="muted">{a.reviewerNote}</div>}</td></tr>)}{!activities.length&&<tr><td colSpan={6} style={{textAlign:'center',padding:30}}>لم تُضف ساعات بعد</td></tr>}</tbody></table></div></section>
      </div>
    </div>
    {open&&<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setOpen(false)}><div className="modal"><h2>إضافة نشاط ميداني</h2><div className="fields">
      <div className="field"><label>التاريخ</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
      <div className="field"><label>نوع النشاط</label><select value={form.activityType} onChange={e=>setForm({...form,activityType:e.target.value as FieldworkActivityType})}>{Object.entries(labels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></div>
      <div className="field"><label>وقت البداية</label><input type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></div>
      <div className="field"><label>وقت النهاية</label><input type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></div>
      {isSupervision&&<><div className="field"><label>طريقة الإشراف</label><select value={form.setting} onChange={e=>setForm({...form,setting:e.target.value})}><option value="video">اتصال مرئي</option><option value="in_person">حضوري</option></select></div><div className="field"><label>الصيغة</label><select value={form.format} onChange={e=>setForm({...form,format:e.target.value})}><option value="individual">فردي</option><option value="group">جماعي</option></select></div><label className="full"><input type="checkbox" checked={form.observedWithClient} onChange={e=>setForm({...form,observedWithClient:e.target.checked})}/> تمت ملاحظتي مع العميل</label></>}
      <div className="field full"><label>وصف النشاط</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="اكتب وصفًا مختصرًا لما تم إنجازه"/></div><div className="duration full">المدة المحسوبة: {duration.toFixed(2)} ساعة</div>
    </div>{error&&<p style={{color:'#dc2626'}}>{error}</p>}<div className="actions"><button className="primary" disabled={saving} onClick={()=>submit(false)}>إرسال للمشرف</button><button className="secondary" disabled={saving} onClick={()=>submit(true)}>حفظ كمسودة</button><button className="secondary" onClick={()=>setOpen(false)}>إلغاء</button></div></div></div>}
  </main>;
}
