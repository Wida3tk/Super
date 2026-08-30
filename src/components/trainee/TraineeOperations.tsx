"use client";

import { FormEvent, useState } from "react";

const typeLabel: Record<string, string> = {
  defer: "طلب تأجيل الإشراف",
  withdraw: "طلب انسحاب",
  change_supervisor: "طلب تغيير المشرف",
};
const statusLabel: Record<string, string> = {
  pending: "بانتظار مراجعة الإدارة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};
const absenceLabel: Record<string, string> = {
  health: "ظرف صحي",
  emergency: "ظرف طارئ",
  notified_absence: "غياب بإشعار مسبق",
  unnotified_absence: "غياب دون إشعار",
  trainee_postpone: "تأجيل بطلب المتدرب",
  other: "أخرى",
};
const warningLabel: Record<string, string> = {
  repeated_absence: "تكرار الغياب",
  late_attendance: "عدم الالتزام بالمواعيد",
  late_documents: "تأخر المستندات",
  policy_violation: "مخالفة السياسات",
  other: "أخرى",
};

export function AttendanceRecord({ sessions }: { sessions: any[] }) {
  const absences = sessions.filter((s) => s.type === "absence");
  const warnings = sessions.filter((s) => s.type === "warning");
  return (
    <section className="ops">
      <style>{css}</style>
      <div className="ops-summary">
        <div>
          <span>إجمالي الغياب</span>
          <b>{absences.length}</b>
        </div>
        <div>
          <span>إجمالي الإنذارات</span>
          <b>{warnings.length}</b>
        </div>
        <p>
          يسجل المشرف الغياب أو الإنذار عند عدم الحضور، وتظهر التفاصيل هنا
          للمتابعة والشفافية.
        </p>
      </div>
      <div className="ops-card">
        <h3>سجل الغياب والإنذارات</h3>
        {!sessions.length ? (
          <div className="ops-empty">لا يوجد غياب أو إنذارات مسجلة.</div>
        ) : (
          <div className="ops-list">
            {sessions.map((s) => (
              <article key={s.id}>
                <span className={`ops-badge ${s.type}`}>
                  {s.type === "absence" ? "غياب" : "إنذار"}
                </span>
                <div>
                  <b>
                    {s.type === "absence"
                      ? absenceLabel[s.absenceReason] || "غياب"
                      : warningLabel[s.warningReason] || "إنذار"}
                  </b>
                  <small>
                    {s.date}
                    {s.scheduledTime ? ` · الموعد ${s.scheduledTime}` : ""}
                    {s.noticeHours !== null && s.noticeHours !== undefined
                      ? ` · الإشعار قبل ${s.noticeHours} ساعة`
                      : ""}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </small>
                  {s.type === "absence" && (
                    <small>
                      {s.timelyNotice
                        ? "اعتذار ضمن المهلة"
                        : "اعتذار متأخر أو دون إشعار"}
                      {s.billingStatus === "billable"
                        ? " · محتسبة ماليًا"
                        : s.billingStatus === "not_billable"
                          ? " · غير محتسبة ماليًا"
                          : " · القرار المالي قيد المراجعة"}
                    </small>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function TraineeRequests({
  initialRequests,
}: {
  initialRequests: any[];
}) {
  const [items, setItems] = useState(initialRequests);
  const [form, setForm] = useState({
    type: "defer",
    reason: "",
    startDate: "",
    returnDate: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const r = await fetch("/api/trainee/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      setItems((current) => [data.request, ...current]);
      setForm((current) => ({
        ...current,
        reason: "",
        startDate: "",
        returnDate: "",
      }));
      setMessage("تم رفع الطلب إلى الإدارة.");
    } else
      setMessage(
        data.error === "PENDING_EXISTS"
          ? "يوجد طلب من النوع نفسه بانتظار المراجعة."
          : data.error === "INVALID_DATES"
            ? "تحقق من تاريخ بداية التأجيل والعودة."
            : data.error === "NOTICE_TOO_SHORT"
              ? "يجب تقديم طلب التأجيل قبل بدايته بـ14 يومًا على الأقل."
              : data.error === "DEFER_TOO_LONG"
                ? "مدة التأجيل لا يمكن أن تتجاوز 30 يومًا."
                : "أكمل بيانات الطلب وسببًا واضحًا.",
      );
    setSaving(false);
  }
  return (
    <section className="ops">
      <style>{css}</style>
      <div className="request-grid">
        <form className="ops-card" onSubmit={submit}>
          <h3>رفع طلب للإدارة</h3>
          <label>
            نوع الطلب
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(typeLabel).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {form.type === "defer" && (
            <div className="date-grid">
              <label>
                بداية التأجيل
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                تاريخ العودة المقترح
                <input
                  type="date"
                  value={form.returnDate}
                  onChange={(e) =>
                    setForm({ ...form, returnDate: e.target.value })
                  }
                  required
                />
              </label>
            </div>
          )}
          {form.type === "defer" && (
            <p className="ops-note">
              يقدم الطلب قبل 14 يومًا على الأقل، ولمدة لا تتجاوز 30 يومًا.
              اعتماد الطلب من الإدارة فقط.
            </p>
          )}
          <label>
            سبب الطلب
            <textarea
              minLength={10}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="اكتب السبب والتفاصيل التي تساعد الإدارة على مراجعة الطلب"
              required
            />
          </label>
          {message && <div className="ops-message">{message}</div>}
          <button className="ops-primary" disabled={saving}>
            {saving ? "جاري الرفع..." : "إرسال الطلب"}
          </button>
        </form>
        <div className="ops-card">
          <h3>طلباتي السابقة</h3>
          {!items.length ? (
            <div className="ops-empty">لم ترفع أي طلبات بعد.</div>
          ) : (
            <div className="ops-list">
              {items.map((item) => (
                <article key={item.id}>
                  <span className={`ops-badge ${item.status}`}>
                    {statusLabel[item.status]}
                  </span>
                  <div>
                    <b>{typeLabel[item.type]}</b>
                    <small>
                      {item.createdAt?.slice(0, 10)}
                      {item.adminNote ? ` · رد الإدارة: ${item.adminNote}` : ""}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function FinancialPlan({ plan }: { plan: any }) {
  if (!plan)
    return (
      <section className="ops">
        <style>{css}</style>
        <div className="finance-empty">
          <div>◫</div>
          <h3>الخطة المالية</h3>
          <p>
            لم تتم إضافة خطة مالية إلى ملفك بعد. ستظهر هنا تلقائيًا عند اعتمادها
            وربطها بنظام العمليات.
          </p>
          <span>
            للاطلاع فقط · لا يمكن تعديل البيانات المالية من حساب المتدرب
          </span>
        </div>
      </section>
    );
  const installments = plan.installments || [];
  const total = Number(plan.totalAmount || 0),
    paid = Number(plan.paidAmount || 0),
    balance = Math.max(0, total - paid);
  const money = (n: number) =>
    `${n.toLocaleString("ar-JO")} ${plan.currency || "ر.س"}`;
  return (
    <section className="ops">
      <style>{css}</style>
      <div className="finance-head">
        <div>
          <span>إجمالي الخطة</span>
          <b>{money(total)}</b>
        </div>
        <div>
          <span>المدفوع</span>
          <b>{money(paid)}</b>
        </div>
        <div>
          <span>المتبقي</span>
          <b>{money(balance)}</b>
        </div>
      </div>
      <div className="ops-card">
        <div className="finance-title">
          <h3>جدول الأقساط</h3>
          <small>
            آخر تحديث: {plan.syncedAt?.slice(0, 16).replace("T", " ") || "—"}
          </small>
        </div>
        <div className="installments">
          {installments.map((x: any, i: number) => (
            <article key={x.id || i}>
              <b>{x.title || `القسط ${i + 1}`}</b>
              <span>{money(Number(x.amount || 0))}</span>
              <span>{x.dueDate || "—"}</span>
              <em className={x.status}>
                {x.status === "paid"
                  ? "مدفوع"
                  : x.status === "overdue"
                    ? "متأخر"
                    : x.status === "cancelled"
                      ? "ملغي"
                      : "مستحق"}
              </em>
            </article>
          ))}
        </div>
      </div>
      <div className="finance-note">
        هذه البيانات للعرض فقط ويتم تحديثها من نظام العمليات. للاستفسار تواصل مع
        الإدارة المالية.
      </div>
    </section>
  );
}

const css = `.ops{color:#001442}.ops-card,.finance-empty{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:19px}.ops-card h3{margin:0 0 15px}.ops-summary,.finance-head{display:grid;grid-template-columns:180px 180px 1fr;gap:12px;margin-bottom:14px}.ops-summary>div,.finance-head>div{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:15px}.ops-summary span,.finance-head span{display:block;color:#718096;font-size:11px}.ops-summary b,.finance-head b{display:block;font-size:24px;margin-top:5px}.ops-summary p{background:#eef4ff;color:#31508c;border-radius:14px;padding:15px;font-size:12px;line-height:1.8}.ops-list{display:grid;gap:8px}.ops-list article{display:flex;align-items:center;gap:12px;border:1px solid #edf1f6;border-radius:11px;padding:11px}.ops-list article div{flex:1}.ops-list b{display:block;font-size:13px}.ops-list small{display:block;color:#718096;margin-top:3px}.ops-badge{font-size:10px;padding:4px 8px;border-radius:99px;background:#fff7ed;color:#9a3412}.ops-badge.warning,.ops-badge.rejected{background:#fef2f2;color:#b91c1c}.ops-badge.approved{background:#ecfdf5;color:#047857}.ops-badge.pending{background:#eef4ff;color:#0d40fc}.request-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ops label{display:block;font-size:12px;color:#64748b;margin-top:12px}.ops input,.ops select,.ops textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #d8dfeb;border-radius:9px;font:inherit}.ops textarea{min-height:100px;resize:vertical}.date-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ops-primary{border:0;background:#0d40fc;color:#fff;border-radius:9px;padding:10px 16px;font-weight:700;margin-top:13px}.ops-message,.finance-note{background:#eff8ff;color:#075985;border-radius:9px;padding:10px;margin-top:12px;font-size:12px}.ops-empty{text-align:center;color:#8898aa;padding:30px;font-size:12px}.finance-empty{text-align:center;padding:45px}.finance-empty>div{font-size:35px;color:#0d40fc}.finance-empty p{color:#718096;max-width:520px;margin:8px auto;line-height:1.8}.finance-empty span{font-size:11px;color:#94a3b8}.finance-title{display:flex;justify-content:space-between;align-items:center}.finance-title small{color:#8898aa}.installments article{display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:10px;padding:12px;border-top:1px solid #edf1f6;font-size:12px}.installments em{font-style:normal;padding:3px 8px;border-radius:99px;background:#fff7ed;color:#9a3412}.installments em.paid{background:#ecfdf5;color:#047857}.installments em.overdue{background:#fef2f2;color:#b91c1c}@media(max-width:800px){.ops-summary,.finance-head,.request-grid{grid-template-columns:1fr}.date-grid{grid-template-columns:1fr}.installments article{grid-template-columns:1fr 1fr}.ops-summary p{margin:0}}`;
