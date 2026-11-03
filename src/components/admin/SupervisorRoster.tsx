"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STANDINGS, type OpenSession, type Standing, type SupervisorCard, type SupervisorHours, type TraineeStanding } from "@/lib/admin/supervisorRoster";
import "@/styles/admin-today.css";
import "@/styles/admin-roster.css";

const num = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
const monthName = (month: string) =>
  new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const farFuture = () => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() + 3); return d.toISOString().slice(0, 7); };
const ATTENTION: Standing[] = ["inactive", "near_finish", "watch"];
const ORDER: Record<Standing, number> = { inactive: 0, near_finish: 1, watch: 2, new: 3, on_track: 4 };

type Months = { current: string; previous: string };

function HoursLine({ hours }: { hours: SupervisorHours }) {
  if (!hours.total) return <span className="rs-hours-none">لا جلسات إشراف مسجلة</span>;
  return (
    <span className="rs-hours-split">
      <span>مستحقة {num(hours.payable)}</span>
      {hours.pending > 0 && <span className="is-pending">بانتظار الإقرار {num(hours.pending)}</span>}
      {hours.disputed > 0 && <span className="is-disputed">معترض عليها {num(hours.disputed)}</span>}
    </span>
  );
}

function StandingChip({ item }: { item: TraineeStanding }) {
  if (!item.standing) return null;
  const meta = STANDINGS[item.standing];
  const label = item.standing === "near_finish" && item.remaining === 0 ? "أكمل الساعات" : item.paused ? "تأجيل معتمد" : meta.label;
  return <span className={`sk-chip ${item.paused ? "" : meta.tone}`}>{label}</span>;
}

function lastLogText(item: TraineeStanding) {
  if (item.daysSinceLog === null) return "لا تسجيل خلال 3 أشهر";
  if (item.daysSinceLog <= 0) return "اليوم";
  if (item.daysSinceLog === 1) return "أمس";
  return `منذ ${item.daysSinceLog} يوم`;
}

