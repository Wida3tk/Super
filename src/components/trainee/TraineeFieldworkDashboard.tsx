"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldworkActivity, FieldworkActivityType } from "@/types";
import TraineeAccountSettings from "@/components/trainee/TraineeAccountSettings";
import SupervisionPolicies from "@/components/policies/SupervisionPolicies";
import {
  AttendanceRecord,
  FinancialPlan,
  TraineeRequests,
} from "@/components/trainee/TraineeOperations";

const labels: Record<FieldworkActivityType, string> = {
  direct: "مباشرة مع العميل",
  indirect: "غير مباشرة",
  supervision_direct: "إشراف مباشر",
  supervision_indirect: "إشراف غير مباشر",
};
const statusLabels: Record<string, string> = {
  draft: "مسودة",
  submitted: "بانتظار الاعتماد",
  approved: "معتمد",
  revision_requested: "يحتاج تعديل",
  rejected: "مرفوض",
};
const categoryLabels: Record<string, string> = {
  service_delivery: "تقديم خدمة مباشرة",
  data_collection: "جمع وتلخيص البيانات",
  data_analysis: "تحليل البيانات",
  assessment: "إجراء تقييم",
  program_development: "إعداد برنامج أو خطة",
  reporting_graphing: "تقارير ورسوم بيانية",
  stakeholder_training: "تدريب الأسرة أو الفريق",
  fidelity_monitoring: "مراقبة دقة التنفيذ",
  person_centered_meeting: "اجتماع متعلق بخطة المستفيد",
  research_programming: "بحث أو برمجة",
  other_aba: "نشاط تحليلي سلوكي آخر",
};

