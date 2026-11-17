"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AddSupervisorButton from "@/components/admin/AddSupervisorButton";
import AdminSupervisorOperations from "@/components/admin/AdminSupervisorOperations";
import EditSupervisorPanel from "@/components/admin/EditSupervisorPanel";
import ManageSupervisorAuth from "@/components/admin/ManageSupervisorAuth";
import SupervisorHoursUpdate from "@/components/admin/SupervisorHoursUpdate";
import SupervisorImportClient from "@/components/admin/SupervisorImportClient";
import SupervisorMonthlyWork from "@/components/admin/SupervisorMonthlyWork";
import { HoursLine, OpenSessions, StandingTable } from "@/components/admin/SupervisorRoster";
import UiIcon from "@/components/ui/UiIcon";
import { STANDINGS, type Standing, type SupervisorCard, type SupervisorHours, type TraineeStanding } from "@/lib/admin/supervisorRoster";
import { normalizeProviderPhotoUrl } from "@/lib/providerPhoto";
import "@/styles/admin-today.css";
import "@/styles/admin-roster.css";
import "@/styles/admin-supervisors.css";

type Person = {
  id: string; name: string; email: string; photo?: string; isActive?: boolean; accountType?: string; availableSeats?: number;
  publicProfileId?: string; upcomingBookings: number; assignedTrainees: number; isProtectedAdmin: boolean; authUid?: string;
  [key: string]: unknown;
};
type HistoryMonth = SupervisorHours & { month: string; cumulative: number };
export interface FileData {
  supervisor: Person;
  history: { months: HistoryMonth[]; cumulative: number; payableCumulative: number };
  slots: any[];
  work: { trainees: any[]; activities: any[]; sessions: any[]; minutes: any[]; documents: any[] };
}
type Tab = "overview" | "trainees" | "hours" | "work" | "schedule";
type Filter = "all" | "attention" | "active" | "stopped" | "consultant";

const num = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
const monthName = (month: string, short = false) =>
  new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: short ? "short" : "long", year: short ? undefined : "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const ATTENTION: Standing[] = ["inactive", "near_finish", "watch"];

function Avatar({ person, size = 44 }: { person: Pick<Person, "name" | "photo">; size?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = person.photo ? normalizeProviderPhotoUrl(person.photo) : "";
  return (
    <span className="sv-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && !failed ? <img src={photo} alt="" onError={() => setFailed(true)} /> : person.name.trim().slice(0, 1)}
    </span>
  );
}

/** − n + control. The supervisor sees the same number in their portal. */
function SeatStepper({ supervisorId, initial, onChange, large }: { supervisorId: string; initial: number; onChange?: (n: number) => void; large?: boolean }) {
  const [seats, setSeats] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  async function save(next: number) {
    if (next < 0 || saving) return;
    const previous = seats;
    setSeats(next);
    setSaving(true);
    setError(false);
    try {
      const response = await fetch("/api/admin/supervisor-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seats", supervisorId, seats: next }),
      });
      if (!response.ok) throw new Error();
      onChange?.(next);
    } catch {
      setSeats(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <span className={`sv-seats${large ? " is-large" : ""}${error ? " is-error" : ""}`} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="إنقاص مقعد" disabled={saving || seats <= 0} onClick={() => void save(seats - 1)}>−</button>
      <b aria-live="polite" title={error ? "تعذّر الحفظ" : undefined}>{seats}</b>
      <button type="button" aria-label="إضافة مقعد" disabled={saving} onClick={() => void save(seats + 1)}>+</button>
    </span>
  );
}