function StandingTable({ rows, locale }: { rows: TraineeStanding[]; locale: string }) {
  return (
    <div className="sk-table-wrap">
      <table className="sk-table rs-table">
        <thead>
          <tr>
            <th scope="col">المتدرب</th>
            <th scope="col">الحالة</th>
            <th scope="col">الساعات المعتمدة</th>
            <th scope="col">المتبقي</th>
            <th scope="col">الإنهاء المتوقع</th>
            <th scope="col">آخر تسجيل ساعات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.traineeId}>
              <th scope="row">
                <Link prefetch={false} className="rs-name" href={`/${locale}/admin/trainees/${item.traineeId}`}>{item.name}</Link>
                <small className="rs-sub">{item.license}</small>
              </th>
              <td><StandingChip item={item} /></td>
              <td>
                <div className="rs-progress">
                  <span>{num(item.hours)} من {num(item.required)}</span>
                  <div className="rs-bar" role="progressbar" aria-label={`تقدم ${item.name}`} aria-valuenow={Math.round(item.percent)} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              </td>
              <td>{item.remaining ? `${num(item.remaining)} ساعة` : "—"}</td>
              <td>
                {!item.remaining ? "مكتمل الساعات" : !item.projectedFinish ? "لا معدل حديث" : item.projectedFinish > farFuture() ? "أكثر من 3 سنوات بهذا المعدل" : monthName(item.projectedFinish)}
                {item.pace > 0 && <small className="rs-sub">بمعدل {num(item.pace)} ساعة شهريًا</small>}
              </td>
              <td className={item.standing === "inactive" ? "rs-late" : item.standing === "watch" ? "rs-watch" : ""}>
                {lastLogText(item)}
                {item.lastLogged && <small className="rs-sub" dir="ltr">{item.lastLogged}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SupervisorBoard({
  cards,
  standings,
  months,
  onOpen,
}: {
  cards: SupervisorCard[];
  standings: TraineeStanding[];
  months: Months;
  onOpen: (supervisorId: string) => void;
}) {
  const [period, setPeriod] = useState<"current" | "previous">("current");
  const serving = standings.filter((item) => item.serving && item.supervisorId);
  const sum = (key: keyof SupervisorHours) => cards.reduce((total, card) => total + card.hours[period][key], 0);
  const count = (standing: Standing) => serving.filter((item) => item.standing === standing).length;

  return (
    <div className="rs">
      <section className="sk-card">
        <div className="sk-card-head">
          <div>
            <h2>المشرفون</h2>
            <p>اضغط على أي مشرف لرؤية متدربيه. الساعات هي جلسات الإشراف التي سجّلها المشرف، والجلسة الجماعية تُحسب مرة واحدة.</p>
          </div>
          <div className="sk-seg" role="group" aria-label="شهر الساعات">
            {(["current", "previous"] as const).map((key) => (
              <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>
                {monthName(months[key])}
              </button>
            ))}
          </div>
        </div>
        <div className="sk-kpis rs-kpis">
          <div className="sk-kpi">
            <span>ساعات إشراف مستحقة</span>
            <b>{num(sum("payable"))}</b>
            <small>{sum("pending") ? `بانتظار إقرار المتدربين: ${num(sum("pending"))}` : `من ${num(sum("total"))} ساعة مسجلة`}</small>
          </div>
          <div className="sk-kpi"><span>متدربون نشطون</span><b>{serving.filter((item) => !item.paused).length}</b><small>{count("on_track") + count("new")} على المسار</small></div>
          <div className="sk-kpi"><span>منقطعون</span><b className={count("inactive") ? "rs-danger" : ""}>{count("inactive")}</b><small>لم يسجّلوا ساعات منذ 14 يومًا</small></div>
          <div className="sk-kpi"><span>قريبون من الإنهاء</span><b className={count("near_finish") ? "rs-success" : ""}>{count("near_finish")}</b><small>بقي أقل من 20% أو 3 أشهر</small></div>
        </div>
      </section>

      <div className="rs-grid">
        {cards.map((card) => {
          const hours = card.hours[period];
          const flags = ATTENTION.filter((key) => card.counts[key] > 0);
          return (
            <button key={card.supervisorId} type="button" className="rs-card" onClick={() => onOpen(card.supervisorId)}>
              <span className="rs-card-head">
                <span className="rs-avatar" aria-hidden="true">{card.name.trim().slice(0, 1)}</span>
                <b>{card.name}</b>
                {card.consultant && <span className="sk-chip">مستشار</span>}
              </span>
              <span className="rs-stats">
                <span><b>{card.active}</b>متدرب نشط</span>
                <span><b>{card.graduates}</b>متخرج</span>
                <span><b className={card.seats ? "" : "rs-zero"}>{card.consultant ? "—" : card.seats}</b>مقعد متاح</span>
              </span>
              <span className="rs-hours">
                <span className="rs-hours-total"><b>{num(hours.total)}</b> ساعة إشراف · {hours.sessions} جلسة</span>
                <HoursLine hours={hours} />
              </span>
              <span className="rs-flags">
                {flags.length
                  ? flags.map((key) => <span key={key} className={`sk-chip ${STANDINGS[key].tone}`}>{STANDINGS[key].label} {card.counts[key]}</span>)
                  : card.active || card.paused
                    ? <span className="rs-ok">كل المتدربين على المسار</span>
                    : <span className="rs-ok">لا متدربين حاليًا</span>}
                {card.paused > 0 && <span className="sk-chip">تأجيل {card.paused}</span>}
                {card.openSessions.some((item) => item.state === "disputed") && (
                  <span className="sk-chip danger">اعتراض على جلسة {card.openSessions.filter((item) => item.state === "disputed").length}</span>
                )}
                {card.openSessions.some((item) => item.state === "pending") && (
                  <span className="sk-chip warning">جلسات بانتظار الإقرار {card.openSessions.filter((item) => item.state === "pending").length}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SupervisorDetail({
  card,
  standings,
  months,
  locale,
  onBack,
}: {
  card: SupervisorCard;
  standings: TraineeStanding[];
  months: Months;
  locale: string;
  onBack: () => void;
}) {
  const mine = standings.filter((item) => item.supervisorId === card.supervisorId);
  const serving = mine.filter((item) => item.serving).sort((a, b) => ORDER[a.standing!] - ORDER[b.standing!] || b.percent - a.percent);
  const attention = serving.filter((item) => item.standing && ATTENTION.includes(item.standing) && !item.paused);
  const quiet = serving.filter((item) => !attention.includes(item));
  const graduates = mine.filter((item) => item.completed);

  return (
    <div className="rs">
      <button type="button" className="rs-back" onClick={onBack}>→ كل المشرفين</button>
      <section className="sk-card">
        <div className="sk-card-head">
          <div className="rs-title">
            <span className="rs-avatar" aria-hidden="true">{card.name.trim().slice(0, 1)}</span>
            <div><h2>{card.name}</h2><p>{card.consultant ? "حساب مستشار" : `${card.seats} مقعد متاح للحجز`}</p></div>
          </div>
        </div>
        <div className="sk-kpis rs-kpis">
          <div className="sk-kpi"><span>متدربون نشطون</span><b>{card.active}</b><small>{card.paused ? `و${card.paused} في تأجيل معتمد` : "بالإشراف حاليًا"}</small></div>
          <div className="sk-kpi"><span>متخرجون</span><b>{card.graduates}</b><small>أنهوا الإشراف معه</small></div>
          <div className="sk-kpi">
            <span>ساعات {monthName(months.current)}</span>
            <b>{num(card.hours.current.total)}</b>
            <small><HoursLine hours={card.hours.current} /></small>
          </div>
          <div className="sk-kpi">
            <span>ساعات {monthName(months.previous)}</span>
            <b>{num(card.hours.previous.total)}</b>
            <small><HoursLine hours={card.hours.previous} /></small>
          </div>
        </div>
      </section>

      {card.openSessions.length > 0 && <OpenSessions sessions={card.openSessions} />}

      <section className="sk-card">
        <div className="sk-card-head">
          <div>
            <h2>يحتاج متابعتك {attention.length > 0 && <span className="sk-chip danger">{attention.length}</span>}</h2>
            <p>المنقطعون، والقريبون من الإنهاء، ومن لم يسجّل منذ أسبوع.</p>
          </div>
        </div>
        {attention.length ? <StandingTable rows={attention} locale={locale} /> : <div className="sk-empty">لا أحد يحتاج متابعة الآن. كل متدربي {card.name} يسجّلون بانتظام.</div>}
      </section>

      {quiet.length > 0 && (
        <details className="sk-card rs-more">
          <summary>على المسار الصحيح <span className="sk-chip">{quiet.length}</span></summary>
          <StandingTable rows={quiet} locale={locale} />
        </details>
      )}

      {graduates.length > 0 && (
        <details className="sk-card rs-more">
          <summary>المتخرجون <span className="sk-chip success">{graduates.length}</span></summary>
          <ul className="rs-grads">
            {graduates.map((item) => (
              <li key={item.traineeId}>
                <Link prefetch={false} href={`/${locale}/admin/trainees/${item.traineeId}`}>{item.name}</Link>
                <small>{item.license} · {num(item.hours)} ساعة</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  MONTH_LOCKED: "الشهر مقفل",
  ALREADY_CONFIRMED: "أُقرّت مسبقًا",
  NOT_ACKNOWLEDGEABLE: "لم تعد قابلة للإقرار",
  NOT_FOUND: "حُذفت الجلسة",
};

/**
 * Sessions the supervisor logged that the trainee has not confirmed. The
 * administration can confirm them on the trainee's behalf (or after checking
 * a dispute) so the supervisor's monthly approval and pay are not held up.
 */
function OpenSessions({ sessions }: { sessions: OpenSession[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const pending = sessions.filter((item) => item.state === "pending");
  const disputed = sessions.length - pending.length;

  async function confirm(ids: string[], key: string, disputedCount: number) {
    const question = disputedCount
      ? "هذه الجلسة عليها اعتراض من المتدرب. هل راجعتها وتريد اعتمادها كما سجّلها المشرف؟ سيُبلَّغ المتدرب والمشرف."
      : `اعتماد ${ids.length === 1 ? "الجلسة" : `${ids.length} جلسات`} نيابة عن المتدرب؟ تُحسب بعدها ساعات مستحقة للمشرف.`;
    if (!window.confirm(question)) return;
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/session-acknowledgment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityIds: ids }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error();
      const skipped: { reason: string }[] = data.skipped || [];
      setMessage(skipped.length
        ? { tone: "error", text: `اعتُمد ${data.confirmed.length}، وتعذّر ${skipped.length}: ${[...new Set(skipped.map((item) => ERRORS[item.reason] || item.reason))].join("، ")}` }
        : { tone: "ok", text: data.confirmed.length === 1 ? "اعتُمدت الجلسة." : `اعتُمدت ${data.confirmed.length} جلسات.` });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "تعذّر الحفظ، حاول مرة أخرى." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="sk-card">
      <div className="sk-card-head rs-ack-head">
        <div>
          <h2>
            جلسات لم يُقرّ بها المتدرب
            {disputed > 0 && <span className="sk-chip danger">اعتراض {disputed}</span>}
            {pending.length > 0 && <span className="sk-chip warning">بانتظار {pending.length}</span>}
          </h2>
          <p>
            الجلسة المعترض عليها توقف اعتماد المشرف للشهر، والجلسة غير المُقرّة لا تُحسب مستحقة. يمكنك اعتمادها نيابة عن المتدرب حتى لا يتعطّل المشرف.
          </p>
        </div>
        {pending.length > 1 && (
          <button type="button" className="rs-btn" disabled={busy !== null} onClick={() => confirm(pending.map((item) => item.activityId), "all", 0)}>
            {busy === "all" ? "جارٍ الاعتماد…" : `اعتماد كل المعلّقة (${pending.length})`}
          </button>
        )}
      </div>
      {message && <p role="status" className={`rs-ack-msg ${message.tone === "ok" ? "is-ok" : "is-error"}`}>{message.text}</p>}
      <div className="sk-table-wrap">
        <table className="sk-table rs-table">
          <thead>
            <tr>
              <th scope="col">المتدرب</th>
              <th scope="col">الجلسة</th>
              <th scope="col">الحالة</th>
              <th scope="col"><span className="sr-only">إجراء</span></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((item) => (
              <tr key={item.activityId}>
                <th scope="row">{item.traineeName}</th>
                <td>
                  <span dir="ltr">{item.date}</span>
                  <small className="rs-sub">{num(item.duration)} ساعة · {item.format === "group" ? "جماعية" : "فردية"}</small>
                </td>
                <td>
                  {item.state === "disputed"
                    ? <><span className="sk-chip danger">اعتراض</span>{item.note && <small className="rs-dispute">«{item.note}»</small>}</>
                    : <span className="sk-chip warning">بانتظار المتدرب</span>}
                </td>
                <td className="rs-ack-action">
                  <button type="button" className={`rs-btn ${item.state === "disputed" ? "is-danger" : ""}`} disabled={busy !== null} onClick={() => confirm([item.activityId], item.activityId, item.state === "disputed" ? 1 : 0)}>
                    {busy === item.activityId ? "جارٍ الاعتماد…" : item.state === "disputed" ? "اعتماد بعد المراجعة" : "اعتماد"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
