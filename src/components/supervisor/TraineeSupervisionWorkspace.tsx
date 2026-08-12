"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCompliance } from "@/lib/qaba/compliance";

const competencyGroups = [
  {
    domain: "مهارات ما قبل التطبيق",
    items: [
      "التحفيز التشغيلي والاقتران",
      "التقييمات واعتبارات استخدامها",
      "السلوك اللفظي والتدريب على الطلب والتسمية",
      "التقليد والاستجابة السمعية",
    ],
  },
  {
    domain: "اكتساب المهارات",
    items: [
      "إعداد خطة اكتساب المهارة",
      "التدريب في البيئة الطبيعية NET",
      "التدريب بالمحاولات المنفصلة DTT",
      "التلقين وتلاشي التلقين وتصحيح الخطأ",
      "تحليل المهمة والمهارات الاجتماعية",
    ],
  },
  {
    domain: "التدخل السلوكي",
    items: [
      "التعريف الإجرائي وABC ووظائف السلوك",
      "القياس المستمر وغير المستمر",
      "إعداد وتنفيذ خطة التدخل السلوكي",
      "التواصل الوظيفي والتعزيز",
      "الإطفاء وإجراءات الطوارئ",
    ],
  },
  {
    domain: "التعميم والاستدامة",
    items: [
      "تعميم المثير والاستجابة",
      "تطبيق إجراءات التعميم",
      "المحافظة على الاستجابة",
    ],
  },
];
const docTypes: Record<string, string> = {
  contract: "عقد الإشراف",
  guardian_consent: "موافقة ولي الأمر",
  center_approval: "موافقة المركز",
  observation_consent: "موافقة الملاحظة",
  video_consent: "موافقة الاتصال المرئي",
  data_consent: "موافقة الاطلاع على البيانات",
  supervisor_credential: "اعتماد المشرف",
  coursework: "إثبات المقررات",
  background_check: "فحص الخلفية",
  recommendation: "التوصية المهنية",
  final_verification: "التحقق النهائي",
  other: "مستند آخر",
};
const statusLabel: Record<string, string> = {
  not_started: "لم يبدأ",
  in_progress: "قيد التنفيذ",
  achieved: "متحقق",
  retrain: "يحتاج إعادة تدريب",
};

