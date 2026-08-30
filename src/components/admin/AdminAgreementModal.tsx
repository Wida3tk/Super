"use client";

import { useEffect, useState } from "react";

export default function AdminAgreementModal({
  trainee,
  onClose,
}: {
  trainee: any;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    signedAt: "",
    effectiveFrom: "",
    durationMonths: 18,
    financialTermMonths: 12,
    plannedSupervisionHours: 75,
    carriedSupervisionHours: 0,
    noticeDays: 30,
    status: "draft",
    notes: "",
  });
  const [termination, setTermination] = useState({ endDate: "", reason: "" });
  useEffect(() => {
    fetch(
      `/api/admin/supervision-agreement?traineeId=${encodeURIComponent(trainee.id)}`,
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.agreement)
          setForm((current: any) => ({ ...current, ...data.agreement }));
        setAssignments(data.assignments || []);
      })
      .finally(() => setLoading(false));
  }, [trainee.id]);
  const set = (key: string, value: any) =>
    setForm((current: any) => ({ ...current, [key]: value }));
  async function saveAgreement() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/supervision-agreement", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId: trainee.id, ...form }),
    });
    setMessage(
      response.ok ? "تم حفظ بطاقة الاتفاقية." : "تعذر الحفظ؛ تحققي من الحقول.",
    );
    setSaving(false);
  }
  async function terminate() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/supervision-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "terminate",
        traineeId: trainee.id,
        ...termination,
      }),
    });
    if (response.ok) {
      setMessage("تم إنهاء العلاقة وأرشفة الإسناد.");
      setTimeout(() => window.location.reload(), 900);
    } else setMessage("أدخلي تاريخ الإنهاء وسببًا واضحًا.");
    setSaving(false);
  }
  return (
    <div
      className="aam-overlay"
      dir="rtl"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <style>{css}</style>
      <div className="aam-modal">
        <header>
          <div>
            <h2>إدارة الاتفاقية والإسناد</h2>
            <p>
              {trainee.name} · {trainee.email}
            </p>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        {loading ? (
          <div className="aam-loading">جارٍ تحميل الملف...</div>
        ) : (
          <div className="aam-body">
            <section>
              <h3>بطاقة اتفاقية الإشراف</h3>
              <div className="aam-grid">
                <Field label="تاريخ التوقيع">
                  <input
                    type="date"
                    value={form.signedAt}
                    onChange={(e) => set("signedAt", e.target.value)}
                  />
                </Field>
                <Field label="بداية السريان">
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => set("effectiveFrom", e.target.value)}
                  />
                </Field>
                <Field label="مدة الاتفاقية">
                  <input
                    type="number"
                    value={form.durationMonths}
                    onChange={(e) =>
                      set("durationMonths", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="مدة الخطة المالية">
                  <input
                    type="number"
                    value={form.financialTermMonths}
                    onChange={(e) =>
                      set("financialTermMonths", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="ساعات الإشراف">
                  <input
                    type="number"
                    step=".5"
                    value={form.plannedSupervisionHours}
                    onChange={(e) =>
                      set("plannedSupervisionHours", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="الساعات المرحلة">
                  <input
                    type="number"
                    step=".5"
                    value={form.carriedSupervisionHours}
                    onChange={(e) =>
                      set("carriedSupervisionHours", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="مهلة الإشعار">
                  <input
                    type="number"
                    value={form.noticeDays}
                    onChange={(e) => set("noticeDays", Number(e.target.value))}
                  />
                </Field>
                <Field label="الحالة">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    <option value="draft">مسودة</option>
                    <option value="active">سارية</option>
                    <option value="paused">معلقة</option>
                    <option value="completed">مكتملة</option>
                    <option value="terminated">منتهية</option>
                  </select>
                </Field>
              </div>
              <Field label="ملاحظات">
                <textarea
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
              <button
                className="aam-primary"
                disabled={saving}
                onClick={saveAgreement}
              >
                حفظ الاتفاقية
              </button>
            </section>
            <section>
              <h3>سجل الإسناد</h3>
              <div className="aam-history">
                {assignments.map((item) => (
                  <article key={item.id}>
                    <b>{item.supervisorName}</b>
                    <span>
                      {item.startDate} — {item.endDate || "مستمر"}
                    </span>
                    {item.hoursAtTransfer !== undefined && (
                      <small>{item.hoursAtTransfer} ساعة عند النقل</small>
                    )}
                  </article>
                ))}
                {!assignments.length && <p>لا يوجد سجل إسناد.</p>}
              </div>
              <div className="aam-danger">
                <h3>إنهاء العلاقة الإشرافية</h3>
                <p>
                  إجراء إداري نهائي يغلق الإسناد ويحدث حالة الاتفاقية والمتدرب.
                </p>
                <input
                  type="date"
                  value={termination.endDate}
                  onChange={(e) =>
                    setTermination({ ...termination, endDate: e.target.value })
                  }
                />
                <textarea
                  placeholder="سبب الإنهاء"
                  value={termination.reason}
                  onChange={(e) =>
                    setTermination({ ...termination, reason: e.target.value })
                  }
                />
                <button disabled={saving} onClick={terminate}>
                  اعتماد الإنهاء
                </button>
              </div>
            </section>
          </div>
        )}
        {message && <div className="aam-message">{message}</div>}
      </div>
    </div>
  );
}
function Field({ label, children }: any) {
  return (
    <label className="aam-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const css = `.aam-overlay{position:fixed;inset:0;z-index:1200;background:#00144288;display:grid;place-items:center;padding:16px}.aam-modal{width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px #00144244}.aam-modal>header{position:sticky;top:0;z-index:2;background:#001442;color:#fff;padding:16px 20px;display:flex;justify-content:space-between}.aam-modal h2{font-size:17px;margin:0}.aam-modal header p{font-size:11px;color:#b9c9eb;margin:3px 0 0}.aam-modal header button{border:0;background:#ffffff18;color:#fff;border-radius:8px;width:32px;height:32px;font-size:20px}.aam-body{display:grid;grid-template-columns:1.25fr .75fr;gap:14px;padding:16px}.aam-body section{border:1px solid #e2e8f0;border-radius:13px;padding:14px}.aam-body h3{font-size:14px;margin:0 0 12px}.aam-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.aam-field span{display:block;font-size:11px;color:#64748b;margin-bottom:4px}.aam-field input,.aam-field select,.aam-field textarea,.aam-danger input,.aam-danger textarea{width:100%;border:1px solid #d8e0ea;border-radius:8px;padding:8px;font:inherit;font-size:12px;margin-bottom:9px}.aam-field textarea,.aam-danger textarea{min-height:70px}.aam-primary{border:0;background:#0d40fc;color:#fff;border-radius:8px;padding:9px 14px;font-weight:700}.aam-history{display:grid;gap:7px}.aam-history article{display:grid;gap:3px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:9px;font-size:11px}.aam-history span,.aam-history small{color:#64748b}.aam-danger{margin-top:14px;background:#fff7f7;border:1px solid #fecaca;border-radius:11px;padding:12px}.aam-danger h3{color:#991b1b}.aam-danger p{font-size:11px;color:#64748b}.aam-danger button{border:0;background:#b91c1c;color:#fff;border-radius:8px;padding:8px 12px}.aam-message{margin:0 16px 16px;padding:9px;background:#eff6ff;border-radius:8px;font-size:12px}.aam-loading{padding:40px;text-align:center;color:#64748b}@media(max-width:760px){.aam-body,.aam-grid{grid-template-columns:1fr}}`;
