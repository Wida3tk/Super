"use client";

import { FormEvent, useState } from "react";

export default function ManageTraineePassword({ traineeId }: { traineeId: string }) {
  const [open, setOpen] = useState(false);
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
    <>
      <button type="button" onClick={() => { setOpen(true); setMessage(""); }} style={{ border: "1px solid #ffffff42", background: "#ffffff18", color: "white", borderRadius: 10, padding: "9px 13px", font: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>🔑 تغيير كلمة المرور</button>
      {open && <div dir="rtl" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)} style={{ position: "fixed", inset: 0, background: "#001442a8", display: "grid", placeItems: "center", padding: 18, zIndex: 1200 }}>
        <section style={{ width: "min(540px,100%)", background: "white", borderRadius: 18, padding: 24, boxShadow: "0 28px 70px #00144255", position: "relative" }}>
          <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" style={{ position: "absolute", left: 14, top: 12, width: 32, height: 32, border: 0, borderRadius: 9, background: "#F1F5F9", color: "#475569", fontSize: 21, cursor: "pointer" }}>×</button>
          <h3 style={{ margin: "0 0 6px", color: "#001442" }}>تغيير كلمة مرور المتدرب</h3>
          <p style={{ color: "#64748B", fontSize: 12, margin: "0 0 18px" }}>تغيير إداري مباشر. لا تُحفظ كلمة المرور ولا تظهر بعد تنفيذ العملية.</p>
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          كلمة المرور الجديدة
          <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} style={{ padding: "11px 12px", border: "1px solid #CBD5E1", borderRadius: 10 }} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          تأكيد كلمة المرور
          <input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} style={{ padding: "11px 12px", border: "1px solid #CBD5E1", borderRadius: 10 }} />
        </label>
        <button type="submit" disabled={saving || !password || !confirmation} style={{ padding: "12px 18px", border: 0, borderRadius: 10, background: "#0D40FC", color: "white", fontWeight: 800, cursor: "pointer", opacity: saving || !password || !confirmation ? .55 : 1 }}>
          {saving ? "جاري التغيير..." : "تغيير كلمة المرور"}
        </button>
          </form>
          {message && <div role="status" style={{ marginTop: 12, padding: 10, borderRadius: 9, fontSize: 12, color: success ? "#047857" : "#B91C1C", background: success ? "#ECFDF5" : "#FEF2F2" }}>{message}</div>}
        </section>
      </div>}
    </>
  );
}