function csv(rows: (string | number)[][]) {
  return "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SupervisorsWorkspace({ locale, people, roster, months, file, initialTab, initialImport }: {
  locale: string;
  people: Person[];
  roster: { cards: SupervisorCard[]; standings: TraineeStanding[] };
  months: { current: string; previous: string };
  file: FileData | null;
  initialTab?: string;
  initialImport?: boolean;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<"current" | "previous">("current");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [importing, setImporting] = useState(Boolean(initialImport));
  const [seatsById, setSeatsById] = useState<Record<string, number>>(() => Object.fromEntries(people.map((p) => [p.id, Number(p.availableSeats || 0)])));
  const cards = useMemo(() => new Map(roster.cards.map((c) => [c.supervisorId, c])), [roster.cards]);
  const base = `/${locale}/admin/supervisors`;
  const href = (id: string) => `${base}?supervisor=${encodeURIComponent(id)}`;

  if (file) return <SupervisorFile locale={locale} file={file} card={cards.get(file.supervisor.id)} standings={roster.standings} months={months} initialTab={initialTab} base={base} />;

  const needsAttention = (id: string) => {
    const c = cards.get(id);
    return Boolean(c && (c.counts.inactive || c.counts.watch || c.openSessions.length));
  };
  const q = query.trim().toLowerCase();
  const visible = people
    .filter((p) => !q || [p.name, p.email].some((v) => String(v || "").toLowerCase().includes(q)))
    .filter((p) => filter === "all" || (filter === "attention" ? needsAttention(p.id) : filter === "active" ? p.isActive !== false : filter === "stopped" ? p.isActive === false : p.accountType === "consultant"))
    .sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false) || Number(needsAttention(b.id)) - Number(needsAttention(a.id)) || a.name.localeCompare(b.name, "ar"));
  const holders = people.filter((p) => p.accountType !== "consultant" && p.isActive !== false);
  const totalSeats = holders.reduce((n, p) => n + (seatsById[p.id] || 0), 0);
  const sum = (key: keyof SupervisorHours) => roster.cards.reduce((n, c) => n + c.hours[period][key], 0);
  const activeTrainees = roster.standings.filter((t) => t.serving && !t.paused && t.supervisorId).length;
  const filters: [Filter, string, number][] = [
    ["all", "الكل", people.length],
    ["attention", "يحتاج متابعة", people.filter((p) => needsAttention(p.id)).length],
    ["active", "نشط", people.filter((p) => p.isActive !== false).length],
    ["stopped", "موقوف", people.filter((p) => p.isActive === false).length],
    ["consultant", "مستشار", people.filter((p) => p.accountType === "consultant").length],
  ];

  function exportMonth() {
    const month = months[period];
    download(`ساعات-المشرفين-${month}.csv`, csv([
      ["المشرف", "البريد", "الشهر", "ساعات مستحقة", "بانتظار إقرار المتدرب", "معترض عليها", "المجموع", "فردي", "جماعي", "عدد الجلسات"],
      ...people.map((p) => {
        const h = cards.get(p.id)?.hours[period];
        return [p.name, p.email, month, h?.payable || 0, h?.pending || 0, h?.disputed || 0, h?.total || 0, h?.individual || 0, h?.group || 0, h?.sessions || 0];
      }),
    ]));
  }

  return (
    <div className="sv">
      <section className="sv-head">
        <div className="sv-head-top">
          <div>
            <h2>المشرفون</h2>
            <p>كل ما يخص المشرفين في مكان واحد. اضغط على أي مشرف لفتح ملفه.</p>
          </div>
          <div className="sv-head-actions">
            <button type="button" className="sv-btn" onClick={exportMonth}><UiIcon name="download" size={16} /> كشف ساعات {monthName(months[period])}</button>
            <button type="button" className="sv-btn" aria-pressed={importing} onClick={() => setImporting((v) => !v)}><UiIcon name="upload" size={16} /> استيراد ملف مشرف</button>
            <AddSupervisorButton supervisors={people} />
          </div>
        </div>
        <div className="sv-stats">
          <div><span>مشرفون نشطون</span><b>{people.filter((p) => p.isActive !== false).length}</b><small>من {people.length} حساب</small></div>
          <div><span>مقاعد متاحة</span><b>{totalSeats}</b><small>عند {holders.filter((p) => (seatsById[p.id] || 0) > 0).length} مشرف</small></div>
          <div><span>ساعات إشراف مستحقة</span><b>{num(sum("payable"))}</b><small>{sum("pending") ? `بانتظار الإقرار: ${num(sum("pending"))}` : `من ${num(sum("total"))} ساعة`}</small></div>
          <div><span>متدربون نشطون</span><b>{activeTrainees}</b><small>مع كل المشرفين</small></div>
        </div>
      </section>

      {importing && (
        <section className="sk-card sv-import">
          <header className="sk-card-head"><div><h2>استيراد ملف مشرف</h2><p>ينشئ حساب المشرف من ملفه. بعدها حدّث ساعاته من ملفه.</p></div><button type="button" className="sv-btn" onClick={() => setImporting(false)}>إغلاق</button></header>
          <SupervisorImportClient embedded onImported={() => { setImporting(false); router.refresh(); }} />
        </section>
      )}

      <div className="sv-toolbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو البريد" aria-label="بحث في المشرفين" />
        <div className="sv-chips" role="group" aria-label="تصفية">
          {filters.map(([key, label, count]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<em>{count}</em></button>
          ))}
        </div>
        <div className="sk-seg sv-seg" role="group" aria-label="شهر الساعات">
          {(["current", "previous"] as const).map((key) => (
            <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>{monthName(months[key])}</button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? <div className="sk-card sk-empty">لا يوجد مشرفون بهذا البحث أو التصفية.</div> : (
        <div className="sv-grid">
          {visible.map((person) => {
            const card = cards.get(person.id);
            const hours = card?.hours[period];
            const flags = card ? ATTENTION.filter((k) => card.counts[k] > 0) : [];
            const disputes = card?.openSessions.filter((s) => s.state === "disputed").length || 0;
            const consultant = person.accountType === "consultant";
            return (
              // The whole card opens the file; the name is the accessible link and the seat buttons stay separate.
              <article key={person.id} className={`sv-card${person.isActive === false ? " is-stopped" : ""}`} onClick={() => router.push(href(person.id))}>
                <span className="sv-card-head">
                  <Avatar person={person} />
                  <span className="sv-card-name">
                    <Link href={href(person.id)} onClick={(e) => e.stopPropagation()}><b>{person.name}</b></Link>
                    <small>{person.isActive === false ? "موقوف" : consultant ? "مستشار" : person.email}</small>
                  </span>
                  <UiIcon name="arrowLeft" size={16} className="sv-go" />
                </span>
                <span className="sv-card-stats">
                  <span><b>{card?.active || 0}</b>متدرب نشط</span>
                  <span><b>{card?.graduates || 0}</b>متخرج</span>
                  <span className="sv-card-seats">
                    {consultant ? <b className="sv-dim">—</b> : <SeatStepper supervisorId={person.id} initial={seatsById[person.id] || 0} onChange={(n) => setSeatsById((s) => ({ ...s, [person.id]: n }))} />}
                    مقعد متاح
                  </span>
                </span>
                <span className="sv-card-hours">
                  <span><b>{num(hours?.total || 0)}</b> ساعة إشراف · {hours?.sessions || 0} جلسة</span>
                  {hours && <HoursLine hours={hours} />}
                </span>
                <span className="sv-card-flags">
                  {flags.map((k) => <em key={k} className={`sk-chip ${STANDINGS[k].tone}`}>{STANDINGS[k].label} {card!.counts[k]}</em>)}
                  {disputes > 0 && <em className="sk-chip danger">اعتراض {disputes}</em>}
                  {!flags.length && !disputes && (card?.active ? <span className="sv-ok">كل المتدربين على المسار</span> : <span className="sv-dim">لا متدربين حاليًا</span>)}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SupervisorFile({ locale, file, card, standings, months, initialTab, base }: {
  locale: string; file: FileData; card?: SupervisorCard; standings: TraineeStanding[];
  months: { current: string; previous: string }; initialTab?: string; base: string;
}) {
  const router = useRouter();
  const person = file.supervisor;
  const consultant = person.accountType === "consultant";
  const tabs: [Tab, string][] = [
    ["overview", "نظرة عامة"],
    ["trainees", "المتدربون"],
    ["hours", "الساعات"],
    ["work", "سجل العمل الشهري"],
    ["schedule", consultant ? "المواعيد" : "المواعيد والمقاعد"],
  ];
  const [tab, setTabState] = useState<Tab>(tabs.some(([k]) => k === initialTab) ? (initialTab as Tab) : "overview");
  const [dialog, setDialog] = useState<"profile" | "auth" | "hours" | null>(null);
  const [more, setMore] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const setTab = (next: Tab) => {
    setTabState(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    } catch { /* ignore */ }
  };

  const mine = standings.filter((s) => s.supervisorId === person.id);
  const serving = mine.filter((s) => s.serving).sort((a, b) => b.percent - a.percent);
  const attention = serving.filter((s) => s.standing && ATTENTION.includes(s.standing) && !s.paused);
  const graduates = mine.filter((s) => s.completed);
  const thisMonth = file.history.months.find((m) => m.month === months.current);
  const last12 = [...file.history.months].slice(0, 12).reverse();
  const peak = Math.max(1, ...last12.map((m) => m.total));

  async function toggleActive() {
    const next = person.isActive === false;
    if (!next && !window.confirm(`إيقاف حساب ${person.name}؟ لن يتمكن من الدخول حتى إعادة تفعيله.`)) return;
    setBusy(true);
    const response = await fetch("/api/admin/supervisor", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supervisorId: person.id, isActive: next }) });
    setBusy(false);
    if (response.ok) router.refresh();
    else setMessage("تعذّر تحديث حالة الحساب.");
  }
  async function remove() {
    if (person.isProtectedAdmin) return setMessage("حساب الإدارة الرئيسي محمي ولا يمكن حذفه.");
    if (person.assignedTrainees) return setMessage(`لا يمكن حذف ${person.name} قبل نقل متدربيه.`);
    if (person.upcomingBookings) return setMessage(`لا يمكن حذف ${person.name} لوجود مقابلات قادمة.`);
    if (window.prompt(`حذف حساب ${person.name} نهائيًا؟\nاكتبي كلمة حذف للتأكيد:`)?.trim() !== "حذف") return;
    setBusy(true);
    const response = await fetch("/api/admin/supervisor", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supervisorId: person.id, confirmation: "DELETE_SUPERVISOR" }) });
    setBusy(false);
    if (response.ok) router.push(base);
    else setMessage("تعذّر حذف الحساب.");
  }
  function exportHours() {
    download(`ساعات-${person.name}.csv`, csv([
      ["الشهر", "مستحقة", "بانتظار إقرار المتدرب", "معترض عليها", "المجموع", "فردي", "جماعي", "عدد الجلسات", "التراكمي"],
      ...file.history.months.map((m) => [m.month, m.payable, m.pending, m.disputed, m.total, m.individual, m.group, m.sessions, m.cumulative]),
    ]));
  }

  return (
    <div className="sv">
      <Link href={base} className="sv-back"><UiIcon name="arrowLeft" size={15} style={{ transform: "scaleX(-1)" }} /> كل المشرفين</Link>

      <section className="sv-file-head">
        <Avatar person={person} size={64} />
        <div className="sv-file-title">
          <h2>{person.name}</h2>
          <p>
            <span dir="ltr">{person.email}</span>
            {person.isActive === false ? <em className="sk-chip danger">موقوف</em> : <em className="sk-chip success">نشط</em>}
            {consultant && <em className="sk-chip">مستشار</em>}
          </p>
        </div>
        <div className="sv-file-actions">
          <button type="button" className="sv-btn is-primary" onClick={() => setDialog("hours")}><UiIcon name="upload" size={16} /> تحديث الساعات من ملف</button>
          <button type="button" className="sv-btn" onClick={() => setDialog("profile")}><UiIcon name="user" size={16} /> تعديل الصفحة التعريفية</button>
          <button type="button" className="sv-btn" onClick={() => setDialog("auth")}><UiIcon name="shield" size={16} /> الدخول والبريد</button>
          <a className="sv-btn" href={`/${locale}/supervisor/${person.publicProfileId || person.id}`} target="_blank" rel="noreferrer"><UiIcon name="eye" size={16} /> الصفحة العامة</a>
          <span className="sv-more">
            <button type="button" className="sv-btn" aria-expanded={more} onClick={() => setMore((v) => !v)}>المزيد…</button>
            {more && (
              <span className="sv-menu" role="menu">
                <button type="button" role="menuitem" disabled={busy || person.isProtectedAdmin} onClick={toggleActive}>{person.isActive === false ? "تفعيل الحساب" : "إيقاف الحساب"}</button>
                <button type="button" role="menuitem" className="is-danger" disabled={busy} onClick={remove}>حذف الحساب</button>
              </span>
            )}
          </span>
        </div>
      </section>
      {message && <p className="sv-message" role="alert">{message}</p>}

      <section className="sv-kpis">
        <div className="sv-kpi k-seats">
          <span>مقاعد متاحة</span>
          {consultant ? <b>—</b> : <SeatStepper large supervisorId={person.id} initial={Number(person.availableSeats || 0)} />}
          <small>{consultant ? "المستشار لا يستقبل متدربين" : "يظهر نفس الرقم في حساب المشرف"}</small>
        </div>
        <div className="sv-kpi k-trainees"><span>متدربون نشطون</span><b>{card?.active || 0}</b><small>{card?.paused ? `و${card.paused} في تأجيل معتمد` : `${attention.length} يحتاجون متابعة`}</small></div>
        <div className="sv-kpi k-grads"><span>متخرجون</span><b>{card?.graduates || 0}</b><small>أنهوا الإشراف معه</small></div>
        <div className="sv-kpi k-month"><span>ساعات {monthName(months.current)}</span><b>{num(thisMonth?.total || 0)}</b><small>{thisMonth ? <HoursLine hours={thisMonth} /> : "لا جلسات بعد"}</small></div>
        <div className="sv-kpi k-total"><span>الساعات التراكمية</span><b>{num(file.history.cumulative)}</b><small>الجلسة الجماعية تُحسب مرة واحدة</small></div>
      </section>

      <nav className="sv-tabs" role="tablist" aria-label="ملف المشرف">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>
            {label}
            {key === "trainees" && attention.length > 0 && <em>{attention.length}</em>}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="sv-stack">
          <section className="sk-card">
            <header className="sk-card-head"><div><h2>الساعات آخر 12 شهرًا</h2><p>جلسات الإشراف كما تُحسب للمشرف. الأزرق مستحق، والبرتقالي بانتظار إقرار المتدرب.</p></div></header>
            {last12.length === 0 ? <p className="sk-empty">لا توجد ساعات مسجلة بعد.</p> : (
              <div className="sv-chart" role="img" aria-label={`ساعات ${person.name} الشهرية`}>
                {last12.map((m) => (
                  <div key={m.month} className="sv-bar" title={`${monthName(m.month)}: ${num(m.total)} ساعة`}>
                    <span className="sv-bar-val">{num(m.total)}</span>
                    <span className="sv-bar-track">
                      {m.pending + m.disputed > 0 && <i className="is-pending" style={{ height: `${((m.pending + m.disputed) / peak) * 100}%` }} />}
                      <i style={{ height: `${(m.payable / peak) * 100}%` }} />
                    </span>
                    <span className="sv-bar-label">{monthName(m.month, true)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          {card && card.openSessions.length > 0 && <OpenSessions sessions={card.openSessions} />}
          <section className="sk-card">
            <header className="sk-card-head"><div><h2>متدربون يحتاجون متابعة {attention.length > 0 && <span className="sk-chip danger">{attention.length}</span>}</h2><p>المنقطعون، والقريبون من الإنهاء، ومن لم يسجّل منذ أسبوع.</p></div></header>
            {attention.length ? <StandingTable rows={attention} locale={locale} /> : <div className="sk-empty">كل متدربي {person.name} يسجّلون بانتظام.</div>}
          </section>
        </div>
      )}

      {tab === "trainees" && (
        <div className="sv-stack">
          <section className="sk-card">
            <header className="sk-card-head"><div><h2>المتدربون الحاليون <span className="sk-chip">{serving.length}</span></h2><p>التقدم نحو الساعات المطلوبة، والمتبقي، والإنهاء المتوقع.</p></div></header>
            {serving.length ? <StandingTable rows={serving} locale={locale} /> : <div className="sk-empty">لا متدربين حاليًا.</div>}
          </section>
          {graduates.length > 0 && (
            <section className="sk-card">
              <header className="sk-card-head"><div><h2>المتخرجون <span className="sk-chip success">{graduates.length}</span></h2></div></header>
              <ul className="rs-grads">
                {graduates.map((g) => <li key={g.traineeId}><Link href={`/${locale}/admin/trainees/${g.traineeId}`}>{g.name}</Link><small>{g.license} · {num(g.hours)} ساعة</small></li>)}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "hours" && (
        <section className="sk-card">
          <header className="sk-card-head">
            <div><h2>الساعات شهرًا بشهر</h2><p>التراكمي {num(file.history.cumulative)} ساعة، منها {num(file.history.payableCumulative)} مستحقة. الجلسة الجماعية تُحسب مرة واحدة مهما كان عدد المتدربين.</p></div>
            <button type="button" className="sv-btn" onClick={exportHours}><UiIcon name="download" size={16} /> تصدير Excel</button>
          </header>
          {file.history.months.length === 0 ? <p className="sk-empty">لا توجد ساعات مسجلة بعد.</p> : (
            <div className="sk-table-wrap">
              <table className="sk-table sv-hours">
                <thead><tr><th scope="col">الشهر</th><th scope="col">مستحقة</th><th scope="col">بانتظار الإقرار</th><th scope="col">معترض عليها</th><th scope="col">فردي</th><th scope="col">جماعي</th><th scope="col">الجلسات</th><th scope="col">التراكمي</th></tr></thead>
                <tbody>
                  {file.history.months.map((m) => (
                    <tr key={m.month} className={m.month === months.current ? "is-current" : ""}>
                      <th scope="row">{monthName(m.month)}</th>
                      <td><b>{num(m.payable)}</b></td>
                      <td className={m.pending ? "sv-warn" : "sv-dim"}>{num(m.pending)}</td>
                      <td className={m.disputed ? "sv-bad" : "sv-dim"}>{num(m.disputed)}</td>
                      <td>{num(m.individual)}</td>
                      <td>{num(m.group)}</td>
                      <td>{m.sessions}</td>
                      <td className="sv-dim">{num(m.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "work" && (
        <SupervisorMonthlyWork locale={locale} supervisor={person} trainees={file.work.trainees} activities={file.work.activities} sessions={file.work.sessions} minutes={file.work.minutes} documents={file.work.documents} />
      )}

      {tab === "schedule" && <AdminSupervisorOperations locale={locale} supervisor={person} initialSlots={file.slots} />}

      {dialog === "profile" && <EditSupervisorPanel supervisors={[person as never]} focus={person as never} onClose={() => setDialog(null)} />}
      {dialog === "auth" && <ManageSupervisorAuth supervisor={person as never} onClose={() => { setDialog(null); router.refresh(); }} />}
      {dialog === "hours" && <SupervisorHoursUpdate supervisor={person as never} onClose={() => { setDialog(null); router.refresh(); }} />}
    </div>
  );
}
