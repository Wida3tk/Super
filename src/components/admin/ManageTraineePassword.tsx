"use client";

import { FormEvent, useState } from "react";

export default function ManageTraineePassword({ traineeId }: { traineeId: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) return setMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    if (password !== confirmation) return setMessage("كلمتا المرور غير متطابقتين.");

    setSaving(true);
    const response = await fetch("/api/admin/trainee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId, action: "resetPassword", password }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setPassword("");
      setConfirmation("");
      setMessage("تم تغيير كلمة المرور، ويمكن للمتدرب تسجيل الدخول بها الآن.");
    } else {
      const errors: Record<string, string> = {
        AUTH_USER_NOT_FOUND: "لا يوجد حساب دخول مرتبط بهذا البريد. أنشئي الحساب أو أعيدي إسناد المتدرب أولًا.",
        MISSING_EMAIL: "ملف المتدرب لا يحتوي على بريد إلكتروني.",
        WEAK_PASSWORD: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
      };
      setMessage(errors[result.error] || "تعذر تغيير كلمة المرور. حاولي مرة أخرى.");
    }
    setSaving(false);
  }

  const success = message.startsWith("تم");
  return (
    <section style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>الدخول وكلمة المرور</h3>
      <p style={{ color: "#64748B", fontSize: 13, marginTop: 0 }}>تغيير إداري مباشر لكلمة مرور المتدرب. لا تُحفظ أو تُعرض الكلمة بعد التغيير.</p>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          كلمة المرور الجديدة
          <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} style={{ padding: "11px 12px", border: "1px solid #CBD5E1", borderRadius: 10 }} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          تأكيد كلمة المرور
          <input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} style={{ padding: "11px 12px", border: "1px solid #CBD5E1", borderRadius: 10 }} />
        </label>
        <button type="submit" disabled={saving || !password || !confirmation} style={{ padding: "12px 18px", border: 0, borderRadius: 10, background: "#0D40FC", color: "white", fontWeight: 800, cursor: "pointer", opacity: saving ? .65 : 1 }}>
          {saving ? "جاري التغيير..." : "تغيير كلمة المرور"}
        </button>
      </form>
      {message && <div role="status" style={{ marginTop: 12, padding: 10, borderRadius: 9, fontSize: 13, color: success ? "#047857" : "#B91C1C", background: success ? "#ECFDF5" : "#FEF2F2" }}>{message}</div>}
    </section>
  );
}
