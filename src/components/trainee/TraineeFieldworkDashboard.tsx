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
    <div className="fw-wrap">
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
