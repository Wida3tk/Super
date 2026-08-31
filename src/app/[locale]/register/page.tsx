"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

const messages: Record<string, string> = {
  INVALID_ARABIC_NAME: "اكتب الاسم الثلاثي باللغة العربية.",
  INVALID_EMAIL: "تحقق من البريد الإلكتروني.",
  INVALID_PHONE: "تحقق من رقم الهاتف.",
  INVALID_PROFILE: "أكمل بيانات نوع الخدمة والمؤهل.",
  WEAK_PASSWORD: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
  EMAIL_EXISTS: "يوجد حساب بهذا البريد؛ استخدم تسجيل الدخول.",
};

export default function RegisterPage() {
  const { locale = "ar" } = useParams<{ locale: string }>();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    bookingIntent: "initial_interview",
    license: "behavior_analyst",
    qualification: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function changeIntent(value: string) {
    setForm((current) => ({
      ...current,
      bookingIntent: value,
      license: value === "consultation" ? "consultant" : "behavior_analyst",
      qualification: value === "consultation" ? "" : current.qualification,
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          messages[data.error] || "تعذر إنشاء الحساب. حاول مرة أخرى.",
        );
      const credential = await signInWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      );
      const token = await credential.user.getIdToken();
      const session = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!session.ok)
        throw new Error(
          "تم إنشاء الحساب، لكن تعذر تسجيل الدخول تلقائيًا. استخدم صفحة الدخول.",
        );
      window.location.href =
        form.bookingIntent === "consultation"
          ? `/${locale}#consultants`
          : `/${locale}/trainee-dashboard`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إنشاء الحساب.");
      setLoading(false);
    }
  }

  return (
    <main dir="rtl">
      <style>{`*{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#001442,#0D40FC);font-family:'IBM Plex Sans Arabic',Arial}.page{min-height:100vh;display:grid;place-items:center;padding:28px}.card{width:min(760px,100%);background:#fff;border-radius:24px;padding:30px;box-shadow:0 25px 70px #00144255}.top{display:flex;justify-content:space-between;align-items:start;gap:15px}.top a{color:#0D40FC;text-decoration:none;font-size:13px}.card h1{margin:0;color:#001442}.lead{color:#64748B;font-size:14px;margin:6px 0 24px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field label{display:block;font-size:12px;color:#64748B;font-weight:700;margin-bottom:6px}.field input,.field select{width:100%;padding:12px;border:1px solid #D5DDE9;border-radius:10px;font:inherit;background:#fff}.field input:focus,.field select:focus{outline:2px solid #BFD0FF;border-color:#0D40FC}.full{grid-column:1/-1}.intent{display:grid;grid-template-columns:1fr 1fr;gap:9px}.intent button{padding:13px;border:1px solid #D5DDE9;background:#F8FAFC;border-radius:11px;font:inherit;cursor:pointer}.intent button.active{background:#EEF4FF;border-color:#0D40FC;color:#0D40FC;font-weight:800}.submit{width:100%;border:0;background:#0D40FC;color:#fff;padding:14px;border-radius:11px;font:inherit;font-weight:800;cursor:pointer;margin-top:20px}.submit:disabled{opacity:.65}.error{background:#FEF2F2;color:#B91C1C;padding:11px;border-radius:9px;margin-top:13px;font-size:12px}.note{font-size:11px;color:#94A3B8;margin-top:5px}@media(max-width:650px){.fields{grid-template-columns:1fr}.full{grid-column:auto}.intent{grid-template-columns:1fr}.card{padding:22px}}`}</style>
      <div className="page">
        <form className="card" onSubmit={submit}>
          <div className="top">
            <div>
              <h1>إنشاء حساب جديد</h1>
              <p className="lead">
                أنشئ حسابك وأرسل طلب الانضمام؛ ستربطك الإدارة بالمشرف المناسب.
              </p>
            </div>
            <Link href={`/${locale}`}>العودة للرئيسية</Link>
          </div>
          <div className="fields">
            <div className="field full">
              <label>نوع الحجز</label>
              <div className="intent">
                <button
                  type="button"
                  className={
                    form.bookingIntent === "initial_interview" ? "active" : ""
                  }
                  onClick={() => changeIntent("initial_interview")}
                >
                  مقابلة أولية
                </button>
                <button
                  type="button"
                  className={
                    form.bookingIntent === "consultation" ? "active" : ""
                  }
                  onClick={() => changeIntent("consultation")}
                >
                  استشارة إدارة سلوك تنظيمي
                </button>
              </div>
            </div>
            <div className="field">
              <label>الاسم الثلاثي باللغة العربية</label>
              <input
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>رقم الهاتف</label>
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>البريد الإلكتروني — يستخدم للدخول</label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>
                {form.bookingIntent === "consultation"
                  ? "المستوى المهني"
                  : "الرخصة"}
              </label>
              <select
                value={form.license}
                onChange={(e) => setForm({ ...form, license: e.target.value })}
              >
                {form.bookingIntent === "consultation" ? (
                  <>
                    <option value="consultant">المستشار</option>
                    <option value="expert">الخبير</option>
                  </>
                ) : (
                  <>
                    <option value="behavior_analyst">محلل سلوك</option>
                    <option value="assistant_behavior_analyst">
                      مساعد محلل سلوك
                    </option>
                    <option value="post_license_supervision">
                      إشراف بعد الرخصة
                    </option>
                  </>
                )}
              </select>
            </div>
            {form.bookingIntent === "initial_interview" && (
              <div className="field">
                <label>المؤهل الدراسي</label>
                <input
                  value={form.qualification}
                  onChange={(e) =>
                    setForm({ ...form, qualification: e.target.value })
                  }
                  required
                />
              </div>
            )}
            <div className="field">
              <label>كلمة المرور</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <div className="note">8 أحرف على الأقل</div>
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="submit" disabled={loading}>
            {loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب وإرسال الطلب"}
          </button>
        </form>
      </div>
    </main>
  );
}
