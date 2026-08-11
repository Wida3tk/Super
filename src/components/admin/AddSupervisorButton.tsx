"use client";

import { useState } from "react";

export default function AddSupervisorButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    bio: "",
    accountType: "supervisor",
  });

  const reset = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      bio: "",
      accountType: "supervisor",
    });
    setMsg("");
    setIsError(false);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setIsError(false);

    try {
      const res = await fetch("/api/admin/create-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.success) {
        setMsg(`✅ تم إنشاء حساب المشرف "${form.name}" بنجاح!`);
        setIsError(false);
        setForm({
          name: "",
          email: "",
          password: "",
          bio: "",
          accountType: "supervisor",
        });
        setTimeout(() => {
          close();
          window.location.reload();
        }, 1800);
      } else {
        setIsError(true);
        const errMap: Record<string, string> = {
          EMAIL_EXISTS: "البريد الإلكتروني مسجل مسبقاً",
          MISSING_FIELDS: "يرجى تعبئة جميع الحقول المطلوبة",
          SERVER_ERROR: "حدث خطأ، حاولي مرة أخرى",
        };
        setMsg(errMap[data.error] ?? data.error);
      }
    } catch {
      setIsError(true);
      setMsg("حدث خطأ في الاتصال");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        .add-btn {
          display: inline-flex; align-items: center; gap: 7px;
          background: #0D40FC; color: #fff; border: none;
          font-size: 13px; font-weight: 700;
          padding: 9px 20px; border-radius: 10px;
          cursor: pointer; transition: all 0.18s;
          box-shadow: 0 2px 8px rgba(13,64,252,0.25);
          font-family: inherit;
        }
        .add-btn:hover { background: #0929b4; transform: translateY(-1px); box-shadow: 0 5px 16px rgba(13,64,252,0.35); }

        .overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,20,66,0.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: fadeIn 0.18s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal {
          background: #fff; border-radius: 24px;
          width: 100%; max-width: 480px;
          box-shadow: 0 24px 64px rgba(1,20,66,0.22);
          overflow: hidden;
          animation: slideUp 0.22s ease;
        }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

        .modal-head {
          background: linear-gradient(135deg, #0D40FC, #001442);
          padding: 24px 28px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .modal-head-left { display: flex; align-items: center; gap: 12px; }
        .modal-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }
        .modal-title { color: #fff; font-size: 17px; font-weight: 700; }
        .modal-sub { color: rgba(255,255,255,0.6); font-size: 12px; margin-top: 2px; }
        .modal-close {
          background: rgba(255,255,255,0.1); border: none;
          width: 32px; height: 32px; border-radius: 8px;
          color: rgba(255,255,255,0.7); font-size: 18px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .modal-close:hover { background: rgba(255,255,255,0.2); color: #fff; }

        .modal-body { padding: 28px; }

        .field { margin-bottom: 18px; }
        .field label {
          display: block; font-size: 12px; font-weight: 700;
          color: #8898AA; margin-bottom: 7px; letter-spacing: 0.04em;
        }
        .field label span { color: #EF4444; margin-right: 2px; }
        .field input {
          width: 100%; background: #F8FAFC;
          border: 1.5px solid #D1D9E6; color: #001442;
          border-radius: 10px; padding: 11px 14px;
          font-size: 14px; transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit; direction: rtl;
        }
        .field input:focus {
          outline: none; border-color: #0D40FC;
          box-shadow: 0 0 0 3px rgba(13,64,252,0.08);
          background: #fff;
        }
        .field input::placeholder { color: #B0BEC5; }

        .pass-hint {
          font-size: 11px; color: #94A3B8;
          margin-top: 5px;
        }

        .modal-msg {
          padding: 11px 14px; border-radius: 10px;
          font-size: 13px; font-weight: 500;
          margin-bottom: 18px;
        }
        .modal-msg.ok { background: rgba(16,185,129,0.08); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .modal-msg.err { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }

        .modal-footer {
          display: flex; gap: 10px;
          padding: 0 28px 28px;
        }
        .btn-cancel {
          flex: 1; background: #F1F5F9; color: #4A5568;
          border: none; border-radius: 12px; padding: 13px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          transition: background 0.15s; font-family: inherit;
        }
        .btn-cancel:hover { background: #E2E8F0; }
        .btn-submit {
          flex: 2; background: #0D40FC; color: #fff;
          border: none; border-radius: 12px; padding: 13px;
          font-size: 14px; font-weight: 700; cursor: pointer;
          transition: all 0.18s; font-family: inherit;
          box-shadow: 0 2px 8px rgba(13,64,252,0.25);
        }
        .btn-submit:hover:not(:disabled) { background: #0929b4; box-shadow: 0 5px 16px rgba(13,64,252,0.35); }
        .btn-submit:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; }
      `}</style>

      <button className="add-btn" onClick={() => setOpen(true)}>
        ＋ إضافة مشرف
      </button>

      {open && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="modal" dir="rtl">
            <div className="modal-head">
              <div className="modal-head-left">
                <div className="modal-icon">👨‍🏫</div>
                <div>
                  <div className="modal-title">إضافة مشرف جديد</div>
                  <div className="modal-sub">
                    سيتمكن من تسجيل الدخول وإدارة مواعيده
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={close}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="field">
                  <label>
                    نوع الحساب <span>*</span>
                  </label>
                  <select
                    value={form.accountType}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, accountType: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: 11,
                      border: "1.5px solid #D1D9E6",
                      borderRadius: 10,
                      fontFamily: "inherit",
                    }}
                  >
                    <option value="supervisor">
                      مشرف — للمقابلات الأولية والإشراف
                    </option>
                    <option value="consultant">
                      مستشار — للاستشارات المهنية
                    </option>
                  </select>
                </div>
                <div className="field">
                  <label>
                    الاسم الكامل <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="د. أحمد المنصوري"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label>
                    البريد الإلكتروني <span>*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="supervisor@sulukera.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label>
                    كلمة المرور <span>*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="8 أحرف على الأقل"
                    value={form.password}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, password: e.target.value }))
                    }
                    minLength={8}
                    required
                  />
                  <div className="pass-hint">
                    شاركها مع المشرف، يمكنه تغييرها لاحقاً
                  </div>
                </div>
                <div className="field">
                  <label>نبذة مختصرة (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مشرف تحليل السلوك التطبيقي"
                    value={form.bio}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, bio: e.target.value }))
                    }
                  />
                </div>

                {msg && (
                  <div className={`modal-msg ${isError ? "err" : "ok"}`}>
                    {msg}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={close}>
                  إلغاء
                </button>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? "⏳ جارٍ الإنشاء..." : "✓ إنشاء الحساب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
