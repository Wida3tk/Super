import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import UiIcon from "@/components/ui/UiIcon";
import { withContractDates } from "@/lib/qaba/contractDates";
import { exceedsGroupSupervisionLimit, traineeRules } from "@/lib/qaba/compliance";
import { LIFECYCLE_STAGES, resolveLifecycleStage } from "@/lib/lifecycle/stages";
import { ALERTS, CYCLE_STAGES, buildMonthCycle, supervisorBacklog, type AlertKey, type CycleStage } from "@/lib/admin/controlRoom";
import type { FieldworkActivity } from "@/types";
import "@/styles/admin-today.css";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; stage?: string; alert?: string }>;
}

const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const previousMonthOf = (month: string) => {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const fmt = (n: number) => String(Math.round(n * 10) / 10);

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return null;
  try {
    const { adminAuth, adminDb } = await import("@/lib/firebase/admin");
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase())
      return null;
    return { adminDb };
  } catch {
    return null;
  }
}

export default async function AdminTodayPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const auth = await verifyAdmin();
  if (!auth) redirect(`/${locale}/login?portal=admin`);
  const { adminDb } = auth;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const previousMonth = previousMonthOf(currentMonth);
  // Only the open month and the one being closed; older months live in «الأشهر».
  const cycleMonth = query.month === previousMonth ? previousMonth : currentMonth;
  const stageFilter = CYCLE_STAGES.some((s) => s.key === query.stage) ? (query.stage as CycleStage) : null;
  const alertFilter = ALERTS.some((a) => a.key === query.alert) ? (query.alert as AlertKey) : null;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    traineesSnap,
    supervisorsSnap,
    sessionsSnap,
    snapshotsSnap,
    activitySnap,
    notifsSnap,
    pendingRequestsSnap,
    openIncidentsSnap,
    cycleActivitiesSnap,
    cycleSessionsSnap,
    cycleApprovalsSnap,
    pendingReviewSnap,
    disputedSessionsSnap,
  ] = await Promise.all([
    adminDb.collection("trainees").get(),
    adminDb.collection("supervisors").get(),
    adminDb.collection("sessions").where("month", "==", currentMonth).get(),
    adminDb.collection("monthlySnapshots").where("month", "==", currentMonth).get(),
    adminDb.collection("activityLog").orderBy("createdAt", "desc").limit(8).get(),
    adminDb.collection("notifications").where("read", "==", false).get(),
    adminDb.collection("traineeRequests").where("status", "==", "pending").count().get(),
    adminDb.collection("operationalIncidents").where("status", "==", "open").count().get(),
    adminDb.collection("fieldworkActivities").where("month", "==", cycleMonth).get(),
    cycleMonth === currentMonth ? null : adminDb.collection("sessions").where("month", "==", cycleMonth).get(),
    adminDb.collection("monthlyApprovals").where("month", "==", cycleMonth).get(),
    adminDb.collection("fieldworkActivities").where("status", "==", "submitted").get(),
    adminDb.collection("fieldworkActivities").where("traineeAcknowledgment.status", "==", "disputed").get(),
  ]);

  const allTrainees = traineesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const trainees = (await withContractDates(traineesSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({
    id: d.id,
    ...d.data(),
  })))) as any[];
  const supervisors = supervisorsSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const sessions = sessionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((session: any) => !session.deleted) as any[];
  const snapshots = snapshotsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const activities = activitySnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const adminAlerts = (notifsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[])
    .filter((n) => n.targetType === "admin")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 6);

  // Same rules as before the redesign; only the layout changed.
  const activeTrainees = trainees.filter((t) => t.status === "active");
  const onboardingTrainees = trainees.filter((t) => t.status === "onboarding");
  const readyToAssign = trainees.filter(
    (t) => t.status === "onboarding" && t.onboardingStage === "contracting",
  );
  // Same filter as the «طلبات التسجيل» page, so the two counts always agree.
  const newRegistrations = allTrainees.filter(
    (t) => t.lifecycleStage === "registered" || (!t.lifecycleStage && t.registrationSource === "self_registration" && t.onboardingStage === "initial_interview"),
  );
  const weekSessions = sessions.filter((s) => s.date >= weekAgo);
  const over25 = snapshots.filter((s) => exceedsGroupSupervisionLimit(s));
  const atRisk = trainees.filter((t) => {
    if (t.status !== "active") return false;
    const snap = snapshots.find((s) => s.traineeId === t.id);
    return snap && (snap.absenceCount || 0) >= 3;
  });

  const traineeProgress = activeTrainees
    .map((t) => {
      const snap = snapshots.find((s) => s.traineeId === t.id);
      const targetHours = traineeRules(t).supervisionTarget;
      const approvedHours = Number(t.totalIndividualHours || 0) + Number(t.totalGroupHours || 0);
      const pct = Math.round((approvedHours / targetHours) * 100);
      return { ...t, pct, targetHours, totalHours: approvedHours, snap };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  const supervisorLoad = supervisors
    .map((sup) => ({
      ...sup,
      traineeCount: activeTrainees.filter((t) => t.currentSupervisorId === sup.id).length,
      hours: snapshots
        .filter((s) => s.supervisorId === sup.id)
        .reduce((a, s) => a + (s.totalHours || 0), 0),
    }))
    .sort((a, b) => b.traineeCount - a.traineeCount);
  const maxLoad = Math.max(1, ...supervisorLoad.map((s) => s.traineeCount));

  const stageCounts = LIFECYCLE_STAGES.map((stage) => ({
    ...stage,
    count: trainees.filter((t) => resolveLifecycleStage(t) === stage.key).length,
  })).filter((stage) => stage.count > 0);

  // ── Monthly cycle (control room) ─────────────────────────────────────────
  const cycleActivities = cycleActivitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FieldworkActivity[];
  const cycleApprovals = cycleApprovalsSnap.docs.map((d) => d.data()) as any[];
  const inCycle = new Set([...cycleActivities.map((a) => a.traineeId), ...cycleApprovals.map((a) => a.traineeId)]);
  const cycleTrainees = trainees.filter((t) => t.status === "active" || inCycle.has(t.id));
  const cycle = buildMonthCycle({
    trainees: cycleTrainees,
    activities: cycleActivities,
    sessions: (cycleSessionsSnap || sessionsSnap).docs.map((d) => ({ id: d.id, data: d.data() })),
    approvals: cycleApprovals,
    monthClosed: cycleMonth < currentMonth,
  });
  const supervisorName = new Map(supervisors.map((s) => [s.id, s.name as string]));
  const visibleRows = cycle.rows
    .filter((r) => (!stageFilter || r.stage === stageFilter) && (!alertFilter || r.alerts.includes(alertFilter)))
    .sort((a, b) => b.alerts.length - a.alerts.length || CYCLE_STAGES.findIndex((s) => s.key === a.stage) - CYCLE_STAGES.findIndex((s) => s.key === b.stage) || a.name.localeCompare(b.name, "ar"));
  const backlog = supervisorBacklog(pendingReviewSnap.docs.map((d) => d.data() as any), new Date());
  const pendingReviews = backlog.reduce((n, b) => n + b.count, 0);
  const staleReviews = backlog.filter((b) => b.oldestDays >= 7).length;
  const cycleHref = (next: { month?: string; stage?: string | null; alert?: string | null }) => {
    const p = new URLSearchParams();
    const m = next.month ?? cycleMonth;
    if (m !== currentMonth) p.set("month", m);
    const st = next.stage === undefined ? stageFilter : next.stage;
    const al = next.alert === undefined ? alertFilter : next.alert;
    if (st) p.set("stage", st);
    if (al) p.set("alert", al);
    const qs = p.toString();
    return `/${locale}/admin${qs ? `?${qs}` : ""}#cycle`;
  };

  const timeAgo = (iso: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  const base = `/${locale}/admin`;
  // A dispute is only live while the session still counts (not deleted).
  const disputedSessions = disputedSessionsSnap.docs.filter((d) => d.data().status === "approved");
  const disputedTrainees = new Set(disputedSessions.map((d) => d.data().traineeId)).size;
  const queue = [
    { label: "اعتراضات على جلسات إشراف", hint: disputedSessions.length ? `${disputedTrainees} متدرب اعترض على جلسات سجّلها المشرف` : "المتدربون يُقرّون بالجلسات التي يسجلها المشرف", count: disputedSessions.length, href: cycleHref({ alert: "session_disputed", stage: null }), tone: "danger", icon: "alert" },
    { label: "طلبات تسجيل جديدة", hint: "سجّلوا من الموقع وتنتظر بدء المقابلة", count: newRegistrations.length, href: `${base}/onboarding`, tone: "info", icon: "inbox" },
    { label: "جاهزون للإسناد", hint: "أكملوا مرحلة التعاقد", count: readyToAssign.length, href: `${base}/assignment`, tone: "info", icon: "target" },
    { label: "طلبات متدربين بانتظار القرار", hint: "تأجيل، نقل، مستندات وغيرها", count: pendingRequestsSnap.data().count, href: `${base}/trainee-requests`, tone: "warning", icon: "file" },
    { label: "متدربون في خطر", hint: "3 غيابات أو أكثر هذا الشهر", count: atRisk.length, href: `${base}/trainees`, tone: "danger", icon: "alert" },
    { label: "سجلات بانتظار مراجعة المشرفين", hint: staleReviews ? `${staleReviews} مشرف لديه سجلات أقدم من 7 أيام` : "ساعات أرسلها المتدربون ولم تُراجع", count: pendingReviews, href: "#backlog", tone: staleReviews ? "danger" : "warning", icon: "clock" },
    { label: "تجاوز نسبة الإشراف الجماعي", hint: "سجلات هذا الشهر فوق الحد المسموح", count: over25.length, href: `${base}/months`, tone: "warning", icon: "users" },
    { label: "أعطال تشغيلية مفتوحة", hint: "البريد أو التقويم أو المزامنة", count: openIncidentsSnap.data().count, href: `${base}/operations`, tone: "danger", icon: "activity" },
  ];
  const openItems = queue.filter((item) => item.count > 0);
  const todayLabel = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <AdminPageLayout locale={locale} title="اليوم">
      <div className="sk-today">
        <p className="sk-today-date">
          {todayLabel} · {openItems.length ? `${openItems.reduce((n, item) => n + item.count, 0)} عنصر يحتاج إجراء` : "لا توجد عناصر عاجلة"}
        </p>

        <section className="sk-card sk-queue" aria-labelledby="queue-title">
          <header className="sk-card-head">
            <div>
              <h2 id="queue-title">يحتاج إجراء</h2>
              <p>كل صف يفتح القائمة المطلوبة مباشرة.</p>
            </div>
          </header>
          <ul>
            {queue.map((item) => (
              <li key={item.label} className={item.count ? "" : "is-clear"}>
                <Link href={item.href}>
                  <span className={`sk-queue-icon ${item.count ? item.tone : ""}`}><UiIcon name={item.icon} size={18} /></span>
                  <span className="sk-queue-text">
                    <b>{item.label}</b>
                    <small>{item.hint}</small>
                  </span>
                  <span className={`sk-queue-count ${item.count ? item.tone : ""}`}>{item.count || "لا شيء"}</span>
                  <UiIcon name="arrowLeft" size={16} className="sk-queue-go" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="sk-kpis" aria-label="مؤشرات عامة">
          <div className="sk-kpi">
            <span>ساعات {monthLabel(cycleMonth)}</span>
            <b>{fmt(cycle.totals.logged)}</b>
            <small>مسجلة · منها {fmt(cycle.totals.approved)} معتمدة</small>
          </div>
          <div className="sk-kpi">
            <span>متدربون نشطون</span>
            <b>{activeTrainees.length}</b>
            <small>من أصل {trainees.length} متدرب</small>
          </div>
          <div className="sk-kpi">
            <span>الإشراف في {monthLabel(cycleMonth)}</span>
            <b>{fmt(cycle.totals.supervision)}<em className="sk-kpi-of"> من {fmt(cycle.totals.required)}</em></b>
            <small>ساعة إشراف من المطلوب (5%) · {weekSessions.length} جلسة آخر 7 أيام</small>
          </div>
          <div className="sk-kpi">
            <span>قيد الانضمام</span>
            <b>{onboardingTrainees.length}</b>
            <small>منهم {readyToAssign.length} جاهز للإسناد</small>
          </div>
        </section>

        <section className="sk-card sk-cycle" id="cycle" aria-labelledby="cycle-title">
          <header className="sk-card-head">
            <div>
              <h2 id="cycle-title">دورة {monthLabel(cycleMonth)}</h2>
              <p>
                {cycleMonth === currentMonth
                  ? "الشهر مفتوح: التنبيهات مبنية على كل ما سُجّل حتى الآن، قبل اعتماده."
                  : "الشهر السابق: يحتاج اعتماد المشرف وإقرار المتدرب حتى يُقفل."}
              </p>
            </div>
            <nav className="sk-seg" aria-label="الشهر">
              <Link href={cycleHref({ month: currentMonth })} aria-current={cycleMonth === currentMonth ? "page" : undefined}>{monthLabel(currentMonth)}</Link>
              <Link href={cycleHref({ month: previousMonth })} aria-current={cycleMonth === previousMonth ? "page" : undefined}>{monthLabel(previousMonth)}</Link>
            </nav>
          </header>

          <ol className="sk-pipeline" aria-label="مراحل الدورة الشهرية">
            {CYCLE_STAGES.map((stage) => (
              <li key={stage.key}>
                <Link
                  href={cycleHref({ stage: stageFilter === stage.key ? null : stage.key })}
                  className={`tone-${stage.tone}${stageFilter === stage.key ? " is-active" : ""}`}
                  aria-current={stageFilter === stage.key ? "true" : undefined}
                  title={stage.hint}
                >
                  <b>{cycle.stageCounts[stage.key]}</b>
                  <span>{stage.label}</span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="sk-alerts" role="group" aria-label="تنبيهات مبكرة">
            <span className="sk-alerts-label">تنبيهات:</span>
            {ALERTS.filter((a) => cycle.alertCounts[a.key] > 0 || alertFilter === a.key).map((a) => (
              <Link key={a.key} href={cycleHref({ alert: alertFilter === a.key ? null : a.key })} className={`sk-chip ${a.tone}${alertFilter === a.key ? " is-active" : ""}`}>
                {a.label} · {cycle.alertCounts[a.key]}
              </Link>
            ))}
            {ALERTS.every((a) => !cycle.alertCounts[a.key]) && <span className="sk-chip success">لا توجد تنبيهات</span>}
            {(stageFilter || alertFilter) && <Link className="sk-link" href={cycleHref({ stage: null, alert: null })}>إلغاء التصفية</Link>}
          </div>

          {visibleRows.length === 0 ? (
            <p className="sk-empty">{cycle.rows.length ? "لا يوجد متدربون بهذه التصفية" : "لا يوجد متدربون نشطون"}</p>
          ) : (
            <div className="sk-table-wrap">
              <table className="sk-table">
                <thead>
                  <tr>
                    <th scope="col">المتدرب</th>
                    <th scope="col">المشرف</th>
                    <th scope="col">ساعات الشهر</th>
                    <th scope="col">الإشراف من المطلوب</th>
                    <th scope="col">الحالة</th>
                    <th scope="col">تنبيهات</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const stage = CYCLE_STAGES.find((s) => s.key === r.stage)!;
                    return (
                      <tr key={r.traineeId}>
                        <th scope="row"><Link href={`${base}/trainees/${r.traineeId}`}>{r.name}</Link></th>
                        <td data-label="المشرف">{supervisorName.get(r.supervisorId) || <span className="sk-faint">غير مسند</span>}</td>
                        <td data-label="ساعات الشهر" className="num">
                          {fmt(r.logged.total)}
                          {r.logged.total !== r.approved.total && <small> ({fmt(r.approved.total)} معتمدة)</small>}
                        </td>
                        <td data-label="الإشراف من المطلوب" className="num">
                          {fmt(r.logged.supervision)} <small>من {fmt(r.logged.required)}</small>
                          {r.logged.shortfall > 0 && <small className="short"> ينقص {fmt(r.logged.shortfall)}</small>}
                        </td>
                        <td data-label="الحالة">
                          <span className={`sk-chip ${stage.tone === "muted" ? "" : stage.tone}`}>{stage.label}</span>
                          {r.pendingReview > 0 && r.stage !== "awaiting_supervisor" && <small className="sk-faint"> · {r.pendingReview} بانتظار</small>}
                          {r.sessions.unconfirmed > 0 && <small className="sk-faint sk-block">{r.sessions.unconfirmed} جلسة بلا إقرار المتدرب</small>}
                        </td>
                        <td className="sk-cell-alerts">
                          {r.alerts.length === 0 ? <span className="sk-faint">—</span> : r.alerts.map((key) => {
                            const a = ALERTS.find((x) => x.key === key)!;
                            return <em key={key} className={`sk-chip ${a.tone}`}>{a.label}</em>;
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="sk-today-grid">
          <div className="sk-today-col">
            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>تقدم نحو هدف الإشراف</h2>
                  <p>أعلى 6 متدربين نشطين</p>
                </div>
                <Link className="sk-link" href={`${base}/trainees`}>كل المتدربين</Link>
              </header>
              {traineeProgress.length === 0 ? (
                <p className="sk-empty">لا يوجد متدربون نشطون</p>
              ) : (
                <ul className="sk-progress">
                  {traineeProgress.map((t) => (
                    <li key={t.id}>
                      <Link href={`${base}/trainees/${t.id}`} className="sk-progress-name">{t.name}</Link>
                      <span className="sk-bar" aria-hidden="true">
                        <i className={t.pct >= 100 ? "done" : t.pct >= 75 ? "near" : ""} style={{ width: `${Math.min(t.pct, 100)}%` }} />
                      </span>
                      <span className="sk-progress-val">{t.totalHours}/{t.targetHours} · {t.pct}%</span>
                      <span className="sk-progress-tags">
                        {t.pct >= 100 && <em className="sk-chip success">مكتمل</em>}
                        {t.pct >= 85 && t.pct < 100 && <em className="sk-chip warning">قريب</em>}
                        {(t.snap?.absenceCount || 0) >= 3 && <em className="sk-chip danger">خطر</em>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>توزيع المتدربين على مراحل الرحلة</h2>
                  <p>{trainees.length} متدرب</p>
                </div>
              </header>
              {stageCounts.length === 0 ? (
                <p className="sk-empty">لا يوجد متدربون بعد</p>
              ) : (
                <>
                  <div className="sk-stagebar" aria-hidden="true">
                    {stageCounts.map((stage) => (
                      <i key={stage.key} style={{ flex: stage.count, background: stage.color }} title={`${stage.short}: ${stage.count}`} />
                    ))}
                  </div>
                  <ul className="sk-stages">
                    {stageCounts.map((stage) => (
                      <li key={stage.key}>
                        <i style={{ background: stage.color }} aria-hidden="true" />
                        <span>{stage.short}</span>
                        <b>{stage.count}</b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <div className="sk-today-col">
            <section className="sk-card" id="backlog">
              <header className="sk-card-head">
                <div>
                  <h2>مراجعات معلّقة لدى المشرفين</h2>
                  <p>{pendingReviews ? `${pendingReviews} سجل مرسل بانتظار الاعتماد` : "لا توجد سجلات معلّقة"}</p>
                </div>
              </header>
              {backlog.length === 0 ? (
                <p className="sk-empty">كل الساعات المرسلة تمت مراجعتها</p>
              ) : (
                <ul className="sk-load">
                  {backlog.map((b) => (
                    <li key={b.supervisorId || "none"}>
                      {b.supervisorId ? <Link href={`${base}/supervisors/${b.supervisorId}`}>{supervisorName.get(b.supervisorId) || b.supervisorId}</Link> : <span className="sk-faint">بدون مشرف</span>}
                      <span className="sk-load-val"><b>{b.count}</b> سجل</span>
                      <span className="sk-load-val"><b>{b.trainees}</b> متدرب</span>
                      <em className={`sk-chip ${b.oldestDays >= 7 ? "danger" : b.oldestDays >= 3 ? "warning" : ""}`}>
                        {b.oldestDays === 0 ? "اليوم" : `أقدمها ${b.oldestDays} يوم`}
                      </em>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>حمل المشرفين</h2>
                  <p>المتدربون النشطون وساعات الإشراف هذا الشهر</p>
                </div>
                <Link className="sk-link" href={`${base}/productivity`}>الإنتاجية</Link>
              </header>
              {supervisorLoad.length === 0 ? (
                <p className="sk-empty">لا يوجد مشرفون</p>
              ) : (
                <ul className="sk-load">
                  {supervisorLoad.map((sup) => (
                    <li key={sup.id}>
                      <Link href={`${base}/supervisors/${sup.id}`}>{sup.name}</Link>
                      <span className="sk-bar" aria-hidden="true"><i style={{ width: `${(sup.traineeCount / maxLoad) * 100}%` }} /></span>
                      <span className="sk-load-val"><b>{sup.traineeCount}</b> متدرب</span>
                      <span className="sk-load-val"><b>{sup.hours}</b> ساعة</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>تنبيهات للإدارة</h2>
                  <p>تنبيهات النظام غير المقروءة الموجّهة للإدارة</p>
                </div>
              </header>
              {adminAlerts.length === 0 ? (
                <p className="sk-empty">لا توجد تنبيهات جديدة</p>
              ) : (
                <ul className="sk-feed">
                  {adminAlerts.map((n) => (
                    <li key={n.id}>
                      <span>{n.message || n.title || "تنبيه"}</span>
                      <time>{timeAgo(n.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>آخر النشاطات</h2>
                  <p>{activities.length} حدث</p>
                </div>
                <Link className="sk-link" href={`${base}/operations`}>سجل التدقيق</Link>
              </header>
              {activities.length === 0 ? (
                <p className="sk-empty">لا توجد نشاطات بعد</p>
              ) : (
                <ul className="sk-feed">
                  {activities.map((a) => (
                    <li key={a.id}>
                      <span>{a.message || a.type}</span>
                      <time>{timeAgo(a.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