export default function TraineeFieldworkDashboard({
  trainee,
  supervisorName,
  initialActivities,
  supervisionFile,
}: {
  trainee: any;
  supervisorName: string;
  initialActivities: FieldworkActivity[];
  supervisionFile?: any;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "hours"
    | "plan"
    | "competency"
    | "meetings"
    | "documents"
    | "policies"
    | "attendance"
    | "requests"
    | "finance"
    | "account"
  >("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [monthlyApproval, setMonthlyApproval] = useState(
    supervisionFile?.monthlyApproval || null,
  );
  const [approvalMessage, setApprovalMessage] = useState("");
  const [meetings, setMeetings] = useState(supervisionFile?.meetings || []);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: "",
    endTime: "",
    activityType: "direct" as FieldworkActivityType,
    activityCategory: "service_delivery",
    centerName: "",
    clientCode: "",
    planGoalId: "",
    evidenceNote: "",
    setting: "video",
    format: "individual",
    observedWithClient: false,
    description: "",
  });
  const isSupervision = form.activityType.startsWith("supervision_");
  const duration = useMemo(() => {
    if (!form.startTime || !form.endTime) return 0;
    const [sh, sm] = form.startTime.split(":").map(Number),
      [eh, em] = form.endTime.split(":").map(Number);
    return Math.max(
      0,
      Math.round(((eh * 60 + em - (sh * 60 + sm)) / 60) * 100) / 100,
    );
  }, [form.startTime, form.endTime]);
  const approved = activities.filter((a) => a.status === "approved");
  const sum = (types: FieldworkActivityType[]) =>
    approved
      .filter((a) => types.includes(a.activityType))
      .reduce((n, a) => n + a.duration, 0);
  const direct = sum(["direct"]),
    indirect = sum(["indirect"]);
  const supervision = sum(["supervision_direct", "supervision_indirect"]);
  const total = direct + indirect;
  const supervisionPct = total ? (supervision / total) * 100 : 0;
  const maxBar = Math.max(direct, indirect, supervision, 1);
  const requiredHours = Number(
    trainee.requiredHours || (trainee.license === "QBA" ? 2000 : 1000),
  );
  const progress = Math.min(100, (total / requiredHours) * 100);
  const pendingCount = activities.filter(
    (a) => a.status === "submitted",
  ).length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthHours = approved
    .filter((a) => a.month === currentMonth)
    .reduce((n, a) => n + a.duration, 0);
  const motivation =
    progress >= 100
      ? "اكتمل هدف الساعات؛ راجع التوثيق ونسب الساعات وسجلات الإشراف قبل التقديم."
      : progress >= 60
        ? "أصبحت أقرب للجاهزية المهنية؛ واصل تطوير مهارات التقييم وتصميم التدخل والتعاون مع أصحاب المصلحة."
        : progress >= 25
          ? "تقدمك لا يقاس بعدد الساعات فقط، بل بجودة جمع البيانات والتحليل والتطبيق الأخلاقي."
          : "كل ملاحظة دقيقة وقرار قائم على البيانات يبني كفاءتك في تحليل السلوك التطبيقي.";
  const latestAssessment = supervisionFile?.assessments?.[0];
  const assessmentPct = latestAssessment?.maxScore
    ? (latestAssessment.totalScore / latestAssessment.maxScore) * 100
    : 0;
  const goals = supervisionFile?.plan?.goals || [];
  const filteredActivities = activities.filter(
    (a) =>
      (statusFilter === "all" || a.status === statusFilter) &&
      (monthFilter === "all" || a.month === monthFilter),
  );
  const activityMonths = [...new Set(activities.map((a) => a.month))]
    .sort()
    .reverse();
  const monthApproved = approved.filter((a) => a.month === currentMonth);
  const monthFieldwork = monthApproved
    .filter((a) => !a.activityType.startsWith("supervision_"))
    .reduce((n, a) => n + a.duration, 0);
  const monthSupervision = monthApproved
    .filter((a) => a.activityType.startsWith("supervision_"))
    .reduce((n, a) => n + a.duration, 0);
  const monthGroup = monthApproved
    .filter(
      (a) => a.activityType.startsWith("supervision_") && a.format === "group",
    )
    .reduce((n, a) => n + a.duration, 0);
  const monthSupervisionPct = monthFieldwork
    ? (monthSupervision / monthFieldwork) * 100
    : 0;
  const monthGroupPct = monthSupervision
    ? (monthGroup / monthSupervision) * 100
    : 0;
  const editActivity = (activity: FieldworkActivity) => {
    setEditingId(activity.id);
    setForm({
      ...form,
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
      activityType: activity.activityType,
      activityCategory: activity.activityCategory || "service_delivery",
      centerName: activity.centerName || "",
      clientCode: activity.clientCode || "",
      planGoalId: activity.planGoalId || "",
      evidenceNote: activity.evidenceNote || "",
      setting: activity.setting || "video",
      format: activity.format || "individual",
      observedWithClient: Boolean(activity.observedWithClient),
      description: activity.description,
    });
    setOpen(true);
  };
  const acknowledgeMonth = async () => {
    setApprovalMessage("جارٍ الإقرار...");
    const response = await fetch("/api/trainee/monthly-approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: supervisionFile?.currentMonth || currentMonth,
        attestation: true,
      }),
    });
    if (!response.ok) {
      setApprovalMessage("يجب أن يعتمد المشرف الشهر أولًا.");
      return;
    }
    setMonthlyApproval({
      ...monthlyApproval,
      traineeAcknowledgedAt: new Date().toISOString(),
      locked: true,
    });
    setApprovalMessage("تم إقرار السجل وإغلاق الشهر.");
  };

  const submit = async (saveAsDraft: boolean) => {
    setSaving(true);
    setError("");
    const res = await fetch("/api/trainee/activities", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingId
          ? { ...form, id: editingId, action: "update" }
          : { ...form, saveAsDraft },
      ),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const messages: Record<string, string> = {
        TIME_OVERLAP: "يوجد نشاط آخر متداخل مع هذا الوقت.",
        BEFORE_ELIGIBLE_START:
          "لا يمكن احتساب ساعات قبل بدء المقرر أو فترة الخبرة.",
        MONTH_LOCKED: "هذا الشهر مغلق بعد اعتماد المشرف وإقرارك.",
        ACTIVITY_CATEGORY_REQUIRED: "اختر تصنيف النشاط.",
        INVALID_DURATION: "تحقق من وقت البداية والنهاية.",
        SUPERVISION_DETAILS_REQUIRED: "أكمل بيانات جلسة الإشراف.",
      };
      setError(messages[data.error] || "تعذر حفظ النشاط، تحقق من البيانات.");
      setSaving(false);
      return;
    }
    const refreshed = await fetch("/api/trainee/activities").then((r) =>
      r.json(),
    );
    setActivities(refreshed.activities || []);
    setOpen(false);
    setEditingId(null);
    setSaving(false);
    setForm({ ...form, startTime: "", endTime: "", description: "" });
  };
  const submitExisting = async (id: string) => {
    setSaving(true);
    const r = await fetch("/api/trainee/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "submit" }),
    });
    if (r.ok) {
      const refreshed = await fetch("/api/trainee/activities").then((x) =>
        x.json(),
      );
      setActivities(refreshed.activities || []);
    }
    setSaving(false);
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/ar/login");
    router.refresh();
  };
  const updateMeeting = async (
    id: string,
    action: "acknowledge" | "complete_task",
    taskId?: string,
  ) => {
    const response = await fetch("/api/trainee/supervision-file", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "meeting", id, action, taskId }),
    });
    if (!response.ok) return;
    setMeetings((current: any[]) =>
      current.map((meeting) =>
        meeting.id !== id
          ? meeting
          : action === "acknowledge"
            ? {
                ...meeting,
                acknowledgedByTrainee: true,
                acknowledgedAt: new Date().toISOString(),
              }
            : {
                ...meeting,
                tasks: (meeting.tasks || []).map((task: any) =>
                  task.id === taskId ? { ...task, status: "completed" } : task,
                ),
              },
      ),
    );
  };

  return (
    <main className="fw-page" dir="rtl">
      <style>{`
      *{box-sizing:border-box}.fw-page{min-height:100vh;background:#f5f7fb;color:#001442;padding:28px;font-family:'IBM Plex Sans Arabic',Arial,sans-serif}.fw-wrap{max-width:1180px;margin:auto}.fw-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}.fw-head h1{font-size:28px;margin:0}.muted{color:#718096;font-size:13px}.primary{border:0;background:#0d40fc;color:#fff;padding:11px 18px;border-radius:11px;font-weight:700;cursor:pointer}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.card,.panel{background:#fff;border:1px solid #e4e9f1;border-radius:15px;box-shadow:0 2px 8px #0014420a}.card{padding:17px}.card b{display:block;font-size:23px;margin-top:6px}.grid{display:grid;grid-template-columns:1.05fr 1.95fr;gap:16px}.panel{padding:20px}.bars{display:flex;align-items:flex-end;gap:18px;height:210px;padding:18px 12px 0}.bar-col{flex:1;text-align:center;font-size:12px;color:#718096}.bar{width:100%;min-height:5px;border-radius:8px 8px 3px 3px;margin-bottom:8px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:11px 9px;text-align:right;border-bottom:1px solid #edf0f5;font-size:12px}th{color:#718096;background:#fafbfc}.status{padding:4px 8px;border-radius:20px;background:#eef2ff;color:#2947a9;white-space:nowrap}.modal-bg{position:fixed;inset:0;background:#00144299;display:grid;place-items:center;padding:16px;z-index:50}.modal{background:#fff;border-radius:18px;padding:22px;width:min(650px,100%);max-height:92vh;overflow:auto}.fields{display:grid;grid-template-columns:1fr 1fr;gap:13px}.field label{display:block;font-size:12px;color:#64748b;margin-bottom:6px}.field input,.field select,.field textarea{width:100%;padding:10px;border:1px solid #d8dfeb;border-radius:9px;font:inherit}.field textarea{min-height:90px}.full{grid-column:1/-1}.duration{background:#eef4ff;padding:12px;border-radius:10px;color:#0d40fc;font-weight:700}.actions{display:flex;gap:8px;margin-top:18px}.secondary{background:#fff;border:1px solid #cfd8e6;padding:10px 15px;border-radius:9px;cursor:pointer}@media(max-width:850px){.cards{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.fw-page{padding:16px}.fw-head{align-items:flex-start;flex-direction:column}}
    `}</style>
      <style>{`
      .fw-page{background:radial-gradient(circle at 8% 4%,#dff7ff 0,transparent 27%),radial-gradient(circle at 95% 8%,#eae7ff 0,transparent 25%),#f5f7fb;padding-top:0!important}
      .top-nav{height:68px;display:flex;align-items:center;justify-content:space-between}.brand{font-size:22px;font-weight:900;color:#0d40fc}.role-pill{font-size:11px;color:#53657d;background:#fff;border:1px solid #dfe6f0;padding:6px 11px;border-radius:99px}
      .welcome-hero{position:relative;overflow:hidden;background:linear-gradient(125deg,#001442 0%,#0935ce 62%,#0d70fc 100%);border-radius:24px;padding:32px 34px;color:#fff;display:grid;grid-template-columns:1.5fr .8fr;gap:24px;align-items:center;box-shadow:0 20px 50px #0d40fc25;margin-bottom:18px}.welcome-hero:after{content:'';position:absolute;width:310px;height:310px;border-radius:50%;background:#55d7ff18;left:-80px;top:-155px}.hero-main{position:relative;z-index:1}.eyebrow{font-size:12px;color:#73e3ff;font-weight:700;margin-bottom:7px}.welcome-hero h1{font-size:30px;margin:0 0 8px}.hero-sub{font-size:14px;color:#d5e1ff;line-height:1.8;max-width:620px}.welcome-hero .primary{background:#fff;color:#0d40fc;box-shadow:none;margin-top:18px}.welcome-hero .primary:hover{transform:translateY(-2px)}
      .quote-card{position:relative;z-index:1;background:#ffffff13;border:1px solid #ffffff24;border-radius:18px;padding:20px;backdrop-filter:blur(8px)}.quote-icon{font-size:27px;margin-bottom:8px}.quote{font-size:14px;line-height:1.8;font-weight:600}.supervisor-line{font-size:11px;color:#a9c4ff;margin-top:12px}.progress-wrap{margin-top:18px}.progress-label{display:flex;justify-content:space-between;font-size:11px;color:#c9d8ff;margin-bottom:7px}.progress-track{height:8px;background:#ffffff20;border-radius:99px;overflow:hidden}.progress-fill{height:100%;background:linear-gradient(90deg,#55d7ff,#6fffc2);border-radius:99px}
      .fw-head{display:none!important}.cards{gap:14px!important}.card,.panel{border-radius:18px!important;box-shadow:0 9px 28px #0014420b!important;background:#ffffffeb!important}.card{border-top:3px solid #dce6ff!important;transition:.2s}.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px #0d40fc14!important}.card:nth-child(2){border-top-color:#7668ff!important}.card:nth-child(3){border-top-color:#43bedb!important}.card:nth-child(4){border-top-color:#10b981!important}.card:nth-child(5){border-top-color:#f59e0b!important}.panel h3{font-size:16px;margin-bottom:4px}.bar{border-radius:10px 10px 4px 4px!important}.status{font-weight:600}.motivation-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(90deg,#ecfdf5,#effaff);border:1px solid #c8f2e2;border-radius:14px;padding:13px 17px;margin-bottom:16px}.motivation-strip b{color:#047857;font-size:13px}.motivation-strip span{font-size:12px;color:#4b6472}
      .compliance-card{position:relative;padding-right:54px}.compliance-icon{position:absolute;right:16px;top:16px;width:27px;height:27px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:900}.compliance-icon.ok{background:#dcfce7;color:#15803d}.compliance-icon.follow{background:#fff7ed;color:#c2410c}.account-panel{max-width:760px;margin:auto}.account-heading{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #edf0f5;padding-bottom:15px}.account-lock{width:28px;height:28px;border-radius:50%;background:#ecfdf5;color:#10b981;display:grid;place-items:center;font-size:9px}.account-form{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:18px}.account-form label{font-size:12px;color:#64748b;font-weight:700}.account-form small{font-weight:400}.account-form input{display:block;width:100%;padding:11px;margin-top:6px;border:1px solid #d8dfeb;border-radius:9px;font:inherit}.account-message{grid-column:1/-1;padding:10px;border-radius:9px;font-size:12px}.account-message.success{background:#ecfdf5;color:#047857}.account-message.error{background:#fef2f2;color:#b91c1c}.account-save{grid-column:1/-1;justify-self:start}.account-save:disabled{opacity:.6}
      @media(max-width:850px){.welcome-hero{grid-template-columns:1fr;padding:25px}.welcome-hero h1{font-size:25px}.quote-card{display:none}.top-nav{height:58px}.fw-page{padding-top:0!important}}
    `}</style>
      <style>{`.trainee-tabs{display:flex;gap:6px;background:#e9eef6;padding:6px;border-radius:14px;margin-bottom:16px;overflow:auto}.trainee-tabs button{border:0;background:transparent;color:#64748b;padding:10px 14px;border-radius:9px;font:inherit;white-space:nowrap;cursor:pointer}.trainee-tabs button.active{background:#fff;color:#0d40fc;font-weight:700;box-shadow:0 2px 8px #00144212}.logout-mini{border:1px solid #d9e1ed;background:#fff;color:#64748b;border-radius:9px;padding:7px 10px;cursor:pointer}.nav-user{display:flex;gap:8px;align-items:center}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.filters select{border:1px solid #d9e1ed;border-radius:8px;padding:7px;background:#fff;font:inherit}.row-actions{display:flex;gap:5px}.row-actions button{border:0;border-radius:7px;padding:5px 8px;cursor:pointer;font:inherit;font-size:11px}.detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.detail-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px}.detail-card h4{margin:0 0 8px}.detail-card p{font-size:12px;color:#64748b}.action-btn{border:0;border-radius:8px;padding:7px 10px;background:#eef4ff;color:#0d40fc;cursor:pointer}.action-btn.done{background:#ecfdf5;color:#047857}@media(max-width:800px){.detail-grid{grid-template-columns:1fr}.nav-user .role-pill{display:none}}`}</style>
      <div className="fw-wrap">
        <nav className="top-nav">
          <div className="brand">سلوكيرا</div>
          <div className="nav-user">
            <div className="role-pill">بوابة المتدرب · {trainee.license}</div>
            <button className="logout-mini" onClick={logout}>
              تسجيل الخروج
            </button>
          </div>
        </nav>
        <section className="welcome-hero">
          <div className="hero-main">
            <div className="eyebrow">
              رحلتك نحو ممارسة تحليل السلوك القائمة على الدليل ✦
            </div>
            <h1>أهلًا {trainee.name} 👋</h1>
            <div className="hero-sub">
              وثّق خبراتك، راقب توازن الساعات، واستفد من التغذية الراجعة
              الإشرافية لتطوير كفاءتك المهنية.
            </div>
            <button className="primary" onClick={() => setOpen(true)}>
              ＋ إضافة ساعات جديدة
            </button>
            <div className="progress-wrap">
              <div className="progress-label">
                <span>التقدم نحو {requiredHours} ساعة</span>
                <b>{progress.toFixed(0)}%</b>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
          <aside className="quote-card">
            <div className="quote-icon">🌱</div>
            <div className="quote">{motivation}</div>
            <div className="supervisor-line">
              معك في الرحلة: {supervisorName || "فريق الإشراف"}
            </div>
          </aside>
        </section>
        <div className="trainee-tabs">
          {(
            [
              ["overview", "نظرة عامة"],
              ["hours", "الساعات"],
              ["plan", "خطة الإشراف"],
              ["competency", "تقييم الكفاءة"],
              ["meetings", "الاجتماعات والمهام"],
              ["documents", "المستندات"],
              ["attendance", "الغياب والإنذارات"],
              ["requests", "طلباتي"],
              ["finance", "الخطة المالية"],
              ["policies", "السياسات"],
              ["account", "إعدادات الحساب"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === "overview" && (
          <>
            <div className="motivation-strip">
              <b>✨ {motivation}</b>
              <span>
                {monthHours.toFixed(1)} ساعة هذا الشهر · {pendingCount} بانتظار
                الاعتماد
              </span>
            </div>
            <div className="fw-head">
              <div>
                <h1>مرحبًا، {trainee.name}</h1>
                <div className="muted">
                  المشرف: {supervisorName || "—"} · {trainee.license}
                </div>
              </div>
              <button className="primary" onClick={() => setOpen(true)}>
                + إضافة ساعات
              </button>
            </div>
            <section className="cards">
              <div className="card">
                <span className="muted">إجمالي المعتمد</span>
                <b>{total.toFixed(2)}</b>
              </div>
              <div className="card">
                <span className="muted">مباشرة</span>
                <b>{direct.toFixed(2)}</b>
              </div>
              <div className="card">
                <span className="muted">غير مباشرة</span>
                <b>{indirect.toFixed(2)}</b>
              </div>
              <div className="card">
                <span className="muted">إشراف</span>
                <b>{supervision.toFixed(2)}</b>
              </div>
              <div className="card">
                <span className="muted">نسبة الإشراف</span>
                <b
                  style={{ color: supervisionPct >= 5 ? "#059669" : "#dc2626" }}
                >
                  {supervisionPct.toFixed(1)}%
                </b>
              </div>
            </section>
            <section className="panel" style={{ marginTop: 16 }}>
              <h3>مؤشرات الالتزام للشهر الحالي</h3>
              <div className="detail-grid" style={{ marginTop: 14 }}>
                <ComplianceItem
                  ok={monthFieldwork >= 20 && monthFieldwork <= 140}
                  title="ساعات التطبيق الميداني"
                  value={`${monthFieldwork.toFixed(1)} ساعة مسجلة من النطاق الشهري 20–140 ساعة`}
                />
                <ComplianceItem
                  ok={monthSupervisionPct >= 5}
                  title="نسبة الإشراف"
                  value={`${monthSupervisionPct.toFixed(1)}% (الحد الأدنى 5%)`}
                />
                <ComplianceItem
                  ok={monthGroupPct <= 50}
                  title="الإشراف الجماعي"
                  value={`${monthGroupPct.toFixed(1)}% (الحد الأعلى 50%)`}
                />
                <ComplianceItem
                  ok={Boolean(latestAssessment)}
                  title="تقييم الكفاءة"
                  value={
                    latestAssessment
                      ? `آخر تقييم ${latestAssessment.date || "مسجل"}`
                      : "لم يسجل تقييم بعد"
                  }
                />
              </div>
            </section>
          </>
        )}
        {activeTab === "hours" && (
          <div className="grid">
            <section className="panel">
              <h3>توزيع الساعات</h3>
              <div className="bars">
                {[
                  [direct, "#0d40fc", "مباشرة"],
                  [indirect, "#55b7d7", "غير مباشرة"],
                  [supervision, "#10b981", "إشراف"],
                ].map(([v, c, l]) => (
                  <div className="bar-col" key={String(l)}>
                    <div
                      className="bar"
                      style={{
                        height: `${(Number(v) / maxBar) * 150}px`,
                        background: String(c),
                      }}
                    />
                    <b>{Number(v).toFixed(1)}</b>
                    <div>{l}</div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <h3>سجل الأنشطة</h3>
              <div className="filters">
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  <option value="all">كل الأشهر</option>
                  {activityMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">كل الحالات</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <a className="action-btn" href="/api/trainee/export">
                  تصدير مسودة Excel
                </a>
                {monthlyApproval?.locked && (
                  <a
                    className="action-btn done"
                    href={`/api/trainee/export?month=${supervisionFile?.currentMonth || currentMonth}`}
                  >
                    تصدير السجل المعتمد
                  </a>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th>الوقت</th>
                      <th>المدة</th>
                      <th>الوصف</th>
                      <th>الحالة</th>
                      <th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((a) => (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td>{labels[a.activityType]}</td>
                        <td dir="ltr">
                          {a.startTime}–{a.endTime}
                        </td>
                        <td>{a.duration}</td>
                        <td>{a.description || "—"}</td>
                        <td>
                          <span className="status">
                            {statusLabels[a.status]}
                          </span>
                          {a.reviewerNote && (
                            <div className="muted">{a.reviewerNote}</div>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            {["draft", "revision_requested"].includes(
                              a.status,
                            ) && (
                              <button onClick={() => editActivity(a)}>
                                تعديل
                              </button>
                            )}
                            {a.status === "draft" && (
                              <button
                                onClick={() => submitExisting(a.id)}
                                disabled={saving}
                              >
                                إرسال
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredActivities.length && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{ textAlign: "center", padding: 30 }}
                        >
                          لم تُضف ساعات بعد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {activeTab === "plan" && (
          <section className="panel" style={{ marginTop: 16 }}>
            <h3>ملف الإشراف والتطور المهني</h3>
            <div className="cards" style={{ marginTop: 14, marginBottom: 14 }}>
              <div className="card">
                <span className="muted">آخر تقييم كفاءة</span>
                <b>{assessmentPct.toFixed(0)}%</b>
              </div>
              <div className="card">
                <span className="muted">أهداف الخطة</span>
                <b>{goals.length}</b>
              </div>
              <div className="card">
                <span className="muted">أهداف متحققة</span>
                <b>
                  {goals.filter((g: any) => g.status === "achieved").length}
                </b>
              </div>
              <div className="card">
                <span className="muted">محاضر الاجتماعات</span>
                <b>{supervisionFile?.meetings?.length || 0}</b>
              </div>
              <div className="card">
                <span className="muted">المستندات والموافقات</span>
                <b>{supervisionFile?.documents?.length || 0}</b>
              </div>
            </div>
            {monthlyApproval?.supervisorApprovedAt && (
              <div className="motivation-strip" style={{ marginBottom: 14 }}>
                <div>
                  <b>اعتماد سجل {supervisionFile?.currentMonth}</b>
                  <span style={{ display: "block", marginTop: 4 }}>
                    أقر بأن الساعات والأنشطة المسجلة صحيحة وتمت مراجعتها مع
                    المشرف.
                  </span>
                </div>
                <button
                  className="primary"
                  disabled={monthlyApproval?.traineeAcknowledgedAt}
                  onClick={acknowledgeMonth}
                >
                  {monthlyApproval?.traineeAcknowledgedAt
                    ? "✓ تم الإقرار وإغلاق الشهر"
                    : "إقرار السجل الشهري"}
                </button>
              </div>
            )}
            {approvalMessage && (
              <p className="muted" style={{ textAlign: "right" }}>
                {approvalMessage}
              </p>
            )}
            {goals.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>المجال</th>
                      <th>الهدف</th>
                      <th>معيار الإتقان</th>
                      <th>الموعد</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goals.map((g: any) => (
                      <tr key={g.id}>
                        <td>{g.domain}</td>
                        <td>{g.title}</td>
                        <td>{g.masteryCriterion || "—"}</td>
                        <td>{g.dueDate || "—"}</td>
                        <td>
                          <span className="status">
                            {{
                              not_started: "لم يبدأ",
                              in_progress: "قيد التنفيذ",
                              achieved: "متحقق",
                              retrain: "يحتاج إعادة تدريب",
                            }[g.status as "not_started"] || g.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {activeTab === "competency" && (
          <CompetencyDetails assessments={supervisionFile?.assessments || []} />
        )}
        {activeTab === "meetings" && (
          <MeetingDetails meetings={meetings} onUpdate={updateMeeting} />
        )}
        {activeTab === "documents" && (
          <DocumentDetails documents={supervisionFile?.documents || []} />
        )}
        {activeTab === "policies" && <SupervisionPolicies audience="trainee" />}
        {activeTab === "attendance" && (
          <AttendanceRecord sessions={supervisionFile?.attendance || []} />
        )}
        {activeTab === "requests" && (
          <TraineeRequests initialRequests={supervisionFile?.requests || []} />
        )}
        {activeTab === "finance" && (
          <FinancialPlan plan={supervisionFile?.financialPlan || null} />
        )}
        {activeTab === "account" && (
          <TraineeAccountSettings trainee={trainee} />
        )}
      </div>
      {open && (
        <div
          className="modal-bg"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="modal">
            <h2>
              {editingId ? "تعديل النشاط وإعادة إرساله" : "إضافة نشاط ميداني"}
            </h2>
            <div className="fields">
              <div className="field">
                <label>التاريخ</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>نوع النشاط</label>
                <select
                  value={form.activityType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      activityType: e.target.value as FieldworkActivityType,
                    })
                  }
                >
                  {Object.entries(labels).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>وقت البداية</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>وقت النهاية</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm({ ...form, endTime: e.target.value })
                  }
                />
              </div>
              {!isSupervision && (
                <>
                  <div className="field">
                    <label>تصنيف النشاط</label>
                    <select
                      value={form.activityCategory}
                      onChange={(e) =>
                        setForm({ ...form, activityCategory: e.target.value })
                      }
                    >
                      {Object.entries(categoryLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>المركز</label>
                    <input
                      value={form.centerName}
                      onChange={(e) =>
                        setForm({ ...form, centerName: e.target.value })
                      }
                      placeholder="اسم المركز"
                    />
                  </div>
                  <div className="field">
                    <label>رمز المستفيد (دون الاسم)</label>
                    <input
                      value={form.clientCode}
                      onChange={(e) =>
                        setForm({ ...form, clientCode: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>دليل أو منتج العمل</label>
                    <input
                      value={form.evidenceNote}
                      onChange={(e) =>
                        setForm({ ...form, evidenceNote: e.target.value })
                      }
                      placeholder="مثال: تحليل بيانات أو تقرير تقدم"
                    />
                  </div>
                </>
              )}
              {isSupervision && (
                <>
                  <div className="field">
                    <label>طريقة الإشراف</label>
                    <select
                      value={form.setting}
                      onChange={(e) =>
                        setForm({ ...form, setting: e.target.value })
                      }
                    >
                      <option value="video">اتصال مرئي</option>
                      <option value="in_person">حضوري</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>الصيغة</label>
                    <select
                      value={form.format}
                      onChange={(e) =>
                        setForm({ ...form, format: e.target.value })
                      }
                    >
                      <option value="individual">فردي</option>
                      <option value="group">جماعي</option>
                    </select>
                  </div>
                  <label className="full">
                    <input
                      type="checkbox"
                      checked={form.observedWithClient}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          observedWithClient: e.target.checked,
                        })
                      }
                    />{" "}
                    تمت ملاحظتي مع العميل
                  </label>
                </>
              )}
              <div className="field full">
                <label>وصف النشاط</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="اكتب وصفًا مختصرًا لما تم إنجازه"
                />
              </div>
              <div className="duration full">
                المدة المحسوبة: {duration.toFixed(2)} ساعة
              </div>
            </div>
            {error && <p style={{ color: "#dc2626" }}>{error}</p>}
            <div className="actions">
              <button
                className="primary"
                disabled={saving}
                onClick={() => submit(false)}
              >
                {editingId ? "حفظ وإعادة الإرسال" : "إرسال للمشرف"}
              </button>
              {!editingId && (
                <button
                  className="secondary"
                  disabled={saving}
                  onClick={() => submit(true)}
                >
                  حفظ كمسودة
                </button>
              )}
              <button
                className="secondary"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ComplianceItem({
  ok,
  title,
  value,
}: {
  ok: boolean;
  title: string;
  value: string;
}) {
  return (
    <div className="detail-card compliance-card">
      <span
        className={`compliance-icon ${ok ? "ok" : "follow"}`}
        aria-hidden="true"
      >
        {ok ? "✓" : "○"}
      </span>
      <h4>{title}</h4>
      <p>{value}</p>
      <span className={`status ${ok ? "" : "warning"}`}>
        {ok ? "مستوفى" : "يحتاج متابعة"}
      </span>
    </div>
  );
}

function CompetencyDetails({ assessments }: { assessments: any[] }) {
  const latest = assessments[0];
  if (!latest)
    return (
      <section className="panel">
        <h3>تقييم الكفاءة</h3>
        <p className="muted">لم يضف المشرف تقييم الكفاءة الأول بعد.</p>
      </section>
    );
  return (
    <section className="panel">
      <h3>تقييم الكفاءة والتطور</h3>
      <div className="detail-grid" style={{ marginTop: 14 }}>
        <div className="detail-card">
          <h4>النتيجة الحالية</h4>
          <b style={{ fontSize: 28 }}>
            {latest.maxScore
              ? ((latest.totalScore / latest.maxScore) * 100).toFixed(0)
              : 0}
            %
          </b>
          <p>تاريخ التقييم: {latest.date || "—"}</p>
          <p>
            التقييم القادم:{" "}
            {latest.nextDueDate || "بعد ثلاثة أشهر من آخر تقييم"}
          </p>
        </div>
        <div className="detail-card">
          <h4>نقاط القوة</h4>
          <p>{latest.strengths || "لم تسجل ملاحظات"}</p>
          <h4>أولويات التطوير</h4>
          <p>{latest.developmentPriorities || "لم تسجل ملاحظات"}</p>
          <h4>توصية المشرف</h4>
          <p>{latest.recommendation || "—"}</p>
        </div>
      </div>
      <h3 style={{ marginTop: 22 }}>سجل التقييمات</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النتيجة</th>
              <th>عدد البنود</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((item) => (
              <tr key={item.id}>
                <td>{item.date}</td>
                <td>
                  {item.maxScore
                    ? ((item.totalScore / item.maxScore) * 100).toFixed(0)
                    : 0}
                  %
                </td>
                <td>{item.scores?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MeetingDetails({
  meetings,
  onUpdate,
}: {
  meetings: any[];
  onUpdate: (
    id: string,
    action: "acknowledge" | "complete_task",
    taskId?: string,
  ) => void;
}) {
  if (!meetings.length)
    return (
      <section className="panel">
        <h3>الاجتماعات والمهام</h3>
        <p className="muted">لا توجد محاضر اجتماعات مسجلة بعد.</p>
      </section>
    );
  return (
    <section className="panel">
      <h3>محاضر الاجتماعات والمهام</h3>
      <div className="detail-grid" style={{ marginTop: 14 }}>
        {meetings.map((meeting) => (
          <article className="detail-card" key={meeting.id}>
            <h4>
              {meeting.date} · {meeting.format === "group" ? "جماعي" : "فردي"}
            </h4>
            <p>
              <b>الموضوعات:</b> {meeting.agenda || "—"}
            </p>
            <p>
              <b>ملخص النقاش:</b> {meeting.discussion || meeting.notes || "—"}
            </p>
            <p>
              <b>القرارات:</b> {meeting.decisions || "—"}
            </p>
            {(meeting.tasks || []).map((task: any) => (
              <div
                key={task.id}
                style={{
                  borderTop: "1px solid #edf0f5",
                  paddingTop: 8,
                  marginTop: 8,
                }}
              >
                <p>
                  <b>مهمة:</b> {task.title || task.description}{" "}
                  {task.dueDate ? `· ${task.dueDate}` : ""}
                </p>
                <button
                  className={`action-btn ${task.status === "completed" ? "done" : ""}`}
                  disabled={task.status === "completed"}
                  onClick={() => onUpdate(meeting.id, "complete_task", task.id)}
                >
                  {task.status === "completed" ? "✓ مكتملة" : "تحديد كمكتملة"}
                </button>
              </div>
            ))}
            <button
              className={`action-btn ${meeting.acknowledgedByTrainee ? "done" : ""}`}
              style={{ marginTop: 12 }}
              disabled={meeting.acknowledgedByTrainee}
              onClick={() => onUpdate(meeting.id, "acknowledge")}
            >
              {meeting.acknowledgedByTrainee
                ? "✓ تم الاطلاع"
                : "إقرار الاطلاع على المحضر"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

const documentLabels: Record<string, string> = {
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
function DocumentDetails({ documents }: { documents: any[] }) {
  if (!documents.length)
    return (
      <section className="panel">
        <h3>المستندات والموافقات</h3>
        <p className="muted">لا توجد مستندات مرفوعة في ملفك بعد.</p>
      </section>
    );
  return (
    <section className="panel">
      <h3>المستندات والموافقات</h3>
      <p className="muted">
        تراجع سلوكيرا الموافقات الورقية يدويًا، ولا يوجد لها تاريخ انتهاء.
      </p>
      <div className="detail-grid" style={{ marginTop: 14 }}>
        {documents.map((document) => (
          <article className="detail-card" key={document.id}>
            <h4>{documentLabels[document.type] || document.title}</h4>
            <p>
              {document.title} · {document.issuedAt || "—"}
            </p>
            <span className="status">
              {document.status === "reviewed"
                ? "تمت المراجعة"
                : document.status === "replace_required"
                  ? "يحتاج استبدال"
                  : "مرفوع"}
            </span>
            {document.fileUrl && (
              <a
                className="action-btn"
                style={{ display: "inline-block", marginRight: 8 }}
                href={`/api/supervisor/document-upload?path=${encodeURIComponent(document.fileUrl)}`}
              >
                تنزيل
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
