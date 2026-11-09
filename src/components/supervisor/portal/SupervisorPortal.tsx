"use client";

import { useEffect, useMemo, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import UiIcon from "@/components/ui/UiIcon";
import SupervisionPolicies from "@/components/policies/SupervisionPolicies";
import AvailabilityManager from "@/components/supervisor/AvailabilityManager";
import BookingsManager from "@/components/supervisor/BookingsManager";
import FieldworkReview from "@/components/supervisor/FieldworkReview";
import SeatsManager from "@/components/supervisor/SeatsManager";
import SupervisionHours, { SessionModal } from "@/components/supervisor/SupervisionHours";
import SupervisorNotifications from "@/components/supervisor/SupervisorNotifications";
import TraineeSupervisionWorkspace, { type WorkspaceTab } from "@/components/supervisor/TraineeSupervisionWorkspace";
import { ALERTS, CYCLE_STAGES, type AlertKey, type CycleStage, type buildMonthCycle } from "@/lib/admin/controlRoom";
import { traineeRules } from "@/lib/qaba/compliance";
import "@/styles/admin.css";
import "@/styles/admin-today.css";
import "@/styles/supervisor.css";

type Cycle = ReturnType<typeof buildMonthCycle>;
type Section = "today" | "trainees" | "bookings" | "policies";
type FileTab = "summary" | "sessions" | "review" | "plan" | "records" | "files";

const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const daysSince = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

interface Props {
  locale: string;
  supervisor: any;
  trainees: any[];
  bookings: any[];
  sessions: any[];
  snapshots: any[];
  notifications: any[];
  pendingActivities: any[];
  approvedActivities: any[];
  cycles: Record<string, Cycle>;
  currentMonth: string;
  previousMonth: string;
  initialSection?: string;
  initialTraineeId?: string;
}

export default function SupervisorPortal(props: Props) {
  const { locale, supervisor, trainees, bookings, currentMonth, previousMonth, cycles } = props;
  const isConsultant = supervisor.accountType === "consultant";
  const sections: { key: Section; label: string; icon: string }[] = [
    { key: "today", label: "اليوم", icon: "home" },
    { key: "trainees", label: isConsultant ? "ساعات الإشراف" : "المتدربون", icon: "users" },
    { key: "bookings", label: "المقابلات والمواعيد", icon: "calendar" },
    ...(!isConsultant ? [{ key: "policies" as Section, label: "السياسات", icon: "book" }] : []),
  ];
  const validTrainee = trainees.some((t) => t.id === props.initialTraineeId) ? props.initialTraineeId! : null;
  const [section, setSection] = useState<Section>(
    validTrainee ? "trainees" : sections.some((s) => s.key === props.initialSection) ? (props.initialSection as Section) : "today",
  );
  const [traineeId, setTraineeId] = useState<string | null>(validTrainee);
  const [fileTab, setFileTab] = useState<FileTab>("summary");
  const [month, setMonth] = useState(currentMonth);
  const [stageFilter, setStageFilter] = useState<CycleStage | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertKey | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(props.pendingActivities);
  const [logFor, setLogFor] = useState<string | null>(null);

  // Keep the address in sync so a refresh or a shared link opens the same place.
  useEffect(() => {
    const params = new URLSearchParams();
    if (section !== "today") params.set("section", section);
    if (traineeId) params.set("trainee", traineeId);
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [section, traineeId]);

  const go = (next: Section) => {
    setSection(next);
    setTraineeId(null);
    window.scrollTo({ top: 0 });
  };
  const openTrainee = (id: string, tab: FileTab = "summary") => {
    setSection("trainees");
    setTraineeId(id);
    setFileTab(tab);
    window.scrollTo({ top: 0 });
  };
  const showTrainees = (filters: { month?: string; stage?: CycleStage | null; alert?: AlertKey | null }) => {
    setMonth(filters.month || currentMonth);
    setStageFilter(filters.stage || null);
    setAlertFilter(filters.alert || null);
    go("trainees");
  };

  const unread = props.notifications.length;
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.date >= today && (!b.meetingStatus || b.meetingStatus === "pending"));
  const thisWeek = upcoming.filter((b) => b.date <= weekAhead);

  return (
    <div className="sp-portal" dir="rtl">
      <header className="sp-top">
        <div className="sp-top-inner">
          <div className="sp-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="سلوكيرا" />
            <small>{isConsultant ? "بوابة المستشار" : "بوابة المشرف"}</small>
          </div>
          <nav className="sp-nav" aria-label="أقسام البوابة">
            {sections.map((item) => (
              <button
                key={item.key}
                type="button"
                className={section === item.key ? "is-active" : ""}
                aria-current={section === item.key ? "page" : undefined}
                onClick={() => go(item.key)}
              >
                <UiIcon name={item.icon} size={17} />
                <span>{item.label}</span>
                {item.key === "today" && pending.length > 0 && <em className="sp-badge">{pending.length}</em>}
              </button>
            ))}
          </nav>
          <div className="sp-user">
            <span className="sp-user-name">{supervisor.name}</span>
            <LogoutButton locale={locale} />
          </div>
        </div>
      </header>

      <main className="sp-main">
        {section === "today" && (
          <TodaySection
            {...props}
            pending={pending}
            setPending={setPending}
            unread={unread}
            upcoming={upcoming}
            thisWeek={thisWeek}
            isConsultant={isConsultant}
            go={go}
            openTrainee={openTrainee}
            showTrainees={showTrainees}
          />
        )}

        {section === "trainees" && isConsultant && (
          <SupervisionHours
            supervisorId={supervisor.id}
            initialTrainees={trainees}
            initialSessions={props.sessions}
            initialSnapshots={props.snapshots}
            approvedActivities={props.approvedActivities}
          />
        )}

        {section === "trainees" && !isConsultant && !traineeId && (
          <TraineeList
            trainees={trainees}
            cycle={cycles[month]}
            month={month}
            currentMonth={currentMonth}
            previousMonth={previousMonth}
            setMonth={setMonth}
            stageFilter={stageFilter}
            setStageFilter={setStageFilter}
            alertFilter={alertFilter}
            setAlertFilter={setAlertFilter}
            search={search}
            setSearch={setSearch}
            openTrainee={openTrainee}
            onLogSession={() => setLogFor("")}
          />
        )}

        {section === "trainees" && !isConsultant && traineeId && (
          <TraineeFile
            {...props}
            traineeId={traineeId}
            tab={fileTab}
            setTab={setFileTab}
            pending={pending}
            setPending={setPending}
            onBack={() => setTraineeId(null)}
            onLogSession={() => setLogFor(traineeId)}
          />
        )}

        {section === "bookings" && (
          <div className="sp-stack">
            <PageHead title="المقابلات والمواعيد" hint="المقابلات الأولية والاستشارات، ومواعيدك المتاحة للحجز، ومقاعد الإشراف." />
            <BookingsManager bookings={bookings} />
            <div className="sp-ops-grid">
              <AvailabilityManager supervisorId={supervisor.id} locale={locale} />
              {!isConsultant && <SeatsManager supervisorId={supervisor.id} currentSeats={supervisor.availableSeats ?? 0} />}
            </div>
          </div>
        )}

        {section === "policies" && (
          <div className="sp-stack">
            <PageHead title="السياسات" hint="سياسات الإشراف المعتمدة في سلوكيرا." />
            <SupervisionPolicies audience="supervisor" />
          </div>
        )}
      </main>

      {logFor !== null && (
        <SessionModal
          trainees={trainees}
          defaultTraineeId={logFor}
          onClose={() => setLogFor(null)}
          onSubmit={async (data) => {
            const res = await fetch("/api/supervisor/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result.error || "حدث خطأ");
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function PageHead({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="sp-head">
      <div>
        <h1>{title}</h1>
        {hint && <p>{hint}</p>}
      </div>
      {children && <div className="sp-head-actions">{children}</div>}
    </div>
  );
}

/* ───────────────────────── Today ───────────────────────── */

function TodaySection({
  supervisor, trainees, cycles, currentMonth, previousMonth, notifications, pending, setPending, approvedActivities,
  upcoming, thisWeek, isConsultant, go, openTrainee, showTrainees,
}: Props & {
  pending: any[];
  setPending: (fn: (rows: any[]) => any[]) => void;
  unread: number;
  upcoming: any[];
  thisWeek: any[];
  isConsultant: boolean;
  go: (s: Section) => void;
  openTrainee: (id: string, tab?: FileTab) => void;
  showTrainees: (f: { month?: string; stage?: CycleStage | null; alert?: AlertKey | null }) => void;
}) {
  const current = cycles[currentMonth];
  const previous = cycles[previousMonth];
  const oldest = pending.reduce((max, row) => Math.max(max, daysSince(row.updatedAt || row.createdAt)), 0);
  const disputed = [...current.rows, ...previous.rows].reduce((n, r) => n + r.sessions.disputed, 0);
  const readyPrev = previous.stageCounts.ready_to_approve;
  const readyCurrent = current.stageCounts.ready_to_approve;
  const awaitingTrainee = previous.stageCounts.awaiting_trainee;
  const now = new Date();

  const queue = isConsultant ? [] : [
    { label: "ساعات بانتظار مراجعتك", hint: pending.length ? `أقدمها منذ ${oldest === 0 ? "اليوم" : `${oldest} يوم`}` : "راجعت كل ما أُرسل", count: pending.length, tone: oldest >= 7 ? "danger" : "warning", icon: "clock", onClick: () => document.getElementById("review")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "اعتراضات على جلسات سجّلتها", hint: "اعترض المتدرب على تاريخ أو مدة أو نوع الجلسة", count: disputed, tone: "danger", icon: "alert", onClick: () => showTrainees({ alert: "session_disputed", month: current.alertCounts.session_disputed ? currentMonth : previousMonth }) },
    { label: `اعتماد ${monthLabel(previousMonth)}`, hint: awaitingTrainee ? `${awaitingTrainee} بانتظار إقرار المتدرب` : "كل السجلات معتمدة ولم يُعتمد الشهر", count: readyPrev, tone: "info", icon: "calendarCheck", onClick: () => showTrainees({ month: previousMonth, stage: "ready_to_approve" }) },
    { label: "إشراف أقل من 5% هذا الشهر", hint: "بحسب ما سُجّل حتى الآن", count: current.alertCounts.supervision_below_rate, tone: "warning", icon: "target", onClick: () => showTrainees({ alert: "supervision_below_rate" }) },
    { label: "بلا اتصال فردي هذا الشهر", hint: "ساعة إشراف فردية على الأقل شهريًا", count: current.alertCounts.no_individual_contact, tone: "warning", icon: "users", onClick: () => showTrainees({ alert: "no_individual_contact" }) },
    { label: "جاهزون لاعتماد هذا الشهر", hint: "كل سجلاتهم معتمدة", count: readyCurrent, tone: "info", icon: "check", onClick: () => showTrainees({ stage: "ready_to_approve" }) },
  ];
  const queueOpen = queue.filter((q) => q.count > 0);

  return (
    <div className="sp-stack">
      <PageHead
        title={`مرحبًا، ${supervisor.name}`}
        hint={`${now.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })} · ${queueOpen.length ? `${queueOpen.reduce((n, q) => n + q.count, 0)} عنصر يحتاج إجراء` : "لا توجد عناصر عاجلة"}`}
      />

      {!isConsultant && (
        <section className="sk-card sk-queue" aria-labelledby="sp-queue">
          <header className="sk-card-head"><div><h2 id="sp-queue">يحتاج إجراء</h2><p>كل بند يفتح القائمة المطلوبة مباشرة.</p></div></header>
          <ul>
            {queue.map((item) => (
              <li key={item.label} className={item.count ? "" : "is-clear"}>
                <a href="#" onClick={(e) => { e.preventDefault(); item.onClick(); }}>
                  <span className={`sk-queue-icon ${item.count ? item.tone : ""}`}><UiIcon name={item.icon} size={18} /></span>
                  <span className="sk-queue-text"><b>{item.label}</b><small>{item.hint}</small></span>
                  <span className={`sk-queue-count ${item.count ? item.tone : ""}`}>{item.count || "لا شيء"}</span>
                  <UiIcon name="arrowLeft" size={16} className="sk-queue-go" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sk-kpis" aria-label="مؤشرات">
        <div className="sk-kpi"><span>متدربون نشطون</span><b>{trainees.length}</b><small>{supervisor.availableSeats ?? 0} مقعد متاح للحجز</small></div>
        <div className="sk-kpi"><span>إشراف {monthLabel(currentMonth)}</span><b>{fmt(current.totals.supervision)}<em className="sk-kpi-of"> من {fmt(current.totals.required)}</em></b><small>ساعة إشراف مقابل 5% المطلوبة</small></div>
        <div className="sk-kpi"><span>ساعات المتدربين هذا الشهر</span><b>{fmt(current.totals.logged)}</b><small>منها {fmt(current.totals.approved)} معتمدة</small></div>
        <div className="sk-kpi"><span>مقابلات هذا الأسبوع</span><b>{thisWeek.length}</b><small>{upcoming.length} مقابلة قادمة إجمالًا</small></div>
      </section>

      {!isConsultant && (
        <section className="sk-card" id="review" aria-labelledby="sp-review">
          <header className="sk-card-head">
            <div><h2 id="sp-review">ساعات بانتظار مراجعتك</h2><p>اعتمد، أو اطلب تعديلًا، أو ارفض مع ملاحظة تظهر للمتدرب.</p></div>
          </header>
          <div className="sp-embed">
            <FieldworkReview
              initialActivities={pending}
              trainees={trainees}
              onReviewed={(id) => setPending((rows) => rows.filter((r) => r.id !== id))}
            />
          </div>
        </section>
      )}

      <div className="sp-side-grid">
          <section className="sk-card">
            <header className="sk-card-head">
              <div><h2>المقابلات القادمة</h2><p>{thisWeek.length ? `${thisWeek.length} خلال 7 أيام` : "لا مقابلات خلال 7 أيام"}</p></div>
              <button type="button" className="sk-link sp-linkbtn" onClick={() => go("bookings")}>كل المقابلات</button>
            </header>
            {upcoming.length === 0 ? <p className="sk-empty">لا توجد مقابلات قادمة</p> : (
              <ul className="sk-feed">
                {upcoming.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <span><b>{b.studentName}</b> · {b.bookingType === "consultation" ? "استشارة" : "مقابلة أولية"}</span>
                    <time>{b.date} · {b.time}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {notifications.length > 0 && (
            <section className="sk-card">
              <header className="sk-card-head"><div><h2>الإشعارات</h2><p>{notifications.length} غير مقروء</p></div></header>
              <div className="sp-embed sp-notifs">
                <SupervisorNotifications notifications={notifications} supervisorId={supervisor.id} />
              </div>
            </section>
          )}

          {!isConsultant && (
            <section className="sk-card">
              <header className="sk-card-head">
                <div><h2>أقرب المتدربين من هدف الإشراف</h2><p>الإشراف المعتمد تراكميًا مقابل المطلوب</p></div>
                <button type="button" className="sk-link sp-linkbtn" onClick={() => go("trainees")}>كل المتدربين</button>
              </header>
              <SupervisionTargets trainees={trainees} approved={approvedActivities} openTrainee={openTrainee} />
            </section>
          )}
      </div>
    </div>
  );
}

/** Cumulative approved supervision per trainee against the credential target (same rows the old roster used). */
function SupervisionTargets({ trainees, approved, openTrainee }: { trainees: any[]; approved: any[]; openTrainee: (id: string) => void }) {
  const rows = useMemo(() => {
    const byTrainee: Record<string, number> = {};
    for (const a of approved) {
      if (!String(a.activityType || "").startsWith("supervision_")) continue;
      byTrainee[a.traineeId] = (byTrainee[a.traineeId] || 0) + Number(a.duration || 0);
    }
    return trainees
      .map((t) => {
        const target = traineeRules(t).supervisionTarget;
        const done = Math.round((byTrainee[t.id] || 0) * 10) / 10;
        return { id: t.id, name: t.name, done, target, pct: target ? Math.round((done / target) * 100) : 0 };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [trainees, approved]);
  if (!rows.length) return <p className="sk-empty">لا يوجد متدربون مسندون</p>;
  return (
    <ul className="sk-progress">
      {rows.map((t) => (
        <li key={t.id}>
          <button type="button" className="sk-progress-name sp-namebtn" onClick={() => openTrainee(t.id)}>{t.name}</button>
          <span className="sk-bar" aria-hidden="true"><i className={t.pct >= 100 ? "done" : t.pct >= 75 ? "near" : ""} style={{ width: `${Math.min(t.pct, 100)}%` }} /></span>
          <span className="sk-progress-val">{fmt(t.done)} من {t.target} · {t.pct}%</span>
          <span className="sk-progress-tags">{t.pct >= 100 && <em className="sk-chip success">مكتمل</em>}</span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── Trainees ───────────────────────── */

function TraineeList({
  trainees, cycle, month, currentMonth, previousMonth, setMonth, stageFilter, setStageFilter,
  alertFilter, setAlertFilter, search, setSearch, openTrainee, onLogSession,
}: {
  trainees: any[];
  cycle: Cycle;
  month: string;
  currentMonth: string;
  previousMonth: string;
  setMonth: (m: string) => void;
  stageFilter: CycleStage | null;
  setStageFilter: (s: CycleStage | null) => void;
  alertFilter: AlertKey | null;
  setAlertFilter: (a: AlertKey | null) => void;
  search: string;
  setSearch: (s: string) => void;
  openTrainee: (id: string, tab?: FileTab) => void;
  onLogSession: () => void;
}) {
  const license = new Map(trainees.map((t) => [t.id, t.license || "QASP-S"]));
  const q = search.trim().toLowerCase();
  const rows = cycle.rows
    .filter((r) => (!stageFilter || r.stage === stageFilter) && (!alertFilter || r.alerts.includes(alertFilter)))
    .filter((r) => !q || `${r.name} ${license.get(r.traineeId)}`.toLowerCase().includes(q))
    .sort((a, b) => b.alerts.length - a.alerts.length || b.pendingReview - a.pendingReview || a.name.localeCompare(b.name, "ar"));

  return (
    <div className="sp-stack">
      <PageHead title="المتدربون" hint={`${trainees.length} متدرب مسند إليك · اضغط على المتدرب لفتح ملفه: الجلسات، الساعات، الاعتماد الشهري، الخطة والتقييم.`}>
        <button type="button" className="sp-btn sp-btn-primary" onClick={onLogSession}>
          <UiIcon name="plus" size={16} /> تسجيل جلسة إشراف
        </button>
      </PageHead>

      <section className="sk-card sk-cycle">
        <header className="sk-card-head">
          <div>
            <h2>دورة {monthLabel(month)}</h2>
            <p>{month === currentMonth ? "الشهر مفتوح: التنبيهات حسب ما سُجّل حتى الآن." : "الشهر السابق: اعتمده لكل متدرب حتى يُقرّ به ويُقفل."}</p>
          </div>
          <div className="sp-seg" role="group" aria-label="الشهر">
            {[currentMonth, previousMonth].map((m) => (
              <button key={m} type="button" aria-pressed={month === m} onClick={() => { setMonth(m); setStageFilter(null); setAlertFilter(null); }}>{monthLabel(m)}</button>
            ))}
          </div>
        </header>

        <ol className="sk-pipeline" aria-label="مراحل الدورة الشهرية">
          {CYCLE_STAGES.map((stage) => (
            <li key={stage.key}>
              <button
                type="button"
                className={`tone-${stage.tone}${stageFilter === stage.key ? " is-active" : ""}`}
                aria-pressed={stageFilter === stage.key}
                title={stage.hint}
                onClick={() => setStageFilter(stageFilter === stage.key ? null : stage.key)}
              >
                <b>{cycle.stageCounts[stage.key]}</b>
                <span>{stage.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="sk-alerts sp-tools">
          <input className="sp-search" type="search" value={search} placeholder="بحث بالاسم أو الرخصة" aria-label="بحث" onChange={(e) => setSearch(e.target.value)} />
          {ALERTS.filter((a) => cycle.alertCounts[a.key] > 0 || alertFilter === a.key).map((a) => (
            <button key={a.key} type="button" aria-pressed={alertFilter === a.key} className={`sk-chip ${a.tone}${alertFilter === a.key ? " is-active" : ""}`} onClick={() => setAlertFilter(alertFilter === a.key ? null : a.key)}>
              {a.label} · {cycle.alertCounts[a.key]}
            </button>
          ))}
          {(stageFilter || alertFilter) && <button type="button" className="sk-link sp-linkbtn" onClick={() => { setStageFilter(null); setAlertFilter(null); }}>إلغاء التصفية</button>}
        </div>

        {rows.length === 0 ? (
          <p className="sk-empty">{cycle.rows.length ? "لا يوجد متدربون بهذه التصفية" : "لا يوجد متدربون مسندون إليك حاليًا"}</p>
        ) : (
          <div className="sk-table-wrap">
            <table className="sk-table sp-rows">
              <thead>
                <tr>
                  <th scope="col">المتدرب</th>
                  <th scope="col">ساعات الشهر</th>
                  <th scope="col">الإشراف من المطلوب</th>
                  <th scope="col">بانتظار مراجعتك</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">تنبيهات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const stage = CYCLE_STAGES.find((s) => s.key === r.stage)!;
                  return (
                    <tr key={r.traineeId} onClick={() => openTrainee(r.traineeId)}>
                      <th scope="row">
                        <button type="button" className="sp-namebtn" onClick={(e) => { e.stopPropagation(); openTrainee(r.traineeId); }}>{r.name}</button>
                        <small className="sp-sub">{license.get(r.traineeId)}</small>
                      </th>
                      <td data-label="ساعات الشهر" className="num">{fmt(r.logged.total)}{r.logged.total !== r.approved.total && <small> ({fmt(r.approved.total)} معتمدة)</small>}</td>
                      <td data-label="الإشراف من المطلوب" className="num">{fmt(r.logged.supervision)} <small>من {fmt(r.logged.required)}</small>{r.logged.shortfall > 0 && <small className="short"> ينقص {fmt(r.logged.shortfall)}</small>}</td>
                      <td data-label="بانتظار مراجعتك" className="num">
                        {r.pendingReview ? <button type="button" className="sk-chip warning sp-chipbtn" onClick={(e) => { e.stopPropagation(); openTrainee(r.traineeId, "review"); }}>{r.pendingReview} سجل</button> : <span className="sk-faint">—</span>}
                      </td>
                      <td data-label="الحالة">
                        <span className={`sk-chip ${stage.tone === "muted" ? "" : stage.tone}`}>{stage.label}</span>
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
    </div>
  );
}

/* ───────────────────────── Trainee file ───────────────────────── */

function TraineeFile({
  supervisor, trainees, cycles, currentMonth, sessions, snapshots, approvedActivities, pending, setPending,
  traineeId, tab, setTab, onBack, onLogSession,
}: Props & {
  traineeId: string;
  tab: FileTab;
  setTab: (t: FileTab) => void;
  pending: any[];
  setPending: (fn: (rows: any[]) => any[]) => void;
  onBack: () => void;
  onLogSession: () => void;
}) {
  const trainee = trainees.find((t) => t.id === traineeId)!;
  const rules = traineeRules(trainee);
  const row = cycles[currentMonth].rows.find((r) => r.traineeId === traineeId);
  const stage = row && CYCLE_STAGES.find((s) => s.key === row.stage);
  const traineePending = pending.filter((a) => a.traineeId === traineeId);
  const tabs: { key: FileTab; label: string; count?: number }[] = [
    { key: "summary", label: "الملخص والاعتماد الشهري" },
    { key: "sessions", label: "جلسات الإشراف" },
    { key: "review", label: "مراجعة الساعات", count: traineePending.length },
    { key: "plan", label: "الخطة والتقييم" },
    { key: "records", label: "المحاضر وكل الساعات" },
    { key: "files", label: "الاتفاقية والمستندات" },
  ];
  const workspaceTabs: Partial<Record<FileTab, readonly WorkspaceTab[]>> = {
    summary: ["overview"],
    plan: ["plan", "assessment", "reports", "improvement"],
    records: ["meetings", "hours"],
    files: ["agreement", "documents"],
  };

  return (
    <div className="sp-stack">
      <button type="button" className="sp-back" onClick={onBack}>
        <UiIcon name="arrowLeft" size={15} style={{ transform: "scaleX(-1)" }} /> كل المتدربين
      </button>
      <div className="sp-head sp-file-head">
        <div className="sp-avatar" aria-hidden="true">{String(trainee.name || "م").slice(0, 2)}</div>
        <div className="sp-file-title">
          <h1>{trainee.name}</h1>
          <p>
            {rules.label} ({trainee.license || "QASP-S"}) · {rules.total} ساعة خبرة · {rules.supervisionTarget} ساعة إشراف
            {rules.credential === "QBA" && rules.contractDateMissing && " · تاريخ بدء الميدان غير مسجّل، فيُعتمد متطلب 2000"}
          </p>
        </div>
        <div className="sp-head-actions">
          <button type="button" className="sp-btn sp-btn-primary" onClick={onLogSession}><UiIcon name="plus" size={16} /> تسجيل جلسة</button>
          <a className="sp-btn" href={`/api/supervisor/trainee-export?traineeId=${traineeId}`}>تصدير قالب سلوكيرا</a>
        </div>
      </div>

      {row && (
        <section className="sk-kpis sp-file-kpis" aria-label={`ملخص ${monthLabel(currentMonth)}`}>
          <div className="sk-kpi"><span>ساعات {monthLabel(currentMonth)}</span><b>{fmt(row.logged.total)}</b><small>منها {fmt(row.approved.total)} معتمدة · النطاق 20–140</small></div>
          <div className="sk-kpi"><span>الإشراف هذا الشهر</span><b>{fmt(row.logged.supervision)}<em className="sk-kpi-of"> من {fmt(row.logged.required)}</em></b><small>{row.logged.shortfall ? `ينقص ${fmt(row.logged.shortfall)} ساعة` : "يستوفي 5%"}</small></div>
          <div className="sk-kpi"><span>الإشراف الجماعي</span><b>{Math.round(row.logged.groupRate * 100)}%</b><small>الحد الأعلى 50% · {row.hasIndividualContact ? "يوجد اتصال فردي" : "لا اتصال فردي بعد"}</small></div>
          <div className="sk-kpi"><span>حالة الشهر</span><b className="sp-kpi-chip">{stage && <span className={`sk-chip ${stage.tone === "muted" ? "" : stage.tone}`}>{stage.label}</span>}</b><small>{row.alerts.length ? row.alerts.map((k) => ALERTS.find((a) => a.key === k)!.label).join(" · ") : "لا توجد تنبيهات"}</small></div>
        </section>
      )}

      <div className="sp-tabs" role="tablist" aria-label="أقسام ملف المتدرب">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-active" : ""} onClick={() => setTab(t.key)}>
            {t.label}{!!t.count && <em className="sp-badge">{t.count}</em>}
          </button>
        ))}
      </div>

      <div className="sp-panel">
        {workspaceTabs[tab] && <TraineeSupervisionWorkspace key={`${traineeId}-${tab}`} trainees={trainees} supervisor={supervisor} focusTraineeId={traineeId} onlyTabs={workspaceTabs[tab]} />}
        {tab === "sessions" && (
          <SupervisionHours
            key={traineeId}
            supervisorId={supervisor.id}
            initialTrainees={trainees}
            initialSessions={sessions}
            initialSnapshots={snapshots}
            approvedActivities={approvedActivities}
            focusTraineeId={traineeId}
          />
        )}
        {tab === "review" && (
          <FieldworkReview
            key={traineeId}
            initialActivities={traineePending}
            trainees={trainees}
            onReviewed={(id) => setPending((rows) => rows.filter((r) => r.id !== id))}
          />
        )}
      </div>
    </div>
  );
}
