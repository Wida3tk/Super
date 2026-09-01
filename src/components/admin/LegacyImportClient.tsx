"use client";

import { useState } from "react";

type ImportFile = Array<{
  sourceFile?: string;
  info: { name: string; email: string; supervisionStartDate: string };
  supervisorSummary: { license: "QASP-S" | "QBA"; totalSupervision: number };
  activities: unknown[];
}>;

export default function LegacyImportClient() {
  const [supervisorEmail, setSupervisorEmail] = useState("master.bcba@gmail.com");
  const [data, setData] = useState<ImportFile | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function readFile(file?: File) {
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error("INVALID_FILE");
    setData(parsed);
    setResult(null);
  }

  async function submit(dryRun: boolean) {
    if (!data) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/legacy-trainee-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supervisorEmail, trainees: data, dryRun }),
      });
      const body = await response.json();
      setResult({ ok: response.ok, status: response.status, ...body });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ color: "#001442", marginBottom: 8 }}>استيراد السجلات السابقة</h1>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        أداة إدارية محمية لمطابقة الحسابات وربط المشرف واستيراد الساعات المعتمدة دون تكرار.
      </p>
      <section style={{ background: "white", border: "1px solid #dbe5f1", borderRadius: 18, padding: 24 }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>بريد المشرف</label>
        <input
          value={supervisorEmail}
          onChange={(event) => setSupervisorEmail(event.target.value)}
          style={{ width: "100%", padding: 12, border: "1px solid #cbd5e1", borderRadius: 10, marginBottom: 18 }}
        />
        <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>ملف الاستيراد JSON</label>
        <input type="file" accept="application/json,.json" onChange={(event) => void readFile(event.target.files?.[0])} />
        {data && (
          <div style={{ marginTop: 18, padding: 16, background: "#f8fafc", borderRadius: 12 }}>
            جاهز للاستيراد: {data.map((item) => item.info.name).join("، ")} — {data.reduce((sum, item) => sum + item.activities.length, 0)} سجلًا
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button disabled={!data || loading} onClick={() => void submit(true)} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #0d40fc", color: "#0d40fc", background: "white", fontWeight: 700 }}>
            فحص دون حفظ
          </button>
          <button disabled={!data || loading} onClick={() => void submit(false)} style={{ padding: "12px 18px", borderRadius: 10, border: 0, color: "white", background: "#0d40fc", fontWeight: 700 }}>
            اعتماد الاستيراد
          </button>
        </div>
      </section>
      {result && (
        <pre dir="ltr" style={{ whiteSpace: "pre-wrap", marginTop: 20, padding: 18, borderRadius: 14, background: result.ok ? "#ecfdf5" : "#fef2f2", color: "#0f172a" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
