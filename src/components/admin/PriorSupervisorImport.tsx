"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function PriorSupervisorImport({ traineeId }: { traineeId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [preview, setPreview] = useState<any>(null), [selected, setSelected] = useState<string[]>([]), [supervisorName, setName] = useState("");
  async function run(commit: boolean) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file); form.set("action", commit ? "commit" : "preview");
      if (supervisorName) form.set("supervisorName", supervisorName);
      if (commit) { form.set("previewToken", preview.previewToken); form.set("traineeIds", JSON.stringify(selected)); }
      const response = await fetch("/api/admin/prior-supervision-import", { method: "POST", body: form }), result = await response.json();
      if (!response.ok) { setMessage(result.error === "PREVIEW_CHANGED" ? "تغيرت الساعات أو اسم المشرفة؛ أعيدي المعاينة قبل الاعتماد." : "تعذر قراءة أو حفظ الملف. لا تعتمدي أي رصيد يدويًا قبل التحقق؛ جربي المعاينة مجددًا."); return; }
      if (commit) { setMessage(result.results.map((r: any) => r.success ? `${r.name}: أُضيفت ${r.added} جلسة (${r.individual} فردي، ${r.group} جماعي)، واستُبعد ${r.duplicates} مكرر.` : `${r.name}: ${r.error}`).join("\n")); setPreview(null); router.refresh(); }
      else { setPreview(result); setName(result.supervisorName); setSelected(result.preview.filter((p: any) => p.traineeId === traineeId && !p.issues.length && p.newSessions > 0).map((p: any) => p.traineeId)); }
    } catch { setMessage("تعذر الاتصال. حدّثي الصفحة وأعيدي المعاينة للتحقق من النتائج قبل تكرار الاعتماد."); }
    finally { setBusy(false); }
  }
  return <div style={{ padding: 16, background: "#EFF6FF", borderRadius: 12, marginBottom: 18 }}>
    <h4>استيراد ساعات مشرف سابق من Excel</h4>
    <p>قراءة تبويبات المتدربات ومطابقة البريد بالحسابات الحالية. تُضاف جلسات إشراف فقط، دون إنشاء حساب للمشرفة أو تغيير المشرف الحالي أو ساعات العمل أو الأهداف. يُحفظ الملف الأصلي بشكل خاص للإدارة قبل إضافة الساعات.</p>
    <label>ملف المشرفة السابقة<input type="file" accept=".xlsx" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); setSelected([]); setName(""); setMessage(""); }} /></label>
    <label>اسم المشرفة السابقة<input value={supervisorName} disabled={busy} placeholder="يُقرأ من الملف إن وُجد" onChange={e => { setName(e.target.value); setPreview(null); }} /></label>
    <button disabled={busy || !file} onClick={() => void run(false)}>{busy ? "جاري المعالجة…" : "فحص ومعاينة"}</button>
    {preview && <>
      <p>راجعي النتائج. المحدد تلقائيًا هو صاحب الملف المفتوح فقط؛ اختاري حسابات أخرى إذا أردتِ استيرادها أيضًا.</p>
      {preview.preview.map((p: any) => <div key={p.sheet} style={{ borderBottom: "1px solid #CBD5E1", padding: 10 }}>
        <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" style={{width:"auto"}} checked={selected.includes(p.traineeId)} disabled={busy || !p.traineeId || p.issues.length > 0 || !p.newSessions} onChange={e => setSelected(e.target.checked ? [...selected, p.traineeId] : selected.filter(id => id !== p.traineeId))} /> {p.name} — {p.email}</label>
        <p>{p.newSessions} جلسة جديدة: {p.individual} فردي + {p.group} جماعي. المكرر: {p.duplicates}. {p.issues.join(" · ")}</p>
        <details><summary>تفاصيل الجلسات في الملف</summary>{p.details.map((h: any, i: number) => <div key={i}>{h.date} — {h.format === "individual" ? "فردي" : "جماعي"} — {h.duration} ساعة</div>)}</details>
      </div>)}
      <button disabled={busy || !selected.length} onClick={() => { if (confirm("اعتماد ساعات الإشراف السابقة للحسابات المحددة حسب المعاينة؟ لن تُضاف ساعات عمل أو تُغير الأهداف أو المشرف الحالي.")) void run(true); }}>اعتماد استيراد الحسابات المحددة</button>
    </>}
    {message && <p role="status" style={{ whiteSpace: "pre-line" }}>{message}</p>}
  </div>;
}
