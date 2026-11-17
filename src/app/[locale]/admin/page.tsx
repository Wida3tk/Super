import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import UiIcon from "@/components/ui/UiIcon";
import { withContractDates } from "@/lib/qaba/contractDates";
import { exceedsGroupSupervisionLimit } from "@/lib/qaba/compliance";
import { ALERTS, CYCLE_STAGES, buildMonthCycle, supervisorBacklog, type AlertKey, type CycleStage } from "@/lib/admin/controlRoom";
import { buildRoster, monthStart } from "@/lib/admin/supervisorRoster";
import type { FieldworkActivity } from "@/types";
import "@/styles/admin-today.css";
import "@/styles/admin-home.css";

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
    rosterRowsSnap,
    rosterSessionsSnap,
    unreadMessagesSnap,
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
    // About three months of rows: last-logged dates, pace, and the two payroll months.
    adminDb.collection("fieldworkActivities").where("date", ">=", monthStart(currentMonth, 2))
      .select("traineeId", "supervisorId", "date", "month", "duration", "format", "status", "sessionId", "priorCreditId", "activityType", "traineeAcknowledgment").get(),
    adminDb.collection("sessions").where("month", "in", [currentMonth, previousMonth]).select("supervisorId", "type", "duration", "month", "traineeIds").get(),
    adminDb.collection("conversations").where("unread.admin", ">", 0).count().get(),
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
  const snapshots = snapshotsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const activities = activitySnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const adminAlerts = (notifsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[])
    .filter((n) => n.targetType === "admin")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 6);

  // Same rules as before the redesign; only the layout changed.
  const readyToAssign = trainees.filter(
    (t) => t.status === "onboarding" && t.onboardingStage === "contracting",
  );
  // Same filter as the «طلبات التسجيل» page, so the two counts always agree.
  const newRegistrations = allTrainees.filter(
    (t) => t.lifecycleStage === "registered" || (!t.lifecycleStage && t.registrationSource === "self_registration" && t.onboardingStage === "initial_interview"),
  );
  const over25 = snapshots.filter((s) => exceedsGroupSupervisionLimit(s));
  const atRisk = trainees.filter((t) => {
    if (t.status !== "active") return false;
    const snap = snapshots.find((s) => s.traineeId === t.id);
    return snap && (snap.absenceCount || 0) >= 3;
  });

  // ── Operational picture: supervisors, paid hours, seats, trainees who need attention ──
  const today = new Date().toISOString().slice(0, 10);
  const roster = buildRoster({
    supervisors,
    trainees,
    rows: rosterRowsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any),
    sessions: rosterSessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any),
    today,
    windowStart: monthStart(currentMonth, 2),
    currentMonth,
    previousMonth,
  });
  const sumHours = (key: "payable" | "pending" | "disputed" | "total") => roster.cards.reduce((n, c) => n + c.hours.current[key], 0);
  const seatHolders = roster.cards.filter((c) => !c.consultant);
  const openSeats = seatHolders.reduce((n, c) => n + c.seats, 0);
  const standing = (key: string) => roster.standings.filter((t) => t.standing === key && !t.paused).length;
  const nearFinish = standing("near_finish");
  const finishedHours = roster.standings.filter((t) => t.standing === "near_finish" && t.remaining === 0).length;
  const inactive = standing("inactive");
  const watch = standing("watch");
  const unreadMessages = unreadMessagesSnap.data().count;

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
  const todayLabel = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const backlogBySupervisor = new Map(backlog.map((b) => [b.supervisorId, b]));
  const attention = roster.cards
    .map((card) => {
      const b = backlogBySupervisor.get(card.supervisorId);
      const disputes = card.openSessions.filter((x) => x.state === "disputed").length;
      const reasons = [
        card.counts.inactive ? { tone: "danger", text: `${card.counts.inactive} منقطع` } : null,
        disputes ? { tone: "danger", text: `${disputes} اعتراض على جلسة` } : null,
        b && b.oldestDays >= 7 ? { tone: "warning", text: `مراجعة متأخرة ${b.oldestDays} يوم` } : null,
        card.counts.watch ? { tone: "warning", text: `${card.counts.watch} تحت المراقبة` } : null,
        card.counts.near_finish ? { tone: "success", text: `${card.counts.near_finish} قريب من الإنهاء` } : null,
      ].filter(Boolean) as { tone: string; text: string }[];
      const score = card.counts.inactive * 3 + disputes * 3 + (b && b.oldestDays >= 7 ? 2 : 0) + card.counts.watch;
      return { card, reasons, score, pending: b?.count || 0 };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);
  const decisions = [
    ...queue,
    { label: "رسائل غير مقروءة", hint: "من المتدربين والمشرفين", count: unreadMessages, href: `${base}/messages`, tone: "info", icon: "message" },
  ].filter((item) => item.count > 0);
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Riyadh" }).format(new Date()));
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";
  const hasCycleFilter = Boolean(stageFilter || alertFilter || cycleMonth !== currentMonth);
  const supervisorsHref = `${base}/trainees`;

  return (
    <AdminPageLayout locale={locale} title="الرئيسية">
      <div className="hm">
        <section className="hm-hero" aria-labelledby="hm-hello">
          <div className="hm-hello">
            <h2 id="hm-hello">{greeting}</h2>
            <p>{todayLabel} · {decisions.length ? `${decisions.reduce((n, d) => n + d.count, 0)} أمر بانتظار قرارك` : "لا شيء عاجل اليوم"}</p>
          </div>
          <div className="hm-tiles">
            <Link href={supervisorsHref} className="hm-tile t-blue">
              <span>ساعات إشراف مستحقة · {monthLabel(currentMonth)}</span>
              <b>{fmt(sumHours("payable"))}</b>
              <small>{sumHours("pending") ? `و${fmt(sumHours("pending"))} بانتظار إقرار المتدربين` : `من ${fmt(sumHours("total"))} ساعة سجّلها المشرفون`}</small>
            </Link>
            <Link href={supervisorsHref} className="hm-tile t-violet">
              <span>مقاعد متاحة</span>
              <b>{openSeats}</b>
              <small>عند {seatHolders.filter((c) => c.seats > 0).length} من {seatHolders.length} مشرف</small>
            </Link>
            <Link href={supervisorsHref} className="hm-tile t-teal">
              <span>قريبون من الإنهاء</span>
              <b>{nearFinish}</b>
              <small>{finishedHours ? `${finishedHours} أكملوا الساعات` : "بقي أقل من 20% أو 3 أشهر"}</small>
            </Link>
            <Link href={supervisorsHref} className="hm-tile t-amber">
              <span>منقطعون</span>
              <b>{inactive}</b>
              <small>{watch ? `و${watch} تحت المراقبة (7 أيام)` : "لا ساعات منذ 14 يومًا"}</small>
            </Link>
          </div>
        </section>

        <div className="hm-grid">
          <section className="sk-card hm-decide" aria-labelledby="hm-decide">
            <header className="sk-card-head"><div><h2 id="hm-decide">يحتاج قرارك</h2><p>كل بند يفتح المكان المطلوب مباشرة.</p></div></header>
            {decisions.length === 0 ? (
              <div className="hm-clear"><span aria-hidden="true">✓</span><b>كل شيء تحت السيطرة</b><small>لا توجد طلبات أو تنبيهات بانتظارك.</small></div>
            ) : (
              <ul>
                {decisions.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className={`tone-${item.tone}`}>
                      <span className="hm-ico"><UiIcon name={item.icon} size={18} /></span>
                      <span className="hm-txt"><b>{item.label}</b><small>{item.hint}</small></span>
                      <em>{item.count}</em>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sk-card hm-sups" aria-labelledby="hm-sups">
            <header className="sk-card-head">
              <div><h2 id="hm-sups">مشرفون يحتاجون متابعة</h2><p>{attention.length ? "مرتبون بحسب الأولوية" : "كل المشرفين ومتدربيهم على المسار"}</p></div>
              <Link className="sk-link" href={supervisorsHref}>كل المشرفين</Link>
            </header>
            {attention.length === 0 ? (
              <div className="hm-clear"><span aria-hidden="true">✓</span><b>لا أحد يحتاج متابعة</b><small>لا منقطعين ولا اعتراضات ولا مراجعات متأخرة.</small></div>
            ) : (
              <ul>
                {attention.map(({ card, reasons, pending }) => (
                  <li key={card.supervisorId}>
                    <Link href={`${base}/trainees?supervisor=${encodeURIComponent(card.supervisorId)}`}>
                      <span className="hm-av" aria-hidden="true">{card.name.trim().slice(0, 1)}</span>
                      <span className="hm-txt">
                        <b>{card.name}</b>
                        <small>{card.active} متدرب نشط{pending ? ` · ${pending} سجل بانتظار مراجعته` : ""}</small>
                      </span>
                      <span className="hm-reasons">{reasons.slice(0, 3).map((r) => <em key={r.text} className={`sk-chip ${r.tone}`}>{r.text}</em>)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <details className="sk-card sk-cycle hm-cycle" id="cycle" open={hasCycleFilter}>
          <summary>
            <span className="hm-sum-title">
              <b>دورة {monthLabel(cycleMonth)}</b>
              <small>{cycleMonth === currentMonth ? "الشهر مفتوح" : "الشهر السابق"} · {cycle.rows.length} متدرب · {ALERTS.reduce((n, a) => n + cycle.alertCounts[a.key], 0)} تنبيه</small>
            </span>
            <span className="hm-mini" aria-hidden="true">
              {CYCLE_STAGES.map((stage) => cycle.stageCounts[stage.key] ? <i key={stage.key} className={`tone-${stage.tone}`} style={{ flex: cycle.stageCounts[stage.key] }} /> : null)}
            </span>
            <span className="hm-sum-open">عرض الجدول</span>
          </summary>
          <div className="hm-cycle-head">
            <p>
              {cycleMonth === currentMonth
                ? "التنبيهات مبنية على كل ما سُجّل حتى الآن، قبل اعتماده."
                : "الشهر السابق: يحتاج اعتماد المشرف وإقرار المتدرب حتى يُقفل."}
            </p>
            <nav className="sk-seg" aria-label="الشهر">
              <Link href={cycleHref({ month: currentMonth })} aria-current={cycleMonth === currentMonth ? "page" : undefined}>{monthLabel(currentMonth)}</Link>
              <Link href={cycleHref({ month: previousMonth })} aria-current={cycleMonth === previousMonth ? "page" : undefined}>{monthLabel(previousMonth)}</Link>
            </nav>
          </div>
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
        </details>

        <div className="hm-grid hm-feeds">
          <section className="sk-card">
            <header className="sk-card-head">
              <div><h2>تنبيهات للإدارة</h2><p>تنبيهات النظام غير المقروءة</p></div>
              <Link className="sk-link" href={`${base}/notifications`}>كل الإشعارات</Link>
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
              <div><h2>آخر النشاطات</h2><p>{activities.length} حدث</p></div>
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
    </AdminPageLayout>
  );
}
