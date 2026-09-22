"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Supervisor = { id: string; name: string; email: string; publicProfileId?: string };

export default function SupervisorHoursUpdate({ supervisor, onClose }: { supervisor: Supervisor; onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run(commit: boolean) {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("supervisorId", supervisor.id);
    form.append("commit", String(commit));
    const response = await fetch("/api/admin/supervisor-hours-import", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setResult({ status: response.status, ...data });
    setLoading(false);
    if (commit && response.ok) router.refresh();
  }

  const errors: Record<string, string> = {
    INVALID_REQUEST: "اختاري ملف Excel الصحيح.",
    FILE_TOO_LARGE: "حجم الملف يتجاوز 15MB.",
    UNSUPPORTED_SUPERVISOR_FILE: "هذا ليس ملف المشرف المعتمد.",
    SUPERVISOR_FILE_MISMATCH: "بريد المشرف داخل الملف لا يطابق الحساب المحدد. لم يتم تغيير أي بيانات.",
    TRAINEE_IDENTITY_CONFLICTS: "يوجد بريد مكرر أو تعارض في بيانات أحد المتدربين. عالجي التعارضات الظاهرة قبل الاعتماد.",
    AUTH_EMAIL_ALREADY_USED: "أحد عناوين البريد مستخدم في حساب دخول آخر وغير مرتبط بمتدرب.",
    NO_TRAINEES_FOUND: "لم يعثر النظام على متدربين صالحين داخل الملف.",
    SUPERVISOR_HOURS_IMPORT_FAILED: "تعذر قراءة الملف أو تحديث الساعات.",
  };

  return <div className="hours-overlay" dir="rtl" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <style>{css}</style>
    <section className="hours-dialog">
      <button className="hours-close" onClick={onClose} aria-label="إغلاق">×</button>
      <small className="hours-kicker">إنشاء الحسابات وتحديث الساعات</small>
      <h2>تحديث ساعات {supervisor.name}</h2>
      <p className="hours-email">{supervisor.email}</p>
      <div className="hours-safety"><b>المتدرب الجديد سيُنشأ ويُربط تلقائيًا.</b><span>يعتمد هذا الملف على البريد الفريد. يُستكمل رقم الجوال لاحقًا من ملف المتدرب، والحسابات الموجودة ستُحدّث دون تكرار.</span></div>
      <label className="hours-drop">
        <b>{file ? file.name : "اختيار ملف المشرف المحدّث (.xlsx)"}</b>
        <span>سيظهر تقرير المطابقة قبل الاعتماد</span>
        <input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); }} />
      </label>
      <div className="hours-actions">
        <button className="preview" disabled={!file || loading} onClick={() => void run(false)}>{loading ? "جارٍ الفحص..." : "فحص ومعاينة"}</button>
        <button className="commit" disabled={!file || loading || !result?.preview || result?.committed || Boolean(result?.preview?.conflicts?.length)} onClick={() => void run(true)}>إنشاء الحسابات واعتماد الساعات</button>
      </div>
      {result?.preview && <div className="hours-report">
        <div className="report-head"><b>{result.committed ? "تم تحديث الساعات بنجاح" : "نتيجة المطابقة"}</b><span>{result.preview.sourceFile}</span></div>
        <div className="report-stats"><div><b>{result.preview.matched.length}</b><span>حساب موجود</span></div><div><b>{result.preview.pendingCreation.length}</b><span>حساب جديد</span></div><div className={result.preview.conflicts.length ? "warn" : ""}><b>{result.preview.conflicts.length}</b><span>تعارض يحتاج معالجة</span></div></div>
        {!!result.preview.ignoredFutureRecords && <div className="future-warning">تم استبعاد {result.preview.ignoredFutureRecords} سجل بتاريخ مستقبلي من الملف ولن تُحفظ في النظام.</div>}
        {!!result.preview.matched.length && <div className="matched-list">{result.preview.matched.map((row: any) => <div key={row.email}><span><b>{row.name}</b><small>{row.email}</small></span><strong>{row.hours} ساعة · {row.records} سجل</strong></div>)}</div>}
        {!!result.preview.pendingCreation.length && <details className="new-accounts" open><summary>حسابات ستُنشأ ({result.preview.pendingCreation.length})</summary>{result.preview.pendingCreation.map((row: any) => <span className="unmatched" key={row.email}>{row.name} — {row.email}</span>)}</details>}
        {!!result.preview.conflicts.length && <details open><summary>تعارضات تمنع الاعتماد ({result.preview.conflicts.length})</summary><p>صححي البريد أو رقم الجوال داخل ملف المشرف ثم أعيدي المعاينة.</p>{result.preview.conflicts.map((row: any, index: number) => <span className="unmatched" key={`${row.email}-${index}`}>{row.name} — {row.email} — {row.phone || "رقم مفقود"} — {conflictLabels[row.reason] || row.reason}</span>)}</details>}
        {result.committed && <p className="success">تم إنشاء {result.createdAccounts?.length || 0} حساب جديد وتحديث الساعات دون تكرار السجلات.</p>}
      </div>}
      {result && !result.ok && <div className="hours-error">{errors[result.error] || "تعذر إكمال العملية."}{result.error === "SUPERVISOR_FILE_MISMATCH" && result.found?.email ? <small>البريد الموجود في الملف: {result.found.email}</small> : null}</div>}
    </section>
  </div>;
}