export default function TraineeSupervisionWorkspace({
  trainees,
  supervisor,
}: {
  trainees: any[];
  supervisor?: any;
}) {
  const [traineeId, setTraineeId] = useState(trainees[0]?.id || "");
  const trainee = trainees.find((t) => t.id === traineeId);
  const [tab, setTab] = useState<
    "overview" | "documents" | "meetings" | "assessment" | "plan"
  >("overview");
  const [data, setData] = useState<any>({
    documents: [],
    meetings: [],
    assessments: [],
    plan: { goals: [] },
    activities: [],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = async () => {
    if (!traineeId) return;
    setLoading(true);
    const r = await fetch(
      `/api/supervisor/trainee-workspace?traineeId=${traineeId}`,
    );
    setData(await r.json());
    setLoading(false);
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traineeId]);
  const compliance = useMemo(
    () =>
      buildCompliance(
        data.activities || [],
        trainee?.license || "QASP-S",
        trainee?.fieldworkStartDate,
      ),
    [data.activities, trainee],
  );
  const latestAssessment = data.assessments?.[0];
  const assessmentPct = latestAssessment?.maxScore
    ? (latestAssessment.totalScore / latestAssessment.maxScore) * 100
    : 0;
  const save = async (payload: any, method = "POST") => {
    setMessage("جارٍ الحفظ...");
    const r = await fetch("/api/supervisor/trainee-workspace", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId, ...payload }),
    });
    if (!r.ok) {
      setMessage("تعذر الحفظ، تحقق من الحقول");
      return false;
    }
    setMessage("تم الحفظ بنجاح");
    await refresh();
    return true;
  };
  if (!trainees.length)
    return (
      <div className="ws-empty">لا يوجد متدربون مُسندون إلى حسابك حاليًا.</div>
    );
  return (
    <div className="ws" dir="rtl">
      <style>{css}</style>
      <div className="ws-toolbar">
        <div>
          <h2>ملف الإشراف المتكامل</h2>
          <p>
            الساعات، الموافقات، المحاضر، الكفاءة والخطة في سجل واحد ·{" "}
            {supervisor?.credentialType ||
              "بيانات اعتماد المشرف تحتاج استكمالًا"}
            {supervisor?.credentialNumber
              ? ` (${supervisor.credentialNumber})`
              : ""}
          </p>
        </div>
        <div className="ws-actions">
          <select
            value={traineeId}
            onChange={(e) => setTraineeId(e.target.value)}
          >
            {trainees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.license}
              </option>
            ))}
          </select>
          <a
            className="export"
            href={`/api/supervisor/trainee-export?traineeId=${traineeId}`}
          >
            تصدير قالب سلوكيرا ↧
          </a>
        </div>
      </div>
      <div className="ws-tabs">
        {[
          ["overview", "الملخص والامتثال"],
          ["documents", "الموافقات والمستندات"],
          ["meetings", "الجلسات والمحاضر"],
          ["assessment", "تقييم الكفاءة"],
          ["plan", "خطة الإشراف"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k as any)}
          >
            {l}
          </button>
        ))}
      </div>
      {message && <div className="toast">{message}</div>}
      {loading ? (
        <div className="loading">جارٍ تحميل ملف المتدرب...</div>
      ) : (
        <>
          {tab === "overview" && (
            <Overview
              trainee={trainee}
              compliance={compliance}
              documents={data.documents}
              meetings={data.meetings}
              assessmentPct={assessmentPct}
              latestAssessment={latestAssessment}
              plan={data.plan}
            />
          )}
          {tab === "documents" && (
            <Documents
              traineeId={traineeId}
              items={data.documents}
              onSave={save}
            />
          )}
          {tab === "meetings" && (
            <Meetings
              items={data.meetings}
              goals={data.plan?.goals || []}
              onSave={save}
            />
          )}
          {tab === "assessment" && (
            <Assessment items={data.assessments} onSave={save} />
          )}
          {tab === "plan" && <Plan plan={data.plan} onSave={save} />}
        </>
      )}
    </div>
  );
}

