"use client";

import Link from "next/link";
import { useState } from "react";
import { STANDINGS, type Standing, type SupervisorCard, type SupervisorHours, type TraineeStanding } from "@/lib/admin/supervisorRoster";
import "@/styles/admin-today.css";
import "@/styles/admin-roster.css";

const num = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
const monthName = (month: string) =>
  new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
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
                {item.projectedFinish ? monthName(item.projectedFinish) : item.remaining ? "—" : "مكتمل الساعات"}
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
            <small>{sum("pending") ? `و${num(sum("pending"))} بانتظار إقرار المتدربين` : `من ${num(sum("total"))} ساعة مسجلة`}</small>
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