const conflictLabels: Record<string, string> = {
  DUPLICATE_EMAIL_IN_FILE: "البريد مكرر داخل الملف",
  DUPLICATE_EMAIL_IN_SYSTEM: "البريد مكرر مسبقًا داخل النظام",
  DUPLICATE_PHONE_IN_FILE: "رقم الجوال مكرر داخل الملف",
  IDENTITY_CONFLICT: "البريد والجوال يعودان لحسابين مختلفين",
  PHONE_ALREADY_USED: "رقم الجوال مستخدم بحساب آخر",
  ASSIGNED_TO_ANOTHER_SUPERVISOR: "المتدرب مرتبط بمشرف آخر",
};

const css = `.hours-overlay{position:fixed;inset:0;background:#001442a8;z-index:1000;display:grid;place-items:center;padding:18px}.hours-dialog{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:25px;position:relative;box-shadow:0 30px 80px #00144255}.hours-close{position:absolute;left:17px;top:13px;border:0;background:#F1F5F9;color:#475569;width:32px;height:32px;border-radius:9px;font-size:22px;cursor:pointer}.hours-kicker{color:#0D40FC;font-weight:800}.hours-dialog h2{margin:5px 0 2px;color:#001442;font-size:21px}.hours-email{color:#64748B}.hours-safety{display:grid;gap:3px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;border-radius:12px;padding:12px 14px;margin:16px 0;font-size:12px}.hours-safety span{color:#047857}.hours-drop{display:grid;place-items:center;text-align:center;border:1.5px dashed #AFC2E8;border-radius:14px;background:#F8FAFF;color:#0D40FC;padding:25px;cursor:pointer}.hours-drop span{font-size:11px;color:#64748B;margin-top:4px}.hours-drop input{display:none}.hours-actions{display:flex;gap:9px;margin-top:13px}.hours-actions button{border-radius:10px;padding:10px 15px;font:inherit;font-weight:800;cursor:pointer}.hours-actions button:disabled{opacity:.4;cursor:not-allowed}.preview{border:1px solid #0D40FC;background:#fff;color:#0D40FC}.commit{border:0;background:#0D40FC;color:#fff}.hours-report{margin-top:16px;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden}.report-head{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;background:#F8FAFC;color:#001442}.report-head span{font-size:10px;color:#64748B}.report-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#E2E8F0}.report-stats div{background:#fff;padding:12px;text-align:center}.report-stats b{display:block;font-size:20px;color:#0D40FC}.report-stats span{font-size:10px;color:#64748B}.report-stats .warn b{color:#D97706}.future-warning{padding:10px 14px;background:#FFF7ED;color:#9A3412;font-size:11px;font-weight:750;border-top:1px solid #FED7AA}.matched-list{padding:8px 14px}.matched-list>div{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #EEF2F7;font-size:11px}.matched-list small{display:block;color:#94A3B8}.matched-list strong{color:#047857}details{padding:12px 14px;background:#FFF7ED;color:#9A3412;font-size:11px}details.new-accounts{background:#EFF6FF;color:#1D4ED8}details p{margin:7px 0}.unmatched{display:block;padding:2px 0}.success{margin:0;padding:12px 14px;background:#ECFDF5;color:#047857;font-size:12px;font-weight:800}.hours-error{margin-top:13px;padding:12px;border-radius:10px;background:#FEF2F2;color:#B91C1C;font-size:12px}.hours-error small{display:block;margin-top:5px}@media(max-width:600px){.report-stats{grid-template-columns:1fr}.hours-actions{display:grid}.matched-list>div{display:grid}}`;
