"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import UiIcon from "@/components/ui/UiIcon";
import { OpenSessions } from "@/components/admin/SupervisorRoster";
import { ALERTS, CYCLE_STAGES, type AlertKey, type CycleStage, type buildMonthCycle } from "@/lib/admin/controlRoom";
import type { OpenSession } from "@/lib/admin/supervisorRoster";
import "@/styles/admin-today.css";
import "@/styles/admin-roster.css";
import "@/styles/admin-months.css";

type Cycle = ReturnType<typeof buildMonthCycle>;
const num = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
const monthName = (month: string) =>
  new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const STAGE_COLOR: Record<CycleStage, string> = {
  no_hours: "#94a3b8", trainee_drafting: "#64748b", awaiting_supervisor: "#d97706",
  ready_to_approve: "#0d40fc", awaiting_trainee: "#6a46f5", locked: "#0f8a5f",
};

export default function MonthWorkspace({ locale, month, months, cycle, locked, supervisors, openSessions, initialStage, initialAlert }: {
  locale: string; month: string; months: string[]; cycle: Cycle; locked: Record<string, boolean>;
  supervisors: Record<string, string>; openSessions: (OpenSession & { supervisorId: string })[];
  initialStage?: string; initialAlert?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<CycleStage | null>(CYCLE_STAGES.some((s) => s.key === initialStage) ? (initialStage as CycleStage) : null);
  const [alert, setAlert] = useState<AlertKey | null>(ALERTS.some((a) => a.key === initialAlert) ? (initialAlert as AlertKey) : null);
  const [query, setQuery] = useState("");
  const [lockState, setLockState] = useState(locked);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const isCurrent = month === months[0];
  const q = query.trim().toLowerCase();
  const rows = cycle.rows
    .filter((r) => (!stage || r.stage === stage) && (!alert || r.alerts.includes(alert)) && (!q || r.name.toLowerCase().includes(q) || (supervisors[r.supervisorId] || "").toLowerCase().includes(q)))
    .sort((a, b) => b.alerts.length - a.alerts.length || CYCLE_STAGES.findIndex((s) => s.key === a.stage) - CYCLE_STAGES.findIndex((s) => s.key === b.stage) || a.name.localeCompare(b.name, "ar"));
  const total = cycle.rows.length || 1;
  const lockedCount = cycle.rows.filter((r) => lockState[r.traineeId] || r.stage === "locked").length;

  const goMonth = (next: string) => router.push(`/${locale}/admin/months${next === months[0] ? "" : `?month=${next}`}`);

  async function toggleLock(traineeId: string, supervisorId: string, name: string) {
    const lock = !lockState[traineeId];
    if (!lock && !window.confirm(`إعادة فتح ${monthName(month)} لـ ${name}؟ يصبح الشهر قابلًا للتعديل من جديد.`)) return;
    setBusy(traineeId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/trainee", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traineeId, supervisorId, month, action: lock ? "lock" : "unlock" }) });
      if (!response.ok) throw new Error();
      setLockState((s) => ({ ...s, [traineeId]: lock }));
      setMessage({ tone: "ok", text: `${lock ? "أُقفل" : "أُعيد فتح"} ${monthName(month)} لـ ${name}.` });
    } catch {
      setMessage({ tone: "bad", text: "تعذّر الحفظ. حاولي مجددًا." });
    } finally {
      setBusy(null);
    }
  }
  async function syncTotals() {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/fieldwork", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "syncAllTotals" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error();
      setMessage({ tone: "ok", text: `تمت مزامنة مجاميع ساعات ${data.synced || 0} متدرب.` });
      router.refresh();
    } catch {
      setMessage({ tone: "bad", text: "تعذّرت مزامنة المجاميع." });
    } finally {
      setSyncing(false);
    }
  }
  function exportMonth() {
    const csv = "﻿" + [
      ["المتدرب", "المشرف", "الشهر", "الساعات المسجلة", "المعتمدة", "الإشراف", "المطلوب (5%)", "النقص", "نسبة الجماعي", "الحالة", "مقفل", "التنبيهات"],
      ...cycle.rows.map((r) => [r.name, supervisors[r.supervisorId] || "", month, r.logged.total, r.approved.total, r.logged.supervision, r.logged.required, r.logged.shortfall, Math.round(r.logged.groupRate * 100) + "%", CYCLE_STAGES.find((s) => s.key === r.stage)?.label || "", lockState[r.traineeId] ? "نعم" : "لا", r.alerts.map((k) => ALERTS.find((a) => a.key === k)?.label).join(" · ")]),
    ].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `الاعتماد-الشهري-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mo">
      <section className="mo-head">
        <div className="mo-head-top">
          <div>
            <h2>{monthName(month)}</h2>
            <p>{isCurrent ? "الشهر مفتوح: التنبيهات مبنية على كل ما سُجّل حتى الآن." : "شهر سابق: يُقفل بعد اعتماد المشرف وإقرار المتدرب، ويمكنك إقفاله أو إعادة فتحه."}</p>
          </div>
          <div className="mo-head-actions">
            <label className="mo-month">
              <span>الشهر</span>
              <select value={month} onChange={(e) => goMonth(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</select>
            </label>
            <button type="button" className="mo-btn" onClick={exportMonth}><UiIcon name="download" size={16} /> تصدير الشهر</button>
            <button type="button" className="mo-btn" disabled={syncing} onClick={syncTotals}><UiIcon name="activity" size={16} /> {syncing ? "جارٍ المزامنة…" : "مزامنة مجاميع الساعات"}</button>
          </div>
        </div>
        <div className="mo-stats">
          <div><span>ساعات الشهر</span><b>{num(cycle.totals.logged)}</b><small>منها {num(cycle.totals.approved)} معتمدة</small></div>
          <div><span>الإشراف من المطلوب</span><b>{num(cycle.totals.supervision)}<em> من {num(cycle.totals.required)}</em></b><small>5% من ساعات المتدربين</small></div>
          <div><span>مقفلة</span><b>{lockedCount}<em> من {cycle.rows.length}</em></b><small>متدرب أُقفل شهره</small></div>
          <div className={ALERTS.some((a) => cycle.alertCounts[a.key]) ? "is-alert" : ""}><span>تنبيهات</span><b>{ALERTS.reduce((n, a) => n + cycle.alertCounts[a.key], 0)}</b><small>{openSessions.length ? `جلسات بلا إقرار: ${openSessions.length}` : "لا جلسات معلّقة"}</small></div>
        </div>
        <div className="mo-bar" aria-hidden="true">
          {CYCLE_STAGES.map((s) => cycle.stageCounts[s.key] ? <i key={s.key} style={{ flex: cycle.stageCounts[s.key], background: STAGE_COLOR[s.key] }} /> : null)}
        </div>
      </section>

      <ol className="mo-pipeline" aria-label="مراحل الدورة الشهرية">
        {CYCLE_STAGES.map((s, i) => (
          <li key={s.key}>
            <button type="button" aria-pressed={stage === s.key} style={{ "--c": STAGE_COLOR[s.key] } as React.CSSProperties} onClick={() => setStage(stage === s.key ? null : s.key)} title={s.hint}>
              <span className="mo-step">{i + 1}</span>
              <b>{cycle.stageCounts[s.key]}</b>
              <span>{s.label}</span>
              <i style={{ width: `${(cycle.stageCounts[s.key] / total) * 100}%` }} />
            </button>
          </li>
        ))}
      </ol>

      {message && <p className={`mo-msg is-${message.tone}`} role="status">{message.text}</p>}

      {openSessions.length > 0 && <OpenSessions sessions={openSessions} />}

      <section className="sk-card">
        <header className="sk-card-head mo-table-head">
          <div><h2>المتدربون في {monthName(month)} <span className="sk-chip">{rows.length}</span></h2><p>مرتبون بالتنبيهات أولًا. اضغطي مرحلة أو تنبيهًا للتصفية.</p></div>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث باسم المتدرب أو المشرف" aria-label="بحث" />
        </header>
        <div className="mo-alerts" role="group" aria-label="التنبيهات">
          {ALERTS.filter((a) => cycle.alertCounts[a.key] > 0 || alert === a.key).map((a) => (
            <button key={a.key} type="button" className={`sk-chip ${a.tone}`} aria-pressed={alert === a.key} onClick={() => setAlert(alert === a.key ? null : a.key)}>{a.label} · {cycle.alertCounts[a.key]}</button>
          ))}
          {ALERTS.every((a) => !cycle.alertCounts[a.key]) && <span className="sk-chip success">لا توجد تنبيهات</span>}
          {(stage || alert || q) && <button type="button" className="mo-clear" onClick={() => { setStage(null); setAlert(null); setQuery(""); }}>مسح التصفية</button>}
        </div>
        {rows.length === 0 ? <p className="sk-empty">{cycle.rows.length ? "لا يوجد متدربون بهذه التصفية." : "لا يوجد متدربون في هذا الشهر."}</p> : (
          <div className="sk-table-wrap">
            <table className="sk-table mo-table">
              <thead><tr><th scope="col">المتدرب</th><th scope="col">المشرف</th><th scope="col">ساعات الشهر</th><th scope="col">الإشراف من المطلوب</th><th scope="col">الحالة</th><th scope="col">تنبيهات</th><th scope="col"><span className="mo-sr">القفل</span></th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const s = CYCLE_STAGES.find((x) => x.key === r.stage)!;
                  const isLocked = Boolean(lockState[r.traineeId]);
                  return (
                    <tr key={r.traineeId}>
                      <th scope="row"><Link href={`/${locale}/admin/trainees/${r.traineeId}`}>{r.name}</Link></th>
                      <td>{r.supervisorId ? <Link className="mo-sup" href={`/${locale}/admin/supervisors?supervisor=${encodeURIComponent(r.supervisorId)}`}>{supervisors[r.supervisorId] || "مشرف"}</Link> : <span className="sk-faint">غير مسند</span>}</td>
                      <td className="num">{num(r.logged.total)}{r.logged.total !== r.approved.total && <small> ({num(r.approved.total)} معتمدة)</small>}</td>
                      <td className="num">
                        <span className="mo-sv"><b>{num(r.logged.supervision)}</b> من {num(r.logged.required)}</span>
                        <span className="mo-meter"><i className={r.logged.shortfall ? "is-short" : ""} style={{ width: `${Math.min(100, r.logged.required ? (r.logged.supervision / r.logged.required) * 100 : 0)}%` }} /></span>
                        {r.logged.shortfall > 0 && <small className="mo-short">ينقص {num(r.logged.shortfall)}</small>}
                      </td>
                      <td><span className="mo-stage" style={{ "--c": STAGE_COLOR[r.stage] } as React.CSSProperties}>{s.label}</span>{r.sessions.unconfirmed > 0 && <small className="sk-faint sk-block">{r.sessions.unconfirmed} جلسة بلا إقرار</small>}</td>
                      <td className="sk-cell-alerts">{r.alerts.length === 0 ? <span className="sk-faint">—</span> : r.alerts.map((k) => { const a = ALERTS.find((x) => x.key === k)!; return <em key={k} className={`sk-chip ${a.tone}`}>{a.label}</em>; })}</td>
                      <td className="mo-lock-cell">
                        <button type="button" className={`mo-lock${isLocked ? " is-locked" : ""}`} disabled={busy === r.traineeId} onClick={() => toggleLock(r.traineeId, r.supervisorId, r.name)}>
                          {busy === r.traineeId ? "…" : isLocked ? "🔒 إعادة فتح" : "قفل الشهر"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="mo-note">مع بداية كل شهر جديد يُقفل الشهر السابق تلقائيًا، ويمكنك إعادة فتح شهر أي متدرب عند الحاجة.</p>
    </div>
  );
}
