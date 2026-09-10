"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadTraineeFile, UploadCategory } from "@/lib/drive/uploadClient";

const categories: Array<{ value: UploadCategory; label: string; hint: string }> = [
  { value: "approvals", label: "الموافقات والمستندات", hint: "موافقات المركز وولي الأمر والنماذج الرسمية" },
  { value: "meeting_minutes", label: "محاضر الاجتماعات", hint: "المحاضر والملخصات والقرارات المتفق عليها" },
  { value: "activity_evidence", label: "أدلة الأنشطة", hint: "التقارير وأوراق العمل ومخرجات الأنشطة" },
  { value: "videos", label: "فيديوهات التطبيق", hint: "فيديو تطبيقي بعد الحصول على الموافقات اللازمة" },
];

const statusText: Record<string, string> = {
  uploaded: "بانتظار المراجعة",
  reviewed: "تمت المراجعة",
  replace_required: "يحتاج استبدال",
};

export default function TraineeFilesWorkspace({ traineeId, initialDocuments }: { traineeId: string; initialDocuments: any[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<UploadCategory>("activity_evidence");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!file || !title.trim()) return setMessage("اختاري الملف واكتبي عنوانًا واضحًا.");
    setBusy(true); setProgress(0); setMessage("");
    try {
      await uploadTraineeFile({ traineeId, file, category, type: category === "approvals" ? "other" : category, title, notes, issuedAt: new Date().toISOString().slice(0, 10), onProgress: setProgress });
      setMessage("تم رفع الملف وإرساله للمراجعة.");
      setTitle(""); setNotes(""); setFile(null);
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "INVALID_FILE" ? "النوع غير مدعوم أو حجم الملف يتجاوز 250MB." : code === "FORBIDDEN" ? "رفع الملفات متاح بعد بدء الخدمة والإسناد للمشرف." : "تعذر رفع الملف. تحققي من الاتصال أو إعدادات Drive ثم حاولي مجددًا.");
    } finally { setBusy(false); }
  };

  return <div className="files-workspace">
    <style>{`.files-workspace{display:grid;gap:16px}.file-uploader{background:linear-gradient(135deg,#001442,#0d40fc);color:#fff;border-radius:18px;padding:20px}.file-uploader h3{margin:0 0 5px}.file-uploader>p{margin:0 0 16px;color:#c9d8ff;font-size:12px}.category-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.category-choice{border:1px solid #ffffff2f;background:#ffffff12;color:#fff;border-radius:12px;padding:12px;text-align:right;cursor:pointer}.category-choice.active{background:#fff;color:#001442}.category-choice b,.category-choice small{display:block}.category-choice small{font-size:10px;opacity:.75;margin-top:4px;line-height:1.5}.upload-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.upload-fields input,.upload-fields textarea{border:0;border-radius:10px;padding:11px;font:inherit}.upload-fields textarea{grid-column:1/-1;min-height:68px;resize:vertical}.file-input{grid-column:1/-1;background:#ffffff12;padding:12px;border-radius:10px}.file-input input{width:100%;color:#fff}.upload-action{display:flex;align-items:center;gap:12px;margin-top:12px}.upload-action button{border:0;background:#55d7ff;color:#001442;border-radius:10px;padding:10px 18px;font-weight:800;cursor:pointer}.upload-action button:disabled{opacity:.55}.progress{height:7px;flex:1;background:#ffffff2b;border-radius:9px;overflow:hidden}.progress i{display:block;height:100%;background:#55d7ff}.upload-message{font-size:12px}.file-list{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px}.file-list h3{margin:0 0 12px}.file-row{display:grid;grid-template-columns:1.4fr .8fr auto;gap:12px;align-items:center;padding:12px;border-top:1px solid #edf2f7}.file-row:first-of-type{border-top:0}.file-row p{margin:3px 0;color:#64748b;font-size:11px}.file-row a{color:#0d40fc;text-decoration:none;font-weight:700}.file-status{font-size:11px;background:#eff6ff;color:#1d4ed8;padding:5px 8px;border-radius:99px;width:max-content}@media(max-width:760px){.category-grid{grid-template-columns:1fr 1fr}.upload-fields{grid-template-columns:1fr}.file-row{grid-template-columns:1fr}.upload-fields textarea,.file-input{grid-column:auto}}`}</style>
    <section className="file-uploader">
      <h3>إضافة ملف إلى سجل الإشراف</h3><p>يحفظ الملف بأمان في مساحة سلوكيرا ويظهر فقط لكِ ولمشرفك والإدارة.</p>
      <div className="category-grid">{categories.map((item) => <button key={item.value} className={`category-choice ${category === item.value ? "active" : ""}`} onClick={() => setCategory(item.value)}><b>{item.label}</b><small>{item.hint}</small></button>)}</div>
      <div className="upload-fields"><input placeholder="عنوان الملف" value={title} onChange={(e) => setTitle(e.target.value)} /><div className="file-input"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.mp4,.mov,.webm" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div><textarea placeholder="ملاحظة للمشرف (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="upload-action"><button disabled={busy || !file || !title.trim()} onClick={submit}>{busy ? `جارٍ الرفع ${progress}%` : "رفع الملف"}</button>{busy && <div className="progress"><i style={{ width: `${progress}%` }} /></div>}{message && <span className="upload-message">{message}</span>}</div>
    </section>
    <section className="file-list"><h3>ملفاتي المرفوعة</h3>{initialDocuments.map((document) => <article className="file-row" key={document.id}><div><b>{document.title || document.fileName}</b><p>{document.fileName} · {document.issuedAt || "—"}</p></div><span className="file-status">{statusText[document.status] || "مرفوع"}</span>{document.storageProvider === "google_drive" ? <a href={`/api/files?documentId=${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer">عرض الملف ↗</a> : document.fileUrl ? <a href={`/api/supervisor/document-upload?path=${encodeURIComponent(document.fileUrl)}`}>تنزيل</a> : null}</article>)}{!initialDocuments.length && <p style={{ color: "#64748b", fontSize: 12 }}>لا توجد ملفات مرفوعة بعد.</p>}</section>
  </div>;
}
