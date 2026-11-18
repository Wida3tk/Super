"use client";
import { useEffect, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { assistantFetch } from "@/lib/auth/assistantClient";
export default function AssistantManagement({ supervisors, locale }: { supervisors: { id: string; name: string }[]; locale: string }) {
  const [records, setRecords] = useState<any[]>([]), [requests, setRequests] = useState<any[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", scope: "supervisors", supervisorIds: [] as string[] });
  const [editor, setEditor] = useState<any>(null);
  async function load() {
    const [accounts, queue] = await Promise.all([assistantFetch("/api/admin/assistants"), assistantFetch("/api/admin/assistant-requests")]);
    setRecords(accounts.assistants); setRequests(queue.requests);
  }
  useEffect(() => { void load().catch(error => setMessage(error.message)); }, []);
  async function run(callback: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await callback(); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال"); }
    finally { setBusy(false); }
  }
  const scopeForm = editor || form;
  const updateScope = (patch: any) => editor ? setEditor({ ...editor, ...patch }) : setForm({ ...form, ...patch });
  return <div className="assistant-console">
    <header><h1>المساعدون الإداريون</h1><p>حسابات مستقلة، نطاق محدد، وسجل تدقيق لكل تعديل.</p><a href={`/${locale}/login?portal=assistant`}>رابط دخول المساعد</a></header>
    {message && <p role="status" className="assistant-status">{message}</p>}
    <section><h2>{editor ? `تعديل نطاق ${editor.name}` : "إضافة مساعد إداري"}</h2>
      <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (editor) { await assistantFetch("/api/admin/assistants", { id: editor.id, active: editor.active, scope: editor.scope, supervisorIds: editor.supervisorIds }, "PATCH"); setEditor(null); setMessage("تم تعديل النطاق؛ يلزم تسجيل الدخول مجددًا."); }
        else {
          await assistantFetch("/api/admin/assistants", form);
          try { await sendPasswordResetEmail(auth, form.email.trim()); setMessage("أُنشئ الحساب وأُرسل رابط تعيين كلمة المرور إلى بريد المساعد."); }
          catch { setMessage("أُنشئ الحساب، لكن تعذر إرسال البريد. استخدم زر إعادة إرسال رابط التعيين."); }
          setForm({ name: "", email: "", scope: "supervisors", supervisorIds: [] });
        }
      }); }}>
        {!editor && <div className="assistant-grid"><label>الاسم<input required maxLength={150} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>البريد الوظيفي<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label></div>}
        <label>نطاق الوصول<select value={scopeForm.scope} onChange={event => updateScope({ scope: event.target.value, supervisorIds: [] })}><option value="supervisors">مشرفون محددون</option><option value="all">جميع المتدربين والمشرفين</option></select></label>
        {scopeForm.scope === "supervisors" && <div className="assistant-grid">{supervisors.map(supervisor => <label className="assistant-choice" key={supervisor.id}><input type="checkbox" checked={scopeForm.supervisorIds.includes(supervisor.id)} onChange={event => updateScope({ supervisorIds: event.target.checked ? [...scopeForm.supervisorIds, supervisor.id] : scopeForm.supervisorIds.filter((id: string) => id !== supervisor.id) })} />{supervisor.name}</label>)}</div>}
        <p className="assistant-note">لا يتضمن الحساب اعتماد الساعات أو تعديلها أو حذفها، ولا كلمات مرور المتدربين أو البيانات المالية أو التصدير الشامل. المساعد يعيّن كلمة مروره عبر بريده، ولا تُعرض للإدارة.</p>
        <button disabled={busy || (scopeForm.scope === "supervisors" && !scopeForm.supervisorIds.length)}>{editor ? "حفظ النطاق" : "إنشاء الحساب وإرسال رابط التعيين"}</button>
        {editor && <button type="button" disabled={busy} onClick={() => setEditor(null)}>إلغاء</button>}
      </form>
    </section>
    <section><h2>الحسابات</h2><div className="assistant-scroll"><table><thead><tr><th>المساعد</th><th>النطاق</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td>{record.name}<br /><small>{record.email}</small></td><td>{record.scope === "all" ? "جميع الملفات" : record.supervisorIds.map((id: string) => supervisors.find(s => s.id === id)?.name || id).join("، ")}</td><td>{record.active ? "نشط" : "معطّل"}</td><td>
      <button disabled={busy} onClick={() => setEditor(record)}>تعديل النطاق</button>
      <button disabled={busy} onClick={() => { if (confirm(record.active ? "تعطيل وصول هذا المساعد فورًا؟" : "إعادة تفعيل الحساب بالنطاق الحالي؟")) void run(async () => { await assistantFetch("/api/admin/assistants", { id: record.id, active: !record.active, scope: record.scope, supervisorIds: record.supervisorIds }, "PATCH"); setMessage("تم تحديث الوصول."); }); }}>{record.active ? "تعطيل" : "تفعيل"}</button>
      <button disabled={busy || !record.active} onClick={() => void run(async () => { await sendPasswordResetEmail(auth, record.email); setMessage("أُرسل رابط تعيين كلمة المرور إلى صاحب الحساب."); })}>إعادة إرسال رابط التعيين</button>
    </td></tr>)}</tbody></table></div><small>تُعرض حتى 100 حساب.</small></section>
    <section><h2>طلبات المساعدين</h2><p>تنفّذ الإدارة التغييرات الحساسة من ملف المتدرب، ثم توثّق معالجة الطلب هنا. إغلاق الطلب لا يغيّر الساعات أو ينفّذ الإسناد تلقائيًا.</p><button disabled={busy} onClick={() => void run(async () => {})}>تحديث الطلبات</button>
      {requests.map(request => <article key={request.id}><hr /><b>{request.createdByName} — {request.action}</b><p>{request.proposal}</p><p>{request.note}</p><a href={`/${locale}/admin/trainees/${encodeURIComponent(request.traineeId)}`}>فتح ملف المتدرب للمعالجة</a>
        {(["processed", "rejected"] as const).map(decision => <button key={decision} disabled={busy} onClick={() => { const note = prompt("اكتب قرار الإدارة وما تم تنفيذه"); if (note?.trim()) void run(async () => { await assistantFetch("/api/admin/assistant-requests", { id: request.id, decision, note }, "PATCH"); setMessage("تم توثيق القرار."); }); }}>{decision === "processed" ? "توثيق المعالجة" : "رفض الطلب"}</button>)}
      </article>)}<small>تُعرض حتى 100 طلب معلّق.</small>
    </section>
  </div>;
}
