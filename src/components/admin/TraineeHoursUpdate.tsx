"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  trainee: { id: string; name: string; email: string; license: string };
  supervisor: { name: string; email: string } | null;
};

export default function TraineeHoursUpdate({ trainee, supervisor }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const errors: Record<string, string> = {
    INVALID_FILE_OR_LICENSE: "اختاري ملف المتدرب الصحيح بصيغة xlsx.",
    FILE_TOO_LARGE: "حجم الملف يتجاوز الحد المسموح.",
    UNSUPPORTED_TRACKER_FILE: "هذا ليس نموذج تتبع الساعات المعتمد.",
    MISSING_TRAINEE_INFORMATION: "تعذر قراءة اسم المتدرب أو بريده أو تاريخ بدء الإشراف.",
    NO_VALID_ACTIVITIES: "لم نجد ساعات صالحة داخل الملف.",
    TRACKER_TRAINEE_MISMATCH: "الملف يخص متدربًا آخر. لم يتم تعديل أي بيانات.",
    SUPERVISOR_NOT_FOUND: "لا يوجد مشرف مرتبط يمكن اعتماد الملف من خلاله.",
    TRAINEE_ASSIGNED_TO_ANOTHER_SUPERVISOR: "المتدرب مرتبط بمشرف آخر.",
  };

  async function inspect() {
    if (!file || !supervisor) return;
    setLoading(true); setResult(null); setParsed(null); setPreview(null);
    const form = new FormData();
    form.append("file", file); form.append("license", trainee.license);
    const parseResponse = await fetch("/api/admin/legacy-trainee-import/parse", { method: "POST", body: form });
    const parseData = await parseResponse.json().catch(() => ({}));
    if (!parseResponse.ok) { setResult(parseData); setLoading(false); return; }
    const payload = {
      supervisorEmail: supervisor.email,
      supervisorName: supervisor.name,
      createSupervisor: false,
      sendInvitations: false,
      dryRun: true,
      expectedTraineeId: trainee.id,
      trainees: parseData.trainees,
    };
    const response = await fetch("/api/admin/legacy-trainee-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setParsed(parseData); setPreview(data); }
    else setResult(data);
    setLoading(false);
  }

  async function commit() {
    if (!parsed || !supervisor) return;
    setLoading(true); setResult(null);
    const response = await fetch("/api/admin/legacy-trainee-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisorEmail: supervisor.email, supervisorName: supervisor.name, createSupervisor: false, sendInvitations: false, dryRun: false, expectedTraineeId: trainee.id, trainees: parsed.trainees }),
    });
    const data = await response.json().catch(() => ({}));
    setResult(data); setLoading(false);
    if (response.ok) { setPreview(null); router.refresh(); }
  }

  const close = () => { setOpen(false); setFile(null); setParsed(null); setPreview(null); setResult(null); };
  return <>
    <button type="button" disabled={!supervisor} title={!supervisor ? "يجب إسناد المتدرب إلى مشرف أولًا" : ""} onClick={() => setOpen(true)} style={{ border: "1px solid #ffffff42", background: "#ffffff18", color: "white", borderRadius: 10, padding: "9px 13px", font: "inherit", fontSize: 12, fontWeight: 800, cursor: supervisor ? "pointer" : "not-allowed", opacity: supervisor ? 1 : .45, whiteSpace: "nowrap" }}>↻ تحديث ملف الساعات</button>
    {open && <div className="tu-overlay" dir="rtl" onMouseDown={(event) => event.target === event.currentTarget && close()}><style>{css}</style><section className="tu-dialog">
      <button className="tu-close" onClick={close}>×</button><small>تحديث السجل الحالي</small><h3>ساعات {trainee.name}</h3><p>{trainee.email} · {trainee.license}</p>
      <div className="tu-note"><b>لن يُنشأ حساب أو ملف جديد.</b><span>سيتحقق النظام من هوية المتدرب والمشرف، ثم يضيف السجلات الجديدة فقط ويحافظ على الساعات السابقة.</span></div>
      <label className="tu-file"><b>{file ? file.name : "اختيار ملف تتبع الساعات (.xlsx)"}</b><span>يجب أن يكون البريد داخل الملف مطابقًا لبريد المتدرب</span><input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setParsed(null); setPreview(null); setResult(null); }} /></label>
      <div className="tu-actions"><button disabled={!file || loading} onClick={() => void inspect()}>{loading ? "جارٍ الفحص..." : "فحص ومعاينة"}</button><button className="primary" disabled={!preview || loading} onClick={() => void commit()}>اعتماد التحديث</button></div>
      {preview?.trainees?.[0] && <div className="tu-preview"><b>تمت مطابقة الملف</b><div><span>الاسم</span><strong>{preview.trainees[0].name}</strong></div><div><span>الساعات الموجودة في الملف</span><strong>{preview.trainees[0].fieldworkHours + preview.trainees[0].supervisionHours} ساعة</strong></div><div><span>سجلات النشاط</span><strong>{preview.trainees[0].activityCount}</strong></div></div>}
      {result?.success && <div className="tu-success">تم تحديث الساعات بنجاح. أضيف {result.results?.[0]?.createdActivities || 0} سجل جديد، وتُركت السجلات السابقة دون تكرار.</div>}
      {result?.error && <div className="tu-error">{errors[result.error] || "تعذر تحديث الملف."}{result.found?.email && <small>البريد الموجود في الملف: {result.found.email}</small>}</div>}
    </section></div>}
  </>;
}

const css = `.tu-overlay{position:fixed;inset:0;background:#001442a8;z-index:1300;display:grid;place-items:center;padding:18px}.tu-dialog{width:min(620px,100%);max-height:92vh;overflow:auto;background:white;border-radius:19px;padding:24px;position:relative;box-shadow:0 30px 80px #00144255}.tu-close{position:absolute;left:14px;top:12px;border:0;width:32px;height:32px;border-radius:9px;background:#F1F5F9;color:#475569;font-size:21px;cursor:pointer}.tu-dialog>small{color:#0D40FC;font-size:10px;font-weight:800}.tu-dialog h3{margin:3px 0;color:#001442;font-size:20px}.tu-dialog>p{margin:0;color:#64748B;font-size:11px}.tu-note{display:grid;gap:3px;margin:15px 0;padding:12px;border-radius:11px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;font-size:11px}.tu-note span{color:#047857}.tu-file{display:grid;place-items:center;text-align:center;padding:23px;border:1.5px dashed #AFC2E8;background:#F8FAFF;color:#0D40FC;border-radius:13px;cursor:pointer}.tu-file span{font-size:10px;color:#64748B;margin-top:4px}.tu-file input{display:none}.tu-actions{display:flex;gap:8px;margin-top:12px}.tu-actions button{padding:10px 15px;border:1px solid #0D40FC;background:white;color:#0D40FC;border-radius:9px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.tu-actions .primary{background:#0D40FC;color:white}.tu-actions button:disabled{opacity:.4;cursor:not-allowed}.tu-preview{margin-top:14px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden}.tu-preview>b{display:block;padding:11px;background:#F8FAFC;color:#001442}.tu-preview>div{display:flex;justify-content:space-between;gap:10px;padding:9px 12px;border-top:1px solid #EEF2F7;font-size:11px}.tu-preview span{color:#64748B}.tu-preview strong{color:#001442}.tu-success,.tu-error{margin-top:13px;padding:11px;border-radius:10px;font-size:11px}.tu-success{background:#ECFDF5;color:#047857}.tu-error{background:#FEF2F2;color:#B91C1C}.tu-error small{display:block;margin-top:4px}`;