function Overview({
  trainee,
  compliance,
  documents,
  meetings,
  assessmentPct,
  latestAssessment,
  plan,
}: any) {
  const pct = Math.min(
    100,
    (compliance.fieldwork / compliance.rules.total) * 100,
  );
  const current = compliance.months.find(
    (m: any) => m.month === new Date().toISOString().slice(0, 7),
  );
  const validDocs = documents.filter((d: any) =>
    ["reviewed", "valid"].includes(d.status),
  ).length;
  const docTypeSet = new Set(
    documents
      .filter((d: any) => ["reviewed", "valid"].includes(d.status))
      .map((d: any) => d.type),
  );
  const readinessChecks = [
    {
      label: `إكمال ${compliance.rules.total} ساعة`,
      ok: compliance.fieldwork >= compliance.rules.total,
    },
    {
      label: `المباشر لا يتجاوز ${compliance.rules.maxDirect}`,
      ok: compliance.direct <= compliance.rules.maxDirect,
    },
    {
      label: `غير المباشر ${compliance.rules.minIndirect} على الأقل`,
      ok: compliance.indirect >= compliance.rules.minIndirect,
    },
    { label: "عقد الإشراف مراجع", ok: docTypeSet.has("contract") },
    { label: "نموذج التحقق النهائي", ok: docTypeSet.has("final_verification") },
    { label: "خطة إشراف موثقة", ok: Boolean(plan?.goals?.length) },
  ];
  return (
    <>
      <div className="hero">
        <div>
          <span>{trainee.license} · ملف خاضع لاعتماد المشرف</span>
          <h3>{trainee.name}</h3>
          <p>التقدم مبني على الساعات التي راجعها واعتمدها المشرف فقط.</p>
        </div>
        <div className="ring" style={{ "--p": `${pct * 3.6}deg` } as any}>
          <b>{pct.toFixed(0)}%</b>
          <small>
            {compliance.fieldwork.toFixed(1)} / {compliance.rules.total}
          </small>
        </div>
      </div>
      <div className="metric-grid">
        {[
          ["مباشرة", compliance.direct, compliance.rules.maxDirect],
          ["غير مباشرة", compliance.indirect, compliance.rules.minIndirect],
          ["إشراف", compliance.supervision, compliance.fieldwork * 0.05],
          ["تقييم الكفاءة", assessmentPct, 100],
        ].map(([l, v, t]) => (
          <div className="metric" key={String(l)}>
            <span>{l}</span>
            <b>
              {Number(v).toFixed(1)}
              {l === "تقييم الكفاءة" ? "%" : " س"}
            </b>
            <div className="mini">
              <i
                style={{
                  width: `${Math.min(100, (Number(v) / Number(t)) * 100)}%`,
                }}
              />
            </div>
            <small>الهدف/المعيار: {Number(t).toFixed(1)}</small>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="box">
          <h4>حالة الشهر الحالي</h4>
          {current ? (
            <ul className="checks">
              <li className={current.validHoursBand ? "ok" : "bad"}>
                الساعات بين 20 و140
              </li>
              <li className={current.meetsSupervision ? "ok" : "bad"}>
                نسبة الإشراف 5% على الأقل
              </li>
              <li className={current.meetsGroupLimit ? "ok" : "bad"}>
                الإشراف الجماعي لا يتجاوز 50%
              </li>
              <li className={current.meetsDirectLimit ? "ok" : "bad"}>
                الساعات المباشرة لا تتجاوز 40%
              </li>
              <li className={current.meetsIndirectMinimum ? "ok" : "bad"}>
                الساعات غير المباشرة 60% على الأقل
              </li>
            </ul>
          ) : (
            <p className="muted">لا توجد ساعات معتمدة لهذا الشهر.</p>
          )}
        </section>
        <section className="box">
          <h4>جاهزية الملف</h4>
          <div className="readiness">
            <b>{validDocs}</b>
            <span>مستند تمت مراجعته</span>
            <b>{meetings.length}</b>
            <span>محضر اجتماع</span>
            <b>
              {plan?.goals?.filter((g: any) => g.status === "achieved")
                .length || 0}
            </b>
            <span>هدف متحقق</span>
          </div>
        </section>
      </div>
      <MonthlyApprovalCard traineeId={trainee.id} current={current} />
      {(!latestAssessment ||
        (latestAssessment.nextDueDate &&
          latestAssessment.nextDueDate <=
            new Date().toISOString().slice(0, 10))) && (
        <div
          className="toast"
          style={{ marginTop: 14, background: "#fff7ed", color: "#9a3412" }}
        >
          تنبيه:{" "}
          {latestAssessment
            ? `حان موعد إعادة تقييم الكفاءة منذ ${latestAssessment.nextDueDate}`
            : "يجب تنفيذ تقييم الكفاءة الأولي للمتدرب."}
        </div>
      )}
      <section className="box" style={{ marginTop: 14 }}>
        <h4>قائمة الجاهزية للتقديم</h4>
        <div
          className="checks"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          }}
        >
          {readinessChecks.map((x) => (
            <li key={x.label} className={x.ok ? "ok" : "bad"}>
              {x.label}
            </li>
          ))}
        </div>
        <p className="muted" style={{ textAlign: "right", padding: "8px 0 0" }}>
          الموافقات الورقية تُعرض للتوثيق والمراجعة اليدوية فقط ولا تمنع اعتماد
          الساعات.
        </p>
      </section>
    </>
  );
}

function MonthlyApprovalCard({ traineeId, current }: any) {
  const month = current?.month || new Date().toISOString().slice(0, 7);
  const [approval, setApproval] = useState<any>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch(
      `/api/supervisor/monthly-approval?traineeId=${traineeId}&month=${month}`,
    )
      .then((r) => r.json())
      .then((x) => setApproval(x.approval));
  }, [traineeId, month]);
  const approve = async () => {
    const r = await fetch("/api/supervisor/monthly-approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId, month, attestation: true }),
    });
    const x = await r.json();
    if (!r.ok) {
      setMsg(
        x.error === "MONTH_NOT_COMPLIANT"
          ? "لا يمكن إغلاق الشهر قبل استيفاء نطاق الساعات ونسبة الإشراف وحد الجماعي وتوزيع المباشر 40% وغير المباشر 60%."
          : x.error === "PENDING_ACTIVITIES"
            ? "توجد ساعات ما زالت قيد المراجعة."
            : x.error === "SUPERVISOR_CREDENTIAL_EXPIRED"
              ? "لا يمكن اعتماد الشهر لأن اعتماد المشرف منتهي. حدّث بيانات الاعتماد أولًا."
              : "تعذر اعتماد الشهر.",
      );
      return;
    }
    setMsg("تم اعتماد الشهر من المشرف، وبانتظار إقرار المتدرب.");
    setApproval({ supervisorApprovedAt: new Date().toISOString() });
  };
  return (
    <section className="box" style={{ marginTop: 14 }}>
      <h4>اعتماد وإغلاق شهر {month}</h4>
      <p className="muted" style={{ textAlign: "right", padding: 0 }}>
        أقر بأن الساعات المعتمدة أنشطة تحليل سلوك مناسبة وأن جلسات الإشراف تمت
        عن بُعد بصورة متزامنة.
      </p>
      <div className="ws-actions">
        <button
          className="save"
          disabled={!current || approval?.supervisorApprovedAt}
          onClick={approve}
        >
          {approval?.supervisorApprovedAt ? "✓ اعتمد المشرف" : "اعتماد الشهر"}
        </button>
        {approval?.traineeAcknowledgedAt && (
          <span className="ok">✓ أقر المتدرب وتم إغلاق الشهر</span>
        )}
      </div>
      {msg && (
        <p className="muted" style={{ textAlign: "right", padding: 0 }}>
          {msg}
        </p>
      )}
    </section>
  );
}

