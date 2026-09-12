"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TraineeLifecyclePanel from "./TraineeLifecyclePanel";
import LegacyImportClient from "./LegacyImportClient";

type View = "manage" | "add" | "import";

export default function TraineeManagementWorkspace({ locale, initialView, trainees, supervisors, transitions }: { locale: string; initialView: View; trainees: any[]; supervisors: any[]; transitions: any[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", license: "QASP-S" });

  function open(next: View) {
    setView(next);
    setMessage("");
    window.history.replaceState(null, "", `/${locale}/admin/trainees${next === "manage" ? "" : `?view=${next}`}`);
  }

  async function addTrainee(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    const response = await fetch("/api/admin/trainee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setMessage(result.error === "EMAIL_EXISTS" ? "هذا البريد مسجل مسبقًا." : "تعذر إضافة المتدرب. تحققي من البيانات."); return; }
    setMessage("تمت إضافة المتدرب إلى مرحلة المقابلة الأولية.");
    setForm({ name: "", email: "", phone: "", license: "QASP-S" });
    setTimeout(() => { open("manage"); router.refresh(); }, 900);
  }

  return <div dir="rtl">
    <style>{css}</style>
    <section className="tm-hero"><div><span>مركز عمليات المتدربين</span><h2>كل إجراءات المتدربين في صفحة واحدة</h2><p>تابعي المراحل، أضيفي الحسابات، واستوردي ملفات الساعات دون الانتقال بين صفحات متفرقة.</p></div><div className="tm-stats"><div><b>{trainees.length}</b><small>إجمالي المتدربين</small></div><div><b>{trainees.filter(t=>t.lifecycleStage==="active_service"||t.status==="active").length}</b><small>في الخدمة</small></div><div><b>{trainees.filter(t=>!t.currentSupervisorId).length}</b><small>دون مشرف</small></div></div></section>
    <nav className="tm-tabs" aria-label="إدارة المتدربين">
      <button className={view==="manage"?"active":""} onClick={()=>open("manage")}>إدارة المتدربين</button>
      <button className={view==="add"?"active":""} onClick={()=>open("add")}>＋ إضافة متدرب</button>
      <button className={view==="import"?"active":""} onClick={()=>open("import")}>⇧ استيراد ملف متدرب</button>
    </nav>
    {view === "manage" && <TraineeLifecyclePanel supervisors={supervisors} trainees={trainees} transitions={transitions} />}
    {view === "add" && <section className="tm-card"><div className="tm-card-head"><div><h3>إضافة متدرب جديد</h3><p>يُضاف في مرحلة المقابلة الأولية دون إسناد أو إتاحة خدمات المنصة.</p></div><span>01</span></div><form className="tm-form" onSubmit={addTrainee}><label>الاسم الكامل <b>*</b><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="اسم المتدرب" /></label><label>البريد الإلكتروني <b>*</b><input required type="email" dir="ltr" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com" /></label><label>رقم الجوال <b>*</b><input required dir="ltr" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="05XXXXXXXX" /></label><label>المسار <b>*</b><select value={form.license} onChange={e=>setForm({...form,license:e.target.value})}><option value="QASP-S">مساعد محلل سلوك — 1000 ساعة / 50 إشراف</option><option value="QBA">محلل سلوك — 2000 ساعة / 100 إشراف</option></select></label><div className="tm-note">لن تظهر للمتدرب خصائص الخدمة قبل نقله إلى مرحلة البدء والاستمرار وإسناده إلى مشرف.</div>{message&&<div className="tm-message">{message}</div>}<div className="tm-actions"><button type="button" onClick={()=>open("manage")}>إلغاء</button><button className="primary" disabled={loading}>{loading?"جارٍ الإضافة...":"إضافة المتدرب"}</button></div></form></section>}
    {view === "import" && <LegacyImportClient embedded onImported={()=>{open("manage");router.refresh();}} />}
  </div>;
}

const css = `.tm-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:22px 24px;border-radius:18px;background:linear-gradient(125deg,#001442,#0D40FC);color:#fff;margin-bottom:14px}.tm-hero span{font-size:10px;color:#70DFFF}.tm-hero h2{font-size:20px;margin:5px 0}.tm-hero p{font-size:12px;color:#C9D7FF;margin:0}.tm-stats{display:flex;gap:8px}.tm-stats div{min-width:95px;padding:10px 14px;border:1px solid #ffffff22;background:#ffffff12;border-radius:12px;text-align:center}.tm-stats b{display:block;font-size:21px}.tm-stats small{font-size:10px;color:#D6E1FF}.tm-tabs{display:flex;gap:4px;padding:6px;background:#fff;border:1px solid #E2E8F0;border-radius:13px;margin-bottom:14px;overflow:auto}.tm-tabs button{border:0;background:transparent;color:#64748B;font:inherit;font-size:12px;font-weight:800;padding:10px 16px;border-radius:9px;cursor:pointer;white-space:nowrap}.tm-tabs button.active{background:#0D40FC;color:#fff;box-shadow:0 5px 12px #0D40FC30}.tm-card{background:#fff;border:1px solid #E2E8F0;border-radius:18px;overflow:hidden;max-width:850px;margin:auto}.tm-card-head{display:flex;justify-content:space-between;padding:22px 24px;background:#F8FAFF;border-bottom:1px solid #E6ECF5}.tm-card-head h3{margin:0 0 5px;color:#001442}.tm-card-head p{margin:0;color:#64748B;font-size:12px}.tm-card-head span{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#E8EEFF;color:#0D40FC;font-weight:900}.tm-form{display:grid;grid-template-columns:1fr 1fr;gap:17px;padding:24px}.tm-form label{display:grid;gap:7px;font-size:12px;font-weight:800;color:#334155}.tm-form label b{color:#DC2626}.tm-form input,.tm-form select{width:100%;padding:11px 12px;border:1px solid #CBD5E1;border-radius:9px;background:#fff;font:inherit}.tm-form input:focus,.tm-form select:focus{outline:0;border-color:#0D40FC;box-shadow:0 0 0 3px #0D40FC12}.tm-note,.tm-message,.tm-actions{grid-column:1/-1}.tm-note{padding:11px 13px;background:#EFF6FF;color:#1D4ED8;border-radius:9px;font-size:11px}.tm-message{padding:11px 13px;background:#ECFDF5;color:#047857;border-radius:9px;font-size:12px;font-weight:800}.tm-actions{display:flex;justify-content:flex-end;gap:8px}.tm-actions button{padding:10px 18px;border:0;border-radius:9px;background:#F1F5F9;color:#475569;font:inherit;font-weight:800;cursor:pointer}.tm-actions .primary{background:#0D40FC;color:#fff}.tm-actions button:disabled{opacity:.55}@media(max-width:760px){.tm-hero{align-items:flex-start;flex-direction:column}.tm-stats{width:100%}.tm-stats div{min-width:0;flex:1}.tm-form{grid-template-columns:1fr}.tm-note,.tm-message,.tm-actions{grid-column:auto}}`;
