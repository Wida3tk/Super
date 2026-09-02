"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SupervisorImportClient() {
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
    if (commit && response.ok) setTimeout(() => router.push("./supervisors"), 1200);
  }
  return <main dir="rtl" style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}><h1 style={{ color: "#001442" }}>استيراد ملف مشرف</h1><p style={{ color: "#64748B" }}>ارفع ملف المشرف القياسي. سنقرأ هويته واعتماده ومقاعده، ثم نجهز حسابه دون إرسال كلمة مرور أو رسالة.</p><section style={{ background: "white", border: "1px solid #DBE5F1", borderRadius: 18, padding: 24 }}><input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); }} /><div style={{ display: "flex", gap: 10, marginTop: 20 }}><button disabled={!file || loading} onClick={() => void run(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid #0D40FC", background: "white", color: "#0D40FC", fontWeight: 700 }}>معاينة وفحص</button><button disabled={!file || loading || !result?.preview} onClick={() => void run(true)} style={{ padding: "11px 18px", borderRadius: 10, border: 0, background: "#0D40FC", color: "white", fontWeight: 700 }}>اعتماد الاستيراد</button></div>{result && <pre dir="ltr" style={{ whiteSpace: "pre-wrap", marginTop: 18, padding: 16, borderRadius: 12, background: result.ok ? "#ECFDF5" : "#FEF2F2" }}>{JSON.stringify(result, null, 2)}</pre>}</section></main>;
}
