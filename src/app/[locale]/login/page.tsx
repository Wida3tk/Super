"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function LoginPage() {
  const [portal, setPortal] = useState<"trainee" | "provider" | "admin">(
    "trainee",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("portal") === "admin") {
      setPortal("admin");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStep("جارٍ التحقق من البيانات...");

    try {
      // Step 1: Firebase Auth
      setStep("جارٍ تسجيل الدخول...");
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
      } catch (firebaseErr: any) {
        console.error(
          "Firebase auth error:",
          firebaseErr.code,
          firebaseErr.message,
        );
        const code = firebaseErr?.code || "";
        if (
          code.includes("user-not-found") ||
          code.includes("wrong-password") ||
          code.includes("invalid-credential") ||
          code.includes("invalid-email")
        ) {
          setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        } else if (code.includes("too-many-requests")) {
          setError("تم تجاوز عدد المحاولات، حاول لاحقاً");
        } else {
          setError(`خطأ Firebase: ${firebaseErr.code}`);
        }
        setLoading(false);
        setStep("");
        return;
      }

      // Step 2: Get token
      setStep("جارٍ إنشاء الجلسة...");
      const token = await userCredential.user.getIdToken();

      // Step 3: Create session
      let res;
      try {
        res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch (fetchErr: any) {
        setError("خطأ في الاتصال بالسيرفر");
        setLoading(false);
        setStep("");
        return;
      }

      const sessionData = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          `فشل إنشاء الجلسة: ${sessionData.error || res.status} - ${sessionData.detail || ""}`,
        );
        setLoading(false);
        setStep("");
        return;
      }

      // Step 4: Redirect
      setStep("تم! جارٍ التوجيه...");
      const role =
        sessionData.role || (sessionData.isAdmin ? "admin" : "supervisor");
      const dest =
        role === "admin"
          ? "/ar/admin"
          : role === "trainee"
            ? "/ar/trainee-dashboard"
            : role === "client"
              ? "/ar/client-dashboard"
              : "/ar/supervisor-dashboard";
      // انتظر ثانية عشان الـ cookie ينحفظ
      await new Promise((r) => setTimeout(r, 800));
      window.location.href = dest;
    } catch (err: any) {
      setError(`خطأ غير متوقع: ${err.message || err}`);
      setLoading(false);
      setStep("");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
        :root { --primary: #0D40FC; --deep: #001442; --neon: #55D7FF; }
        body { background: var(--deep); direction: rtl; min-height: 100vh; }
        .page { min-height: 100vh; display: grid; grid-template-columns: 1fr 480px; }
        @media(max-width: 900px) { .page { grid-template-columns: 1fr; } .page-left { display: none; } }
        .page-left {
          background: linear-gradient(150deg, #020716 0%, #001442 50%, #0D2080 100%);
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          padding: 60px; position: relative; overflow: hidden;
        }
        .page-left::before { content: ''; position: absolute; top: -200px; left: -200px; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(13,64,252,0.15) 0%, transparent 70%); }
        .page-left::after { content: ''; position: absolute; bottom: -150px; right: -150px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(85,215,255,0.08) 0%, transparent 70%); }
        .brand-logo { font-size: 52px; font-weight: 900; color: var(--primary); letter-spacing: -2px; margin-bottom: 8px; position: relative; z-index: 1; }
        .brand-en { font-size: 14px; font-weight: 600; color: var(--neon); letter-spacing: 0.25em; text-transform: uppercase; opacity: 0.7; margin-bottom: 48px; position: relative; z-index: 1; }
        .brand-tagline { font-size: 26px; font-weight: 700; color: #fff; text-align: center; line-height: 1.5; margin-bottom: 16px; position: relative; z-index: 1; }
        .brand-sub { font-size: 14px; color: rgba(255,255,255,0.45); text-align: center; line-height: 1.7; max-width: 320px; position: relative; z-index: 1; }
        .brand-dots { display: flex; gap: 8px; margin-top: 48px; position: relative; z-index: 1; }
        .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.15); }
        .brand-dot.active { background: var(--primary); width: 24px; border-radius: 4px; }
        .page-right { background: #F8FAFC; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 48px 40px; min-height: 100vh; }
        .login-box { width: 100%; max-width: 380px; }
        .login-welcome { margin-bottom: 36px; }
        .login-welcome h1 { font-size: 28px; font-weight: 800; color: var(--deep); margin-bottom: 6px; }
        .login-welcome p { font-size: 14px; color: #8898AA; }
        .portal-picker { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:26px;padding:5px;background:#EAF0F8;border-radius:14px; }
        .portal-option { border:0;border-radius:10px;padding:12px 10px;background:transparent;color:#64748B;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s; }
        .portal-option.active { background:#fff;color:var(--primary);box-shadow:0 3px 12px rgba(1,20,66,.1); }
        .portal-hint { font-size:11px;color:#94A3B8;line-height:1.6;margin:-15px 0 22px; }
        .field { margin-bottom: 20px; }
        .field label { display: block; font-size: 12px; font-weight: 700; color: #8898AA; margin-bottom: 8px; letter-spacing: 0.04em; }
        .input-wrap { position: relative; }
        .field input { width: 100%; background: #fff; border: 1.5px solid #D1D9E6; color: var(--deep); border-radius: 12px; padding: 13px 16px; font-size: 14px; transition: all 0.18s; font-family: inherit; box-shadow: 0 1px 3px rgba(1,20,66,0.05); }
        .field input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(13,64,252,0.1); }
        .field input::placeholder { color: #B0BEC5; }
        .pass-toggle { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94A3B8; font-size: 16px; padding: 4px; transition: color 0.15s; }
        .pass-toggle:hover { color: var(--deep); }
        .error-box { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #dc2626; margin-bottom: 20px; direction: rtl; line-height: 1.6; }
        .step-box { background: rgba(13,64,252,0.05); border: 1px solid rgba(13,64,252,0.15); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: var(--primary); margin-bottom: 20px; }
        .submit-btn { width: 100%; background: var(--primary); color: #fff; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: inherit; box-shadow: 0 4px 16px rgba(13,64,252,0.3); }
        .submit-btn:hover:not(:disabled) { background: #0929b4; transform: translateY(-1px); }
        .submit-btn:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; transform: none; }
        .login-footer { text-align: center; margin-top: 32px; font-size: 12px; color: #94A3B8; }
        .login-footer a { color: var(--primary); text-decoration: none; font-weight: 600; }
      `}</style>

      <div className="page" dir="rtl">
        <div className="page-left">
          <div className="brand-logo">سلوكيرا</div>
          <div className="brand-en">Sulukera</div>
          <div className="brand-tagline">منصة الإشراف الأكاديمي</div>
          <div className="brand-sub">
            بوابة المشرفين الأكاديميين لإدارة الجلسات والمواعيد مع الطلاب
          </div>
          <div className="brand-dots">
            <div className="brand-dot active" />
            <div className="brand-dot" />
            <div className="brand-dot" />
          </div>
        </div>

        <div className="page-right">
          <div className="login-box">
            <div className="login-welcome">
              <h1>{portal === "admin" ? "دخول الإدارة" : "تسجيل الدخول"}</h1>
              <p>
                {portal === "admin"
                  ? "أدخل بيانات حساب الإدارة للوصول إلى لوحة التحكم"
                  : "اختر نوع حسابك ثم أدخل بيانات الدخول"}
              </p>
            </div>

            {portal !== "admin" && (
              <div className="portal-picker" aria-label="نوع الحساب">
                <button
                  type="button"
                  className={`portal-option ${portal === "trainee" ? "active" : ""}`}
                  onClick={() => setPortal("trainee")}
                >
                  حساب المتدرب
                </button>
                <button
                  type="button"
                  className={`portal-option ${portal === "provider" ? "active" : ""}`}
                  onClick={() => setPortal("provider")}
                >
                  المشرف أو المستشار
                </button>
              </div>
            )}
            <p className="portal-hint">
              {portal === "admin"
                ? "هذه الصفحة مخصصة لإدارة منصة سلوكيرا."
                : portal === "trainee"
                  ? "لمتابعة الساعات والخطة الإشرافية والمواعيد."
                  : "لإدارة المتدربين والجلسات والمواعيد المتاحة."}
            </p>

            <form onSubmit={handleLogin}>
              <div className="field">
                <label>البريد الإلكتروني</label>
                <input
                  type="email"
                  placeholder="example@sulukera.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label>كلمة المرور</label>
                <div className="input-wrap">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingLeft: 44 }}
                  />
                  <button
                    type="button"
                    className="pass-toggle"
                    onClick={() => setShowPass((p) => !p)}
                  >
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {step && !error && <div className="step-box">⏳ {step}</div>}
              {error && <div className="error-box">⚠️ {error}</div>}

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? step || "جارٍ الدخول..." : "تسجيل الدخول →"}
              </button>
            </form>

            <div className="login-footer">
              منصة الإشراف الأكاديمي ·{" "}
              <a href="https://sulukera.com" target="_blank">
                سلوكيرا
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
