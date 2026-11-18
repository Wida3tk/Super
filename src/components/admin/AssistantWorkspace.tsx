"use client";
import { useEffect, useRef, useState } from "react";
import { assistantFetch } from "@/lib/auth/assistantClient";
import SupervisorHoursUpdate from "./SupervisorHoursUpdate";
import LogoutButton from "@/components/LogoutButton";
const requestNames: Record<string, string> = { assign_supervisor: "تغيير أو إسناد المشرف", change_status: "تغيير حالة المتدرب", update_identity: "تعديل الاسم أو البريد", follow_up: "متابعة طلب أو مستند ناقص" };
export default function AssistantWorkspace({ name }: { name: string }) {
  const [trainees, setTrainees] = useState<any[]>([]), [supervisors, setSupervisors] = useState<any[]>([]), [detail, setDetail] = useState<any>(null);
  const [search, setSearch] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [preview, setPreview] = useState<any>(null);
  const [cursor, setCursor] = useState<any>(null), [selected, setSelected] = useState("");
  const selection = useRef(0);
  const [phone, setPhone] = useState(""), [requestType, setRequestType] = useState("follow_up"), [proposal, setProposal] = useState(""), [note, setNote] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", license: "QASP-S", supervisorId: "" });
  const [file, setFile] = useState<File | null>(null), [title, setTitle] = useState("");
  async function load(more = false) {
    const query = more && cursor ? `?after=${encodeURIComponent(cursor.after || "")}&createdAfter=${encodeURIComponent(cursor.createdAfter || "")}&assignedDone=${cursor.after ? "0" : "1"}&createdDone=${cursor.createdAfter ? "0" : "1"}` : "";
    const data = await assistantFetch(`/api/assistant${query}`);
    setTrainees(old => more ? [...new Map([...old, ...data.trainees].map(row => [row.id, row])).values()] : data.trainees);
    setSupervisors(data.supervisors); setCursor({ after: data.after, createdAfter: data.createdAfter });
  }
  useEffect(() => {
    let active = true;
    void assistantFetch("/api/assistant").then(data => {
      if (!active) return;
      setTrainees(data.trainees); setSupervisors(data.supervisors); setCursor({ after: data.after, createdAfter: data.createdAfter });
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function open(id: string) {
    const ticket = ++selection.current; setSelected(id); setDetail(null); setMessage(""); setProposal(""); setNote(""); setFile(null); setTitle("");
    try {
      const data = await assistantFetch(`/api/assistant?traineeId=${encodeURIComponent(id)}`);
      if (ticket === selection.current) { setDetail(data); setPhone(data.trainee.phone); }
    } catch (error) { if (ticket === selection.current) setMessage(error instanceof Error ? error.message : "تعذر تحميل الملف"); }
  }
  async function run(callback: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await callback(); } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال"); }
    finally { setBusy(false); }
  }
  return <main className="assistant-console">
    <header><h1>المتابعة الإدارية</h1><p>{name} — وصول محدود حسب النطاق المعتمد</p><LogoutButton /></header>
    <p className="assistant-note">يمكن متابعة الملفات والمواعيد، إضافة متدرب، تحديث الهاتف ورفع المستندات. لا يمكن اعتماد الساعات أو تعديلها أو حذفها، أو تغيير كلمات مرور المتدربين. تغييرات الهوية والإسناد والحالة تُرفع للإدارة.</p>
    {message && <p role="status" className="assistant-status">{message}</p>}
    <section><h2>المتدربون</h2><div className="assistant-row"><label>البحث في القائمة المحمّلة<input value={search} onChange={event => setSearch(event.target.value)} placeholder="الاسم أو البريد أو الهاتف" /></label><button disabled={busy} onClick={() => void run(() => load())}>تحديث القائمة</button></div>
      <div className="assistant-scroll"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الملف</th></tr></thead><tbody>{trainees.filter(t => `${t.name} ${t.email} ${t.phone}`.toLowerCase().includes(search.toLowerCase())).map(t => <tr key={t.id}><td>{t.name}</td><td>{t.email}</td><td dir="ltr">{t.phone}</td><td><button disabled={busy} onClick={() => void open(t.id)}>متابعة الملف</button></td></tr>)}</tbody></table></div>
      {(cursor?.after || cursor?.createdAfter) && <button disabled={busy} onClick={() => void run(() => load(true))}>تحميل المزيد</button>}
    </section>
    <details><summary>إضافة متدرب</summary><form onSubmit={event => { event.preventDefault(); void run(async () => {
      const response = await assistantFetch("/api/assistant", { action: "create", ...form });
      setForm({ name: "", email: "", phone: "", license: "QASP-S", supervisorId: "" }); await load(); await open(response.id);
      setMessage("أُضيف المتدرب، وأُرسل طلب الإسناد للإدارة. لم تُفعّل الخدمة أو تُسجّل ساعات.");
    }); }}>
      <div className="assistant-grid"><label>الاسم<input required maxLength={200} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>البريد<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>الهاتف<input required value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label><label>المسار<select value={form.license} onChange={event => setForm({ ...form, license: event.target.value })}><option>QASP-S</option><option>QBA</option></select></label>
      <label>المشرف المطلوب للإسناد<select required value={form.supervisorId} onChange={event => setForm({ ...form, supervisorId: event.target.value })}><option value="">اختيار المشرف</option>{supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><button disabled={busy}>إضافة وطلب الإسناد</button>
    </form></details>
    {selected && !detail && <section><p>افتح الملف مجددًا إذا لم يكتمل التحميل.</p><button disabled={busy} onClick={() => void open(selected)}>إعادة تحميل الملف</button></section>}
    {detail && <section><h2>{detail.trainee.name}</h2><p>{detail.trainee.email} — {detail.trainee.license}</p>
      <div className="assistant-grid"><section><h2>بيانات التواصل</h2><label>الهاتف<input value={phone} onChange={event => setPhone(event.target.value)} /></label><button disabled={busy} onClick={() => void run(async () => { await assistantFetch("/api/assistant", { action: "phone", traineeId: selected, phone }); await open(selected); await load(); setMessage("تم تحديث الهاتف وتوثيق التعديل."); })}>حفظ الهاتف</button></section>
      <section><h2>طلب للإدارة</h2><label>نوع الطلب<select value={requestType} onChange={event => setRequestType(event.target.value)}>{Object.entries(requestNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>التعديل المطلوب{requestType === "assign_supervisor" ? <select value={proposal} onChange={event => setProposal(event.target.value)}><option value="">اختيار المشرف</option>{supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select> : <input maxLength={500} value={proposal} onChange={event => setProposal(event.target.value)} />}</label>
      <label>سبب الطلب أو المتابعة<textarea maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label><button disabled={busy || !proposal.trim() || !note.trim()} onClick={() => void run(async () => { await assistantFetch("/api/assistant", { action: "request", traineeId: selected, requestType, proposal, note }); await open(selected); setMessage("حُفظ الطلب للإدارة؛ لم يتغير الملف أو الساعات."); })}>إرسال الطلب</button></section></div>
      <details><summary>المواعيد والطلبات</summary>{detail.bookings.map((b: any) => <p key={b.id}>{b.date} {b.time} — {b.status}</p>)}{detail.learnerRequests.map((r: any) => <p key={r.id}>{r.type} — {r.status}</p>)}<small>تُعرض حتى 30 نتيجة لكل نوع.</small></details>
      <details><summary>المستندات</summary><label>عنوان المستند<input maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label><label>الملف<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} /></label><button disabled={busy || !file || !title.trim()} onClick={() => void run(async () => { if (!file) return; const upload = new FormData(); upload.set("traineeId", selected); upload.set("title", title); upload.set("file", file); await assistantFetch("/api/assistant/files", upload); await open(selected); setMessage("رُفع المستند بانتظار المراجعة، دون اعتماده."); })}>رفع للمراجعة</button>
      {detail.documents.map((d: any) => <p key={d.id}>{d.title} — {d.status} {d.canDownload && <a href={`/api/assistant/files?traineeId=${encodeURIComponent(selected)}&documentId=${encodeURIComponent(d.id)}`} target="_blank" rel="noreferrer">تنزيل المرفق</a>}</p>)}<small>تُعرض حتى 50 مستندًا.</small></details>
      <details><summary>طلبات الإدارة السابقة</summary>{detail.requests.map((r: any) => <p key={r.id}>{requestNames[r.action] || r.action} — {r.proposal} — {r.status}{r.resolution ? ` — قرار الإدارة: ${r.resolution}` : ""}</p>)}</details>
    </section>}
    <details><summary>تجهيز معاينة ملف ساعات المشرف</summary><p>الفحص فقط؛ لا يملك المساعد اعتماد الاستيراد أو حفظ أي ساعات.</p>{supervisors.map(s => <button key={s.id} disabled={busy} onClick={() => setPreview(s)}>{s.name} — معاينة ملف</button>)}</details>
    {preview && <SupervisorHoursUpdate supervisor={preview} previewOnly onClose={() => setPreview(null)} />}
  </main>;
}
