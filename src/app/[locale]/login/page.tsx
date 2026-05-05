'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage({ params }: { params: { locale: string } }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        setError('فشل إنشاء الجلسة، حاول مرة أخرى');
        setLoading(false);
        return;
      }

      const sessionData = await res.json().catch(() => ({}));
      const isAdmin = sessionData.isAdmin || false;

      window.location.href = isAdmin ? '/ar/admin' : '/ar/supervisor-dashboard';
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else {
        setError('حدث خطأ، حاول مرة أخرى');
      }
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
        :root { --primary: #0D40FC; --deep: #001442; --neon: #55D7FF; }

        body { background: var(--deep); direction: rtl; min-height: 100vh; }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 480px;
        }
        @media(max-width: 900px) { .page { grid-template-columns: 1fr; } .page-left { display: none; } }

        /* LEFT SIDE — BRAND */
        .page-left {
          background: linear-gradient(150deg, #020716 0%, #001442 50%, #0D2080 100%);
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          padding: 60px; position: relative; overflow: hidden;
        }
        .page-left::before {
          content: '';
          position: absolute; top: -200px; left: -200px;
          width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(13,64,252,0.15) 0%, transparent 70%);
        }
        .page-left::after {
          content: '';
          position: absolute; bottom: -150px; right: -150px;
          width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(85,215,255,0.08) 0%, transparent 70%);
        }
        .brand-logo {
          font-size: 52px; font-weight: 900;
          color: var(--primary);
          letter-spacing: -2px;
          margin-bottom: 8px;
          position: relative; z-index: 1;
        }
        .brand-en {
          font-size: 14px; font-weight: 600;
          color: var(--neon); letter-spacing: 0.25em;
          text-transform: uppercase; opacity: 0.7;
          margin-bottom: 48px; position: relative; z-index: 1;
        }
        .brand-tagline {
          font-size: 26px; font-weight: 700; color: #fff;
          text-align: center; line-height: 1.5;
          margin-bottom: 16px; position: relative; z-index: 1;
        }
        .brand-sub {
          font-size: 14px; color: rgba(255,255,255,0.45);
          text-align: center; line-height: 1.7;
          max-width: 320px; position: relative; z-index: 1;
        }
        .brand-dots {
          display: flex; gap: 8px; margin-top: 48px;
          position: relative; z-index: 1;
        }
        .brand-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
        }
        .brand-dot.active { background: var(--primary); width: 24px; border-radius: 4px; }

        /* RIGHT SIDE — FORM */
        .page-right {
          background: #F8FAFC;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          padding: 48px 40px;
          min-height: 100vh;
        }

        .login-box { width: 100%; max-width: 380px; }

        .login-welcome {
          margin-bottom: 36px;
        }
        .login-welcome h1 {
          font-size: 28px; font-weight: 800;
          color: var(--deep); margin-bottom: 6px;
        }
        .login-welcome p {
          font-size: 14px; color: #8898AA;
        }

        .field { margin-bottom: 20px; }
        .field label {
          display: block; font-size: 12px; font-weight: 700;
          color: #8898AA; margin-bottom: 8px; letter-spacing: 0.04em;
        }

        .input-wrap { position: relative; }
        .field input {
          width: 100%; background: #fff;
          border: 1.5px solid #D1D9E6; color: var(--deep);
          border-radius: 12px; padding: 13px 16px;
          font-size: 14px; transition: all 0.18s;
          font-family: inherit; direction: ltr; text-align: right;
          box-shadow: 0 1px 3px rgba(1,20,66,0.05);
        }
        .field input[type="email"] { direction: ltr; text-align: left; }
        .field input:focus {
          outline: none; border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(13,64,252,0.1);
        }
        .field input::placeholder { color: #B0BEC5; }

        .pass-toggle {
          position: absolute; left: 14px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #94A3B8; font-size: 16px; padding: 4px;
          transition: color 0.15s;
        }
        .pass-toggle:hover { color: var(--deep); }

        .error-box {
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; padding: 12px 14px;
          font-size: 13px; color: #dc2626;
          margin-bottom: 20px;
          display: flex; align-items: center; gap: 8px;
        }

        .submit-btn {
          width: 100%; background: var(--primary); color: #fff;
          border: none; border-radius: 12px; padding: 15px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; font-family: inherit;
          box-shadow: 0 4px 16px rgba(13,64,252,0.3);
        }
        .submit-btn:hover:not(:disabled) {
          background: #0929b4;
          box-shadow: 0 6px 24px rgba(13,64,252,0.4);
          transform: translateY(-1px);
        }
        .submit-btn:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; transform: none; }

        .login-footer {
          text-align: center; margin-top: 32px;
          font-size: 12px; color: #94A3B8;
        }
        .login-footer a { color: var(--primary); text-decoration: none; font-weight: 600; }

        .loading-dots::after {
          content: ''; animation: dots 1.2s infinite;
        }
        @keyframes dots {
          0%{content:'.'} 33%{content:'..'} 66%{content:'...'} 100%{content:''}
        }
      `}</style>

      <div className="page" dir="rtl">

        {/* LEFT — BRAND */}
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

        {/* RIGHT — FORM */}
        <div className="page-right">
          <div className="login-box">
            <div className="login-welcome">
              <h1>تسجيل الدخول</h1>
              <p>أدخل بياناتك للوصول إلى لوحتك</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="field">
                <label>البريد الإلكتروني</label>
                <input
                  type="email"
                  placeholder="example@sulukera.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="field">
                <label>كلمة المرور</label>
                <div className="input-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingLeft: 44 }}
                  />
                  <button
                    type="button"
                    className="pass-toggle"
                    onClick={() => setShowPass(p => !p)}
                  >
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-box">
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? <span className="loading-dots">جارٍ الدخول</span> : 'تسجيل الدخول →'}
              </button>
            </form>

            <div className="login-footer">
              منصة الإشراف الأكاديمي · <a href="https://sulukera.com" target="_blank">سلوكيرا</a>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