function Documents({ traineeId, items, onSave }: any) {
  const paperApprovalTypes = new Set([
    "guardian_consent",
    "center_approval",
    "observation_consent",
    "video_consent",
    "data_consent",
  ]);
  const [form, setForm] = useState({
    type: "guardian_consent",
    title: "",
    centerName: "",
    clientCode: "",
    issuedAt: new Date().toISOString().slice(0, 10),
    expiresAt: "",
    notes: "",
    fileName: "",
    fileUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const upload = async (file: File) => {
    setBusy(true);
    setUploadError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 55000);
    try {
      const fd = new FormData();
      fd.append("traineeId", traineeId);
      fd.append("file", file);
      const r = await fetch("/api/supervisor/document-upload", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const messages: Record<string, string> = {
          INVALID_FILE: "الملف غير مدعوم أو يتجاوز 10MB.",
          FORBIDDEN: "لا تملك صلاحية الرفع إلى ملف هذا المتدرب.",
          UPLOAD_FAILED: "تعذر رفع الملف إلى التخزين السحابي. حاول مرة أخرى.",
        };
        throw new Error(messages[j.error] || "تعذر رفع الملف.");
      }
      setForm((current: any) => ({
        ...current,
        fileName: j.fileName,
        fileUrl: j.fileUrl,
      }));
    } catch (error) {
      setUploadError(
        error instanceof DOMException && error.name === "AbortError"
          ? "استغرق الرفع وقتًا أطول من المتوقع. تحقق من الاتصال وحاول مجددًا."
          : error instanceof Error
            ? error.message
            : "تعذر رفع الملف.",
      );
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };
  return (
    <div className="split">
      <FormBox title="إضافة مستند أو موافقة">
        <div className="form-grid">
          <Field label="النوع">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(docTypes).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="عنوان المستند">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="المركز">
            <input
              value={form.centerName}
              onChange={(e) => setForm({ ...form, centerName: e.target.value })}
            />
          </Field>
          <Field label="رمز المستفيد">
            <input
              value={form.clientCode}
              onChange={(e) => setForm({ ...form, clientCode: e.target.value })}
            />
          </Field>
          <Field label="تاريخ الإصدار">
            <input
              type="date"
              value={form.issuedAt}
              onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
            />
          </Field>
          {!paperApprovalTypes.has(form.type) && (
            <Field label="تاريخ الانتهاء (اختياري)">
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm({ ...form, expiresAt: e.target.value })
                }
              />
            </Field>
          )}
          <Field label="الملف">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <small>
              {busy
                ? "جارٍ الرفع..."
                : form.fileName || "PDF أو صورة أو Word، حتى 10MB"}
            </small>
            {uploadError && (
              <small style={{ color: "#b91c1c", display: "block" }}>
                {uploadError}
              </small>
            )}
          </Field>
          <Field label="ملاحظات">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
        <button
          className="save"
          disabled={busy || !form.title || !form.fileUrl}
          onClick={async () => {
            if (await onSave({ entity: "document", ...form }))
              setForm({
                ...form,
                title: "",
                notes: "",
                fileName: "",
                fileUrl: "",
              });
          }}
        >
          حفظ في ملف المتدرب
        </button>
      </FormBox>
      <ListBox title="المستندات المحفوظة">
        {items.map((d: any) => (
          <article className="list-card" key={d.id}>
            <div>
              <b>{docTypes[d.type] || d.title}</b>
              <p>
                {d.title} · {d.issuedAt}
                {d.expiresAt ? ` — ينتهي ${d.expiresAt}` : ""}
              </p>
              <p>
                الحالة:{" "}
                {d.status === "reviewed"
                  ? "تمت المراجعة"
                  : d.status === "replace_required"
                    ? "تحتاج استبدال"
                    : "مرفوعة"}
              </p>
            </div>
            <div
              className="doc-actions"
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {d.fileUrl && (
                <a
                  href={`/api/supervisor/document-upload?path=${encodeURIComponent(d.fileUrl)}`}
                >
                  تنزيل
                </a>
              )}
              {d.status !== "reviewed" && (
                <button
                  style={{
                    border: 0,
                    borderRadius: 7,
                    padding: "6px 8px",
                    background: "#ecfdf5",
                    color: "#047857",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    onSave(
                      { entity: "document", id: d.id, status: "reviewed" },
                      "PATCH",
                    )
                  }
                >
                  تمت المراجعة
                </button>
              )}
              {d.status !== "replace_required" && (
                <button
                  style={{
                    border: 0,
                    borderRadius: 7,
                    padding: "6px 8px",
                    background: "#fff7ed",
                    color: "#c2410c",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    onSave(
                      {
                        entity: "document",
                        id: d.id,
                        status: "replace_required",
                      },
                      "PATCH",
                    )
                  }
                >
                  يحتاج استبدال
                </button>
              )}
            </div>
          </article>
        ))}
        {!items.length && <Empty />}
      </ListBox>
    </div>
  );
}

function Meetings({ items, goals, onSave }: any) {
  const blank = {
    date: new Date().toISOString().slice(0, 10),
    startTime: "",
    endTime: "",
    format: "individual",
    setting: "video",
    observedWithClient: false,
    agenda: "",
    discussion: "",
    decisions: "",
    actionItems: "",
    taskDueDate: "",
    planGoalIds: [],
  };
  const [f, setF] = useState<any>(blank);
  return (
    <div className="split">
      <FormBox title="محضر جلسة إشراف">
        <div className="form-grid">
          <Field label="التاريخ">
            <input
              type="date"
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
          </Field>
          <Field label="الوقت">
            <div className="inline">
              <input
                type="time"
                value={f.startTime}
                onChange={(e) => setF({ ...f, startTime: e.target.value })}
              />
              <input
                type="time"
                value={f.endTime}
                onChange={(e) => setF({ ...f, endTime: e.target.value })}
              />
            </div>
          </Field>
          <Field label="صيغة الجلسة">
            <select
              value={f.format}
              onChange={(e) => setF({ ...f, format: e.target.value })}
            >
              <option value="individual">فردية</option>
              <option value="group">جماعية</option>
            </select>
          </Field>
          <Field label="طريقة الانعقاد">
            <select
              value={f.setting}
              onChange={(e) => setF({ ...f, setting: e.target.value })}
            >
              <option value="video">اتصال مرئي متزامن</option>
              <option value="in_person">حضوري</option>
            </select>
          </Field>
          <Field label="جدول الأعمال">
            <textarea
              value={f.agenda}
              onChange={(e) => setF({ ...f, agenda: e.target.value })}
            />
          </Field>
          <Field label="المناقشة والتغذية الراجعة">
            <textarea
              value={f.discussion}
              onChange={(e) => setF({ ...f, discussion: e.target.value })}
            />
          </Field>
          <Field label="القرارات">
            <textarea
              value={f.decisions}
              onChange={(e) => setF({ ...f, decisions: e.target.value })}
            />
          </Field>
          <Field label="المهام والمتابعة">
            <textarea
              value={f.actionItems}
              onChange={(e) => setF({ ...f, actionItems: e.target.value })}
            />
          </Field>
          <Field label="موعد إنجاز المهام">
            <input
              type="date"
              value={f.taskDueDate}
              onChange={(e) => setF({ ...f, taskDueDate: e.target.value })}
            />
          </Field>
          <Field label="ربط بهدف من خطة الإشراف">
            <select
              value={f.planGoalIds[0] || ""}
              onChange={(e) =>
                setF({
                  ...f,
                  planGoalIds: e.target.value ? [e.target.value] : [],
                })
              }
            >
              <option value="">بدون ربط</option>
              {goals.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={f.observedWithClient}
            onChange={(e) =>
              setF({ ...f, observedWithClient: e.target.checked })
            }
          />{" "}
          تضمنت الجلسة ملاحظة أداء المتدرب مع مستفيد
        </label>
        <button
          className="save"
          onClick={async () => {
            if (await onSave({ entity: "meeting", ...f })) setF(blank);
          }}
        >
          حفظ المحضر وربطه بالجلسة
        </button>
      </FormBox>
      <ListBox title="المحاضر السابقة">
        {items.map((m: any) => (
          <article className="list-card column" key={m.id}>
            <b>
              {m.date} · {m.format === "group" ? "جماعية" : "فردية"}
            </b>
            <p>
              <strong>الموضوع:</strong> {m.agenda}
            </p>
            <p>
              <strong>المهام:</strong> {m.actionItems || "—"}
            </p>
            {m.tasks?.map((task: any) => (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                  padding: 8,
                  background: "#f8fafc",
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 11 }}>
                  {task.title}
                  {task.dueDate ? ` · حتى ${task.dueDate}` : ""}
                </span>
                <button
                  disabled={task.status === "completed"}
                  style={{
                    border: 0,
                    borderRadius: 7,
                    padding: "5px 8px",
                    background:
                      task.status === "completed" ? "#ecfdf5" : "#eef4ff",
                    color: task.status === "completed" ? "#047857" : "#0d40fc",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    onSave(
                      {
                        entity: "meeting_task",
                        id: m.id,
                        taskId: task.id,
                        status: "completed",
                      },
                      "PATCH",
                    )
                  }
                >
                  {task.status === "completed" ? "✓ مكتملة" : "تم الإنجاز"}
                </button>
              </div>
            ))}
          </article>
        ))}
        {!items.length && <Empty />}
      </ListBox>
    </div>
  );
}

function Assessment({ items, onSave }: any) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [period, setPeriod] = useState("initial");
  const [notes, setNotes] = useState({
    strengths: "",
    developmentPriorities: "",
    recommendation: "",
  });
  const submit = () =>
    onSave({
      entity: "assessment",
      date: new Date().toISOString().slice(0, 10),
      period,
      scores: Object.entries(scores).map(([competencyId, score]) => ({
        competencyId,
        score,
        observationMethod: "live",
      })),
      ...notes,
    });
  return (
    <div>
      <div className="assessment-head">
        <div>
          <h3>تقييم الكفاءة الدوري</h3>
          <p>يُنفذ في بداية الإشراف ثم كل ثلاثة أشهر، والدرجات من 1 إلى 5.</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="initial">تقييم أولي</option>
          <option value="quarterly">تقييم ربع سنوي</option>
        </select>
      </div>
      {competencyGroups.map((g) => (
        <section className="competency" key={g.domain}>
          <h4>{g.domain}</h4>
          {g.items.map((title, i) => {
            const id = `${g.domain}-${i}`;
            return (
              <div className="score-row" key={id}>
                <span>{title}</span>
                <div>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      className={scores[id] === n ? "chosen" : ""}
                      onClick={() => setScores({ ...scores, [id]: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <div className="form-grid notes">
        <Field label="نقاط القوة">
          <textarea
            value={notes.strengths}
            onChange={(e) => setNotes({ ...notes, strengths: e.target.value })}
          />
        </Field>
        <Field label="أولويات التطوير">
          <textarea
            value={notes.developmentPriorities}
            onChange={(e) =>
              setNotes({ ...notes, developmentPriorities: e.target.value })
            }
          />
        </Field>
        <Field label="توصية المشرف">
          <textarea
            value={notes.recommendation}
            onChange={(e) =>
              setNotes({ ...notes, recommendation: e.target.value })
            }
          />
        </Field>
      </div>
      <button
        className="save"
        disabled={!Object.keys(scores).length}
        onClick={submit}
      >
        اعتماد التقييم
      </button>
      <div className="history">
        <h4>سجل التقييمات</h4>
        {items.map((a: any) => (
          <span key={a.id}>
            {a.date}
            <b>{Math.round((a.totalScore / a.maxScore) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Plan({ plan, onSave }: any) {
  const [goals, setGoals] = useState<any[]>(plan?.goals || []);
  useEffect(() => setGoals(plan?.goals || []), [plan]);
  const add = () =>
    setGoals([
      ...goals,
      {
        id: `goal-${Date.now()}`,
        domain: "مهارات ما قبل التطبيق",
        title: "",
        status: "not_started",
        masteryCriterion: "",
        startDate: "",
        dueDate: "",
      },
    ]);
  return (
    <div>
      <div className="plan-head">
        <div>
          <h3>خطة الإشراف والمتابعة</h3>
          <p>المشرف يحرر الخطة، والمتدرب يطّلع على النسخة المعتمدة.</p>
        </div>
        <button className="outline" onClick={add}>
          ＋ إضافة هدف
        </button>
      </div>
      <div className="goals">
        {goals.map((g, i) => (
          <div className="goal" key={g.id}>
            <select
              value={g.domain}
              onChange={(e) =>
                setGoals(
                  goals.map((x, j) =>
                    j === i ? { ...x, domain: e.target.value } : x,
                  ),
                )
              }
            >
              {competencyGroups.map((x) => (
                <option key={x.domain}>{x.domain}</option>
              ))}
            </select>
            <input
              className="goal-title"
              placeholder="الهدف الإشرافي"
              value={g.title}
              onChange={(e) =>
                setGoals(
                  goals.map((x, j) =>
                    j === i ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              placeholder="معيار الإتقان"
              value={g.masteryCriterion || ""}
              onChange={(e) =>
                setGoals(
                  goals.map((x, j) =>
                    j === i ? { ...x, masteryCriterion: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              type="date"
              value={g.dueDate || ""}
              onChange={(e) =>
                setGoals(
                  goals.map((x, j) =>
                    j === i ? { ...x, dueDate: e.target.value } : x,
                  ),
                )
              }
            />
            <select
              value={g.status}
              onChange={(e) =>
                setGoals(
                  goals.map((x, j) =>
                    j === i ? { ...x, status: e.target.value } : x,
                  ),
                )
              }
            >
              {Object.entries(statusLabel).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              className="remove"
              onClick={() => setGoals(goals.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        {!goals.length && <Empty />}
      </div>
      <button
        className="save"
        onClick={() => onSave({ entity: "plan", goals }, "PUT")}
      >
        حفظ واعتماد الخطة
      </button>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function FormBox({ title, children }: any) {
  return (
    <section className="box form-box">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function ListBox({ title, children }: any) {
  return (
    <section className="box list-box">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Empty() {
  return <p className="empty">لا توجد سجلات حتى الآن.</p>;
}
const css = `.ws{color:#001442}.ws-toolbar,.plan-head,.assessment-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.ws-toolbar h2,.plan-head h3,.assessment-head h3{margin:0;font-size:21px}.ws-toolbar p,.plan-head p,.assessment-head p{margin:4px 0 0;color:#718096;font-size:12px}.ws-actions{display:flex;gap:9px}.ws select,.ws input,.ws textarea{font:inherit;border:1px solid #d9e1ed;border-radius:9px;padding:9px;background:#fff;color:#001442}.export,.save,.outline{border:0;border-radius:9px;padding:10px 14px;text-decoration:none;font-weight:700;cursor:pointer}.export,.save{background:#0d40fc;color:#fff}.outline{background:#eff4ff;color:#0d40fc}.ws-tabs{display:flex;gap:6px;margin:18px 0;padding:6px;background:#edf2f8;border-radius:13px;overflow:auto}.ws-tabs button{border:0;background:transparent;padding:10px 14px;border-radius:9px;white-space:nowrap;color:#64748b;cursor:pointer;font:inherit}.ws-tabs button.active{background:#fff;color:#0d40fc;font-weight:700;box-shadow:0 2px 8px #00144212}.toast,.loading{padding:12px;border-radius:10px;background:#eff8ff;color:#075985;margin-bottom:12px}.hero{background:linear-gradient(130deg,#001442,#0d40fc);color:#fff;padding:24px;border-radius:20px;display:flex;justify-content:space-between;align-items:center}.hero span,.hero p{color:#c9d8ff;font-size:12px}.hero h3{font-size:25px;margin:5px 0}.ring{width:120px;height:120px;border-radius:50%;display:grid;place-content:center;text-align:center;background:conic-gradient(#55d7ff var(--p),#ffffff25 0);position:relative}.ring:after{content:'';position:absolute;inset:10px;border-radius:50%;background:#0731a5}.ring b,.ring small{z-index:1}.ring b{font-size:24px}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.metric,.box{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:16px}.metric span,.metric small{font-size:11px;color:#718096}.metric b{display:block;font-size:21px;margin:5px 0}.mini{height:6px;background:#edf2f7;border-radius:9px;overflow:hidden}.mini i{height:100%;display:block;background:#0d40fc}.overview-grid,.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.box h3,.box h4{margin:0 0 12px}.checks{list-style:none;padding:0;margin:0}.checks li{padding:8px 25px 8px 0;position:relative}.checks li:before{position:absolute;right:0}.checks .ok:before{content:'✓';color:#059669}.checks .bad:before{content:'!';color:#dc2626}.readiness{display:grid;grid-template-columns:auto 1fr;gap:9px}.readiness b{color:#0d40fc}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.field span{display:block;font-size:11px;color:#64748b;margin-bottom:5px}.field input,.field select,.field textarea{width:100%}.field textarea{min-height:76px;resize:vertical}.field small{font-size:10px;color:#718096}.save{margin-top:13px}.list-card{border:1px solid #edf1f6;border-radius:11px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px}.list-card p{font-size:11px;color:#64748b;margin:3px 0}.list-card a{color:#0d40fc;font-size:12px}.column{display:block}.inline{display:flex;gap:6px}.check{display:block;margin-top:11px;font-size:12px}.competency{background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-top:12px;overflow:hidden}.competency h4{margin:0;padding:12px 16px;background:#f5f8fc}.score-row{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-top:1px solid #edf1f6;font-size:12px}.score-row button{width:30px;height:30px;border:1px solid #dce3ed;background:#fff;border-radius:7px;margin-right:4px;cursor:pointer}.score-row button.chosen{background:#0d40fc;color:#fff;border-color:#0d40fc}.notes{margin-top:12px}.history{margin-top:15px}.history span{display:inline-flex;gap:12px;background:#eef4ff;padding:8px 12px;border-radius:9px;margin-left:7px}.goals{margin-top:14px}.goal{display:grid;grid-template-columns:1.1fr 2fr 1.5fr 1.1fr 1.1fr auto;gap:7px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:8px}.remove{border:0;background:#fff0f0;color:#dc2626;border-radius:7px;font-size:20px}.empty,.muted{color:#718096;font-size:12px;text-align:center;padding:20px}.ws-empty{padding:30px;text-align:center;background:#fff;border-radius:15px}@media(max-width:900px){.metric-grid{grid-template-columns:1fr 1fr}.split,.overview-grid{grid-template-columns:1fr}.goal{grid-template-columns:1fr}.ws-toolbar,.plan-head,.assessment-head{align-items:flex-start;flex-direction:column}.ws-actions{width:100%;flex-wrap:wrap}.form-grid{grid-template-columns:1fr}.score-row{align-items:flex-start;gap:8px;flex-direction:column}.ring{width:95px;height:95px}}`;
