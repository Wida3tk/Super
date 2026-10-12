"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TraineeAccountSettings({ trainee }: { trainee: any }) {
  const router = useRouter();
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
        RECENT_LOGIN_REQUIRED: "لأمان حسابك، سجّل الخروج ثم ادخل مجددًا قبل تعديل بيانات الحساب.",
      };
      setMessage(errors[data.error] || "تعذر حفظ التعديلات.");
    } else {
      const locale = window.location.pathname.startsWith("/en") ? "en" : "ar";
      router.replace(`/${locale}/login?accountUpdated=1`);
    }
    setSaving(false);
  }

  const success = message.startsWith("تم");
  return (
    <section className="panel account-panel">
      <div className="account-heading">
        <div>
          <h3>إعدادات الحساب</h3>
          <p className="muted">يمكنك تغيير كلمة المرور. تحديث البريد الإلكتروني ورقم الهاتف يتم عن طريق الإدارة.</p>
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
            readOnly
            dir="ltr"
          />
        </label>
        <label>
          رقم الهاتف
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone || "لم تضف الإدارة رقم هاتف بعد"}
            readOnly
            dir="ltr"
          />
        </label>
        <label>
          كلمة المرور الجديدة <small>8 أحرف على الأقل</small>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="أدخل كلمة المرور الجديدة"
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
            required
            placeholder="أعد إدخال كلمة المرور الجديدة"
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
        <button className="primary account-save" disabled={saving || !form.password || !form.confirmPassword}>
          {saving ? "جاري الحفظ..." : "تغيير كلمة المرور"}
        </button>
      </form>
    </section>
  );
}
