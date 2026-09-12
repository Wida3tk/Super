"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SupervisorImportClient({ embedded = false, onImported }: { embedded?: boolean; onImported?: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  async function run(commit: boolean) {
    if (!file) return;
    setLoading(true);
    const form = new FormData(); form.append("file", file); form.append("commit", String(commit));
    const response = await fetch("/api/admin/supervisor-import", { method: "POST", body: form });
    setResult({ status: response.status, ...await response.json() }); setLoading(false);
    if (commit && response.ok) setTimeout(() => { onImported?.(); router.refresh(); }, 900);
  }
  const errorLabels:Record<string,string>={INVALID_XLSX:'اختاري ملف Excel بصيغة xlsx.',FILE_TOO_LARGE:'حجم الملف يتجاوز 15MB.',UNSUPPORTED_SUPERVISOR_FILE:'هذا ليس قالب ملف المشرف المعتمد.',MISSING_SUPERVISOR_INFORMATION:'تعذر العثور على اسم المشرف أو بريده داخل الملف.',SUPERVISOR_IMPORT_FAILED:'تعذر قراءة الملف. تحققي من القالب وحاولي مجددًا.'};
  return <main dir="rtl" style={{ maxWidth: 900, margin: "0 auto", padding: embedded ? 18 : 32 }}>
    {!embedded && <><h1 style={{ color: "#001442" }}>استيراد ملف مشرف</h1><p style={{ color: "#64748B" }}>ارفع ملف المشرف القياسي. سنقرأ هويته واعتماده ومقاعده، ثم نجهز حسابه دون إرسال كلمة مرور أو رسالة.</p></>}
    <section style={{ background: "white", border: "1px solid #DBE5F1", borderRadius: 18, padding: 24 }}>
      {embedded && <div style={{marginBottom:18}}><h2 style={{margin:'0 0 5px',fontSize:19,color:'#001442'}}>استيراد ملف مشرف</h2><p style={{margin:0,color:'#64748B',fontSize:12}}>ارفعي ملف Excel القياسي؛ سنعرض البيانات أولًا للمراجعة ولن نرسل كلمة مرور أو رسالة.</p></div>}
      <label style={{display:'grid',placeItems:'center',padding:24,border:'1.5px dashed #AFC2E8',borderRadius:14,background:'#F8FAFF',cursor:'pointer',color:'#0D40FC',fontWeight:800}}><span>{file ? file.name : 'اختيار ملف المشرف (.xlsx)'}</span><small style={{color:'#64748B',fontWeight:400,marginTop:5}}>الحد الأقصى 15MB</small><input style={{display:'none'}} type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); }} /></label>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button disabled={!file || loading} onClick={() => void run(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid #0D40FC", background: "white", color: "#0D40FC", fontWeight: 700,opacity:(!file||loading)?.55:1 }}>{loading?'جارٍ الفحص...':'معاينة وفحص'}</button><button disabled={!file || loading || !result?.preview} onClick={() => void run(true)} style={{ padding: "11px 18px", borderRadius: 10, border: 0, background: "#0D40FC", color: "white", fontWeight: 700,opacity:(!file||loading||!result?.preview)?.55:1 }}>اعتماد الاستيراد</button></div>
      {result?.preview && <div style={{marginTop:18,padding:18,borderRadius:14,background:'#F8FAFC',border:'1px solid #E2E8F0'}}><div style={{fontWeight:800,color:'#001442',marginBottom:12}}>{result.created===true?'تم إنشاء الحساب':'بيانات المشرف المستخرجة'}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:9}}>{[['الاسم',result.preview.name],['البريد',result.preview.email],['الاعتماد',result.preview.credential||'غير مذكور'],['المقاعد',result.preview.availableSeats],['نوع الحساب','مشرف'],['الملف',result.preview.sourceFile]].map(([label,value])=><div key={String(label)} style={{padding:11,background:'#fff',borderRadius:9,border:'1px solid #E8EDF5'}}><small style={{color:'#64748B'}}>{label}</small><div style={{fontWeight:700,marginTop:3,wordBreak:'break-word'}}>{String(value)}</div></div>)}</div>{result.supervisorId&&<p style={{margin:'12px 0 0',color:'#047857',fontWeight:700,fontSize:12}}>تم تجهيز الحساب بنجاح وإضافته إلى قائمة المشرفين.</p>}</div>}
      {result && !result.ok && <div style={{marginTop:16,padding:12,borderRadius:10,background:'#FEF2F2',color:'#B91C1C',fontSize:12}}>{errorLabels[result.error]||'تعذر استيراد الملف.'}</div>}
    </section>
  </main>;
}
