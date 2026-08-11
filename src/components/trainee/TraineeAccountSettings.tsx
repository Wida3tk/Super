"use client";

import { FormEvent, useState } from "react";

export default function TraineeAccountSettings({ trainee }: { trainee: any }) {
  const [form, setForm] = useState({
    email: String(trainee.email || ""),
    phone: String(trainee.phone || ""),
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (form.password !== form.confirmPassword) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/trainee/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        phone: form.phone,
        password: form.password,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errors: Record<string, string> = {
        INVALID_EMAIL: "تحقق من البريد الإلكتروني.",
        INVALID_PHONE: "تحقق من رقم الهاتف.",
        WEAK_PASSWORD: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
        EMAIL_EXISTS: "البريد الإلكتروني مستخدم في حساب آخر.",
      };
      setMessage(errors[data.error] || "تعذر حفظ التعديلات.");
    } else {
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
      setMessage("تم تحديث بيانات حسابك بنجاح.");
    }
    setSaving(false);
  }

  const success = message.startsWith("تم");
  return (
    <section className="panel account-panel">
      <div className="account-heading">
        <div>
          <h3>إعدادات الحساب</h3>
          <p className="muted">حدّث بيانات التواصل أو عيّن كلمة مرور جديدة.</p>
        </div>
        <span className="account-lock" aria-hidden="true">
          ●
        </span>
      </div>
      <form className="account-form" onSubmit={submit}>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          رقم الهاتف
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>
        <label>
          كلمة مرور جديدة <small>اختياري</small>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label>
          تأكيد كلمة المرور
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirmPassword}
            onChange={(e) =>
              setForm({ ...form, confirmPassword: e.target.value })
            }
            disabled={!form.password}
          />
        </label>
        {message && (
          <div
            className={`account-message ${success ? "success" : "error"}`}
            role="status"
          >
            {message}
          </div>
        )}
        <button className="primary account-save" disabled={saving}>
          {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
        </button>
      </form>
    </section>
  );
}
