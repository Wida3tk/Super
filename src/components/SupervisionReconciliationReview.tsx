"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const errors: Record<string, string> = { EVIDENCE_CHANGED: "تغيرت السجلات منذ عرضها؛ حدّث الطلبات وأعد المطابقة قبل الاعتماد.", MONTH_LOCKED: "الشهر مقفل؛ لا يمكن إضافة ساعات إليه.", SUPERVISOR_REQUIRED: "يجب ربط المتدرب بمشرف حالي قبل الاعتماد.", FORBIDDEN: "لا تملك صلاحية مراجعة هذا الملف.", REVIEW_FAILED: "تعذر حفظ الاعتماد؛ أعد تحميل الطلبات قبل المحاولة مجددًا." };
export default function SupervisionReconciliationReview({ role, traineeId }: { role: "admin" | "supervisor"; traineeId?: string }) {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [forms, setForms] = useState<Record<string, { decision: string; note: string }>>({});
  async function request(body?: any) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api/supervision-reconciliation${!body && traineeId ? `?traineeId=${encodeURIComponent(traineeId)}` : ""}`, {
        method: body ? "PATCH" : "GET", signal: controller.signal, cache: "no-store",
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(errors[data.error] || "تعذر تحميل أو حفظ طلبات المطابقة.");
      return data;
    } finally { clearTimeout(timer); }
  }
  async function load() {
    setBusy("load"); setMessage("");
    try { const data = await request(); setRecords(data.records); setLoaded(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال."); }
    finally { setBusy(""); }
  }
  async function approve(id: string) {
    const form = forms[id];
    if (!form?.decision || !form.note.trim()) return;
    if (!confirm("تأكيد قرارك؟ لا تُضاف ساعات إلا بعد اتفاق المشرف والإدارة. اعتمادها كجلسة إضافية يعني أنها ليست تكرارًا للسجل الموجود.")) return;
    setBusy(id); setMessage("");
    try {
      const result = await request({ id, ...form, reviewKey: records.find(record => record.id === id)?.reviewKey });
      setMessage(result.status === "resolved" ? "اكتمل الاعتماد المزدوج ونُفّذ القرار مرة واحدة." : result.outcome === "disagreement" ? "اختلف القراران؛ الساعات ما زالت معلّقة دون احتساب." : "حُفظ اعتمادك؛ الساعات معلّقة حتى اعتماد الطرف الآخر على القرار نفسه.");
      const data = await request(); setRecords(data.records); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر الاتصال؛ أعد تحميل الطلبات للتحقق."); }
    finally { setBusy(""); }
  }
  return <details dir="rtl" style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: 16, marginBottom: 18 }} onToggle={event => { if (event.currentTarget.open && !loaded && !busy) void load(); }}>
    <summary style={{ cursor: "pointer", fontWeight: 700 }}>مطابقة ساعات الإشراف — اعتماد الإدارة والمشرف</summary>
    <p>السجلات المحتمل تعارضها لا تُحتسب حتى يتفق الطرفان. الساعات القديمة تبقى كما هي. المشرف المطلوب هو المشرف الحالي للمتدرب.</p>
    <button type="button" disabled={!!busy} onClick={() => void load()}>تحديث الطلبات</button>
    {message && <p role="status">{message}</p>}
    {loaded && !records.length && <p>لا توجد طلبات معلّقة.</p>}
    {records.map(record => {
      const form = forms[record.id] || { decision: "", note: "" };
      const change = (patch: Partial<typeof form>) => setForms(current => ({ ...current, [record.id]: { ...form, ...patch } }));
      const label = (decision: string) => decision === "add_separate" ? "جلسة إضافية" : "إبقاء الموجود";
      return <section key={record.id} style={{ background: "white", padding: 14, borderRadius: 10, marginTop: 12 }}>
        <h4>{record.traineeName} — {record.candidate.date}</h4>
        <p>المستورد: {record.candidate.duration} ساعة · {record.candidate.format === "group" ? "جماعي" : "فردي"} · المشرف السابق: {record.supervisorName}</p>
        <small>المصدر: {record.sourceSheet}، الصف {record.candidate.sourceRow}. وقت البداية غير متوفر في هذا النموذج.</small>
        <p>السجلات الحالية:</p>
        {(record.currentMatches || record.matches).map((match: any, i: number) => <div key={i}>{match.date} — {match.duration} ساعة — {match.format === "group" ? "جماعي" : "فردي"} {match.startTime ? `(${match.startTime}–${match.endTime})` : "(وقت البداية غير متوفر)"}</div>)}
        {!(record.currentMatches || record.matches).length && <p>يوجد رصيد سابق معتمد لهذا الشهر أو سجل آخر في الملف؛ يلزم التحقق من الإثبات.</p>}
        <p>الإدارة: {record.adminApproval ? `اعتمدت ${label(record.adminApproval.decision)}` : "بانتظار الاعتماد"} · المشرف: {record.supervisorApproval ? `اعتمد ${label(record.supervisorApproval.decision)}` : "بانتظار الاعتماد"}</p>
        <label style={{ display: "block" }}>قرار {role === "admin" ? "الإدارة" : "المشرف"}<select value={form.decision} disabled={!!busy} onChange={event => change({ decision: event.target.value })} style={{ display: "block", padding: 8, width: "100%" }}>
          <option value="">اختر القرار بعد المطابقة</option><option value="keep_existing">إبقاء السجل الموجود وعدم إضافة المستورد</option><option value="add_separate">جلسة إضافية مستقلة وليست تكرارًا</option>
        </select></label>
        <label style={{ display: "block", marginTop: 10 }}>ملاحظة المطابقة والإثبات<textarea value={form.note} maxLength={1000} disabled={!!busy} onChange={event => change({ note: event.target.value })} style={{ display: "block", width: "100%", minHeight: 70, padding: 8 }} /></label>
        <button type="button" disabled={!!busy || !form.decision || !form.note.trim()} onClick={() => void approve(record.id)} style={{ marginTop: 10 }}>حفظ اعتماد {role === "admin" ? "الإدارة" : "المشرف"}</button>
      </section>;
    })}
  </details>;
}
