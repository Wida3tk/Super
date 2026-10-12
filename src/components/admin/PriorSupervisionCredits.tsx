"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadTraineeFile } from "@/lib/drive/uploadClient";
import PriorSupervisorImport from "./PriorSupervisorImport";

export default function PriorSupervisionCredits({ traineeId, records, documents }: { traineeId: string; records: any[]; documents: any[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ supervisorName: "", startDate: "", endDate: "", individualHours: "", groupHours: "0", evidenceId: "", mode: "new" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const errors: Record<string, string> = { INVALID_DATA: "تحققي من البيانات: الفترة في شهر سابق واحد، والساعات موجبة وبدقة منزلتين كحد أقصى.", INVALID_EVIDENCE: "أرفقي إثباتًا صالحًا تابعًا لملف المتدرب.", MONTH_LOCKED: "الشهر مقفل؛ لا يمكن إضافة أو توثيق رصيد دون مراجعة اعتماده.", EXISTING_HOURS: "توجد ساعات أو جلسات لهذا الشهر. طابقيها أولًا؛ لا يُضاف رصيد فوق ساعات موجودة. وضع توثيق المستورد يقبل السجلات المستوردة فقط وغير الموثقة سابقًا.", TOTAL_MISMATCH: "الأرقام لا تطابق الساعات المستوردة في الفترة. راجعي السجل الشهري.", FAILED: "تعذر التنفيذ. حدّثي الصفحة للتحقق قبل المحاولة مجددًا." };
  async function submit(action: "draft" | "approve", creditId?: string) {
    setBusy(true); setMessage("");
    try {
      let evidenceId = form.evidenceId;
      if (action === "draft" && file) {
        const uploaded = await uploadTraineeFile({ traineeId, file, category: "approvals", type: "other", title: `إثبات ساعات المشرف السابق — ${form.supervisorName}` });
        evidenceId = uploaded.id;
        setForm(f => ({ ...f, evidenceId })); setFile(null);
      }
      const response = await fetch("/api/admin/prior-supervision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, traineeId, action, creditId, evidenceId, individualHours: Number(form.individualHours), groupHours: Number(form.groupHours) }) });
      const result = await response.json();
      if (!response.ok) { setMessage(errors[result.error] || "تعذر تنفيذ الطلب."); return; }
      setMessage(action === "draft" ? "تم حفظ المسودة دون احتساب ساعات. راجعيها ثم اعتمديها." : "تم اعتماد الرصيد السابق دون تكرار الساعات.");
      if (action === "draft") setForm({ supervisorName: "", startDate: "", endDate: "", individualHours: "", groupHours: "0", evidenceId: "", mode: "new" });
      router.refresh();
    } catch { setMessage("تعذر الاتصال أو رفع الإثبات. حدّثي الصفحة للتحقق قبل المحاولة مجددًا."); }
    finally { setBusy(false); }
  }
  const approved = records.filter(r => r.status === "approved");
  return <section dir="rtl" className="prior-credit-panel">
    <style>{`.prior-credit-panel label{display:grid;gap:6px;font-size:13px}.prior-credit-panel input,.prior-credit-panel select{width:100%;padding:10px;border:1px solid #CBD5E1;border-radius:8px;font:inherit;background:white}.prior-credit-panel button{padding:10px 14px;border:0;border-radius:9px;background:#0D40FC;color:white;font:inherit;cursor:pointer}.prior-credit-panel button:disabled{opacity:.5;cursor:wait}.prior-credit-panel p{font-size:13px;line-height:1.8;color:#475569}`}</style>
    <h3>ساعات الإشراف السابقة</h3>
    <PriorSupervisorImport traineeId={traineeId} />
    <p>رصيد مستقل موثق من مشرف خارج المنصة. لا يتطلب حسابًا له، ولا يغير المشرف الحالي أو مراحل المتدرب. إجمالي المعتمد هنا: {approved.reduce((n, r) => n + r.individualHours + r.groupHours, 0)} ساعة.</p>
    <p>أضيفي سجلًا لكل شهر سابق بحسب الإثبات. إذا كانت الساعات مستوردة بالفعل، اختاري «توثيق ساعات مستوردة» لتجنب احتسابها مرتين.</p>
    <form onSubmit={e => { e.preventDefault(); void submit("draft"); }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
      <label>اسم المشرف السابق<input required maxLength={200} value={form.supervisorName} onChange={e => setForm({ ...form, supervisorName: e.target.value })} /></label>
      <label>طريقة التسجيل<select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}><option value="new">رصيد غير مسجل في النظام</option><option value="existing">توثيق ساعات مستوردة — دون إضافة رصيد</option></select></label>
      <label>بداية الفترة<input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
      <label>نهاية الفترة (نفس الشهر)<input required type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>
      <label>ساعات فردية<input required type="number" min="0" max="744" step="0.01" value={form.individualHours} onChange={e => setForm({ ...form, individualHours: e.target.value })} /></label>
      <label>ساعات جماعية<input required type="number" min="0" max="744" step="0.01" value={form.groupHours} onChange={e => setForm({ ...form, groupHours: e.target.value })} /></label>
      <label>إثبات من ملف المتدرب<select value={form.evidenceId} onChange={e => { setFile(null); setForm({ ...form, evidenceId: e.target.value }); }}><option value="">اختاري إثباتًا أو ارفعي ملفًا</option>{documents.filter(d => d.driveFileId && d.status !== "revoked").map(d => <option key={d.id} value={d.id}>{d.title || d.fileName}</option>)}</select></label>
      <label>رفع إثبات<input type="file" accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <button type="submit" disabled={busy || (!file && !form.evidenceId)}>حفظ مسودة للمراجعة</button>
    </form>
    {message && <p role="status">{message}</p>}
    {records.map(r => <div key={r.id} style={{ padding: 12, marginTop: 12, background: "#F8FAFC", borderRadius: 10 }}>
      <b>{r.supervisorName}</b> — {r.startDate} إلى {r.endDate} — فردي: {r.individualHours} / جماعي: {r.groupHours} — {r.mode === "existing" ? "توثيق المستورد دون إضافة" : "رصيد سابق"} — {r.status === "approved" ? "معتمد" : "مسودة غير محتسبة"}
      {r.status === "draft" && <button disabled={busy} onClick={() => { if (confirm("هل راجعتِ الإثبات والساعات؟ الاعتماد يثبت الرصيد السابق، ولن ينشئ جلسات للمشرف الحالي.")) void submit("approve", r.id); }}>اعتماد الإدارة</button>}
      <a href={r.sourceFileHash ? `/api/admin/prior-supervision-import?source=${encodeURIComponent(r.sourceFileHash)}` : `/api/files?documentId=${encodeURIComponent(r.evidenceId)}`} target="_blank" rel="noopener noreferrer"> عرض الإثبات</a>
    </div>)}
  </section>;
}
