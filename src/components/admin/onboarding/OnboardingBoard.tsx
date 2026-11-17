"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import UiIcon from "@/components/ui/UiIcon";
import { COLUMNS, MOVEMENT, daysSince, previousStage, type Column, type Movement } from "@/lib/admin/onboarding";
import "@/styles/admin-today.css";
import "@/styles/admin-onboarding.css";

export interface BoardTrainee {
  id: string; name: string; email: string; phone: string; license: string; column: Column; onboardingStage: string | null;
  since: string; createdAt: string; interviewSupervisorId: string; traineeIntent: string; supervisorIntent: string;
  /** Initial interviews booked (not cancelled), oldest first, and how many the trainee may have. */
  interviews: { supervisorId: string; date: string; state: string }[];
  allowance: number;
  /** The latest interview was missed: it is rescheduled and does not count. */
  reschedule: boolean;
}
type Supervisor = { id: string; name: string; active: boolean; consultant: boolean; seats: number };

const monthName = (month: string, short = false) =>
  new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: "long", year: short ? undefined : "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const INTENT: Record<string, { label: string; tone: string }> = {
  continue: { label: "يرغب بالاستمرار", tone: "ok" },
  decline: { label: "لا يرغب", tone: "bad" },
  pending: { label: "لم يقرر", tone: "wait" },
};
const STAGE_LABEL: Record<string, string> = { initial_interview: "المقابلة", post_interview: "القرار", contracting: "التعاقد", registered: "طلب جديد" };

async function patch(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/trainee", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || "FAILED");
  return data;
}

export default function OnboardingBoard({ locale, trainees, supervisors, months, movement }: {
  locale: string; trainees: BoardTrainee[]; supervisors: Supervisor[]; months: string[]; movement: Record<string, Movement>;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(trainees);
  const [month, setMonth] = useState(months[0]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; href?: string; tone?: "ok" | "bad" } | null>(null);
  const [assigning, setAssigning] = useState<BoardTrainee | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const supName = useMemo(() => new Map(supervisors.map((s) => [s.id, s.name])), [supervisors]);
  const q = query.trim().toLowerCase();
  const visible = cards.filter((c) => !q || [c.name, c.email, c.phone].some((v) => v.toLowerCase().includes(q)));
  const current = movement[month];
  const prior = movement[months[months.indexOf(month) + 1]];
  const peak = Math.max(1, ...months.flatMap((m) => MOVEMENT.map((k) => movement[m]?.[k.key] || 0)));

  function say(text: string, tone: "ok" | "bad" = "ok", href?: string) {
    setToast({ text, tone, href });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 6000);
  }
  async function act(card: BoardTrainee, label: string, body: Record<string, unknown>, apply: (c: BoardTrainee) => BoardTrainee | null) {
    setBusy(card.id);
    setMenu(null);
    try {
      await patch({ traineeId: card.id, ...body });
      setCards((list) => list.flatMap((c) => (c.id === card.id ? (apply(c) ? [apply(c)!] : []) : [c])));
      say(`${card.name}: ${label}`);
      router.refresh();
    } catch {
      say(`تعذّر تنفيذ «${label}» لـ ${card.name}. حاولي مجددًا.`, "bad");
    } finally {
      setBusy(null);
    }
  }
  const moveTo = (card: BoardTrainee, stage: Column, label: string) =>
    act(card, label, { action: "updateLifecycle", stage, reason: `لوحة الانضمام: ${label}` }, (c) => ({ ...c, column: stage, since: new Date().toISOString() }));

  return (
    <div className="ob">
      <section className="ob-head">
        <div className="ob-head-top">
          <div>
            <h2>الانضمام</h2>
            <p>رحلة المتدرب الجديد خطوة بخطوة. انقلي كل متدرب للمرحلة التالية بزر واحد، وعند الإسناد ينتقل إلى قائمة المتدربين.</p>
          </div>
          <label className="ob-month">
            <span>حركة شهر</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </label>
        </div>
        <div className="ob-moves">
          {MOVEMENT.map((k) => {
            const n = current?.[k.key] || 0;
            const was = prior?.[k.key];
            const diff = was === undefined ? null : n - was;
            return (
              <div key={k.key} style={{ "--c": k.color } as React.CSSProperties}>
                <span>{k.label}</span>
                <b>{n}</b>
                <small>{diff === null ? "—" : diff === 0 ? "مثل الشهر السابق" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} عن الشهر السابق`}</small>
              </div>
            );
          })}
        </div>
      </section>

      <div className="ob-toolbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو البريد أو الجوال" aria-label="بحث في المتقدمين" />
        <span className="ob-total">{cards.filter((c) => c.column !== "declined").length} في رحلة الانضمام</span>
      </div>

      <div className="ob-board" role="list" aria-label="مراحل الانضمام">
        {COLUMNS.map((col, index) => {
          const items = visible.filter((c) => c.column === col.key).sort((a, b) => String(a.since).localeCompare(String(b.since)));
          return (
            <section key={col.key} className={`ob-col${col.key === "declined" ? " is-exit" : ""}`} style={{ "--c": col.color } as React.CSSProperties} role="listitem" aria-label={col.label}>
              <header>
                <span className="ob-step">{col.key === "declined" ? "×" : index + 1}</span>
                <div><b>{col.label}</b><small>{col.hint}</small></div>
                <em>{items.length}</em>
              </header>
              <div className="ob-cards">
                {items.length === 0 && <p className="ob-empty">{col.key === "declined" ? "لا أحد متوقف" : "لا أحد في هذه المرحلة"}</p>}
                {items.map((card) => {
                  const days = daysSince(card.since);
                  const stale = days !== null && days >= 7;
                  const back = previousStage(card.column);
                  return (
                    <article key={card.id} className={`ob-card${busy === card.id ? " is-busy" : ""}`}>
                      <div className="ob-card-top">
                        <span className="ob-av" aria-hidden="true">{card.name.trim().slice(0, 1)}</span>
                        <div className="ob-card-name">
                          <Link href={`/${locale}/admin/trainees/${card.id}`}>{card.name}</Link>
                          <small dir="ltr">{card.phone || card.email}</small>
                        </div>
                        <button type="button" className="ob-dots" aria-label={`خيارات ${card.name}`} aria-expanded={menu === card.id} onClick={() => setMenu(menu === card.id ? null : card.id)}>⋯</button>
                        {menu === card.id && (
                          <span className="ob-menu" role="menu">
                            <Link role="menuitem" href={`/${locale}/admin/trainees/${card.id}`}>فتح الملف</Link>
                            {back && <button role="menuitem" type="button" onClick={() => moveTo(card, back, `إرجاع إلى ${STAGE_LABEL[back]}`)}>إرجاع إلى {STAGE_LABEL[back]}</button>}
                            {card.column === "post_interview" && card.onboardingStage !== "admin_review" && <button role="menuitem" type="button" onClick={() => act(card, "تحويل لمراجعة الإدارة", { action: "updateOnboarding", stage: "admin_review" }, (c) => ({ ...c, onboardingStage: "admin_review" }))}>تحويل لمراجعة الإدارة</button>}
                            {card.interviews.length >= card.allowance && <button role="menuitem" type="button" onClick={() => act(card, "سُمح بمقابلة إضافية", { action: "grantInterview" }, (c) => ({ ...c, allowance: c.allowance + 1 }))}>السماح بمقابلة إضافية</button>}
                            {(card.column === "post_interview" || card.column === "initial_interview") && <button role="menuitem" type="button" className="is-danger" onClick={() => act(card, "لم يتم الاتفاق", { action: "updateOnboarding", stage: "interview_declined" }, (c) => ({ ...c, column: "declined", onboardingStage: "interview_declined", since: new Date().toISOString() }))}>لم يتم الاتفاق</button>}
                          </span>
                        )}
                      </div>
                      <div className="ob-tags">
                        {card.license && <span className="ob-tag">{card.license}</span>}
                        {days !== null && <span className={`ob-tag${stale ? " is-stale" : ""}`}>{days === 0 ? "اليوم" : `منذ ${days} يوم`}</span>}
                        {card.interviews.length > 0 && <span className={`ob-tag${card.interviews.length >= card.allowance ? " is-full" : " is-count"}`} title={card.interviews.map((i, n) => `المقابلة ${n + 1}: ${supName.get(i.supervisorId) || "مشرف"} ${i.date}`).join(" · ")}>مقابلة {card.interviews.length} من {card.allowance}</span>}
                        {card.reschedule && <span className="ob-tag is-stale" title="غاب عن المقابلة، ولا تُحسب من المقابلتين">غاب: يحتاج إعادة جدولة</span>}
                        {card.onboardingStage === "admin_review" && <span className="ob-tag is-review">مراجعة الإدارة</span>}
                        {card.onboardingStage === "ready_assignment" && <span className="ob-tag is-ready">جاهز للإسناد</span>}
                      </div>
                      {(card.interviewSupervisorId || card.traineeIntent || card.supervisorIntent || card.interviews.length > 0) && card.column !== "registered" && (
                        <div className="ob-meta">
                          {card.interviews.length > 1
                            ? <span>المقابلات: {card.interviews.map((i, n) => <b key={n}>{n ? " ← " : ""}{supName.get(i.supervisorId) || "مشرف"}</b>)}</span>
                            : card.interviewSupervisorId && <span>المقابلة مع <b>{supName.get(card.interviewSupervisorId) || "مشرف"}</b></span>}
                          {card.column === "declined" && card.interviews.length < card.allowance && <span className="ob-second">يحق له مقابلة ثانية مع مشرف آخر دون رسوم إضافية</span>}
                          {card.column === "post_interview" && (card.traineeIntent || card.supervisorIntent) && (
                            <span className="ob-intents">
                              {card.traineeIntent && <em className={`is-${INTENT[card.traineeIntent]?.tone || "wait"}`}>المتدرب: {INTENT[card.traineeIntent]?.label || card.traineeIntent}</em>}
                              {card.supervisorIntent && <em className={`is-${INTENT[card.supervisorIntent]?.tone || "wait"}`}>المشرف: {INTENT[card.supervisorIntent]?.label || card.supervisorIntent}</em>}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="ob-actions">
                        {col.next && <button type="button" className="ob-next" disabled={busy === card.id} onClick={() => moveTo(card, col.next!.stage as Column, col.next!.label)}>{col.next.label} <UiIcon name="arrowLeft" size={14} /></button>}
                        {card.column === "contracting" && <button type="button" className="ob-next is-assign" disabled={busy === card.id} onClick={() => setAssigning(card)}><UiIcon name="check" size={15} /> إسناد لمشرف</button>}
                        {card.column === "contracting" && card.onboardingStage !== "ready_assignment" && <button type="button" className="ob-soft" disabled={busy === card.id} onClick={() => act(card, "جاهز للإسناد", { action: "updateOnboarding", stage: "ready_assignment" }, (c) => ({ ...c, onboardingStage: "ready_assignment" }))}>جاهز للإسناد</button>}
                        {card.column === "declined" && <button type="button" className="ob-soft" disabled={busy === card.id} onClick={() => act(card, "إعادة فتح الطلب", { action: "updateOnboarding", stage: "awaiting_decisions" }, (c) => ({ ...c, column: "post_interview", onboardingStage: "awaiting_decisions", since: new Date().toISOString() }))}>إعادة فتح الطلب</button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section className="sk-card ob-history">
        <header className="sk-card-head"><div><h2>الحركة آخر 6 أشهر</h2><p>كم متدربًا دخل كل خطوة في كل شهر. اللون أغمق كلما زاد العدد.</p></div></header>
        <div className="sk-table-wrap">
          <table className="sk-table">
            <thead><tr><th scope="col">الشهر</th>{MOVEMENT.map((k) => <th key={k.key} scope="col">{k.label}</th>)}</tr></thead>
            <tbody>
              {months.map((m) => (
                <tr key={m} className={m === month ? "is-current" : ""} onClick={() => setMonth(m)}>
                  <th scope="row">{monthName(m)}</th>
                  {MOVEMENT.map((k) => {
                    const n = movement[m]?.[k.key] || 0;
                    return <td key={k.key}><span className="ob-heat" style={{ "--c": k.color, "--a": n ? 0.12 + (n / peak) * 0.6 : 0 } as React.CSSProperties}>{n}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {assigning && (
        <AssignDialog
          trainee={assigning}
          supervisors={supervisors}
          defaultSupervisor={assigning.interviewSupervisorId}
          onClose={() => setAssigning(null)}
          onAssigned={(supervisor, invite) => {
            const card = assigning;
            setAssigning(null);
            setCards((list) => list.filter((c) => c.id !== card.id));
            say(`انتقل ${card.name} إلى قائمة المتدربين مع ${supervisor}${invite ? "، وأُنشئ رابط تفعيل حسابه" : ""}.`, "ok", `/${locale}/admin/trainees/${card.id}`);
            router.refresh();
          }}
        />
      )}

      {toast && (
        <div className={`ob-toast is-${toast.tone}`} role="status">
          <span>{toast.text}</span>
          {toast.href && <Link href={toast.href}>فتح الملف</Link>}
          <button type="button" aria-label="إغلاق" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}

function AssignDialog({ trainee, supervisors, defaultSupervisor, onClose, onAssigned }: {
  trainee: BoardTrainee; supervisors: Supervisor[]; defaultSupervisor: string;
  onClose: () => void; onAssigned: (supervisorName: string, invite: string) => void;
}) {
  const options = supervisors.filter((s) => s.active && !s.consultant).sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name, "ar"));
  const [selected, setSelected] = useState(options.some((s) => s.id === defaultSupervisor) ? defaultSupervisor : "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState(false);
  const chosen = options.find((s) => s.id === selected);

  async function submit() {
    if (!selected) return setError("اختاري المشرف.");
    setBusy(true);
    setError("");
    try {
      const result = await patch({ traineeId: trainee.id, action: "assign", supervisorId: selected, startDate });
      if (result.inviteLink) { setInvite(result.inviteLink); return; }
      onAssigned(chosen?.name || "المشرف", "");
    } catch (e) {
      setError(e instanceof Error && e.message !== "FAILED" ? e.message : "تعذّر الإسناد. حاولي مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-labelledby="ob-assign-title" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="ob-dialog">
        <header><h3 id="ob-assign-title">إسناد {trainee.name}</h3><button type="button" aria-label="إغلاق" onClick={onClose} disabled={busy}>×</button></header>
        {invite ? (
          <div className="ob-invite">
            <p>تم الإسناد. أرسلي رابط تفعيل الحساب للمتدرب:</p>
            <input readOnly value={invite} dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label="رابط التفعيل" />
            <div className="ob-dialog-actions">
              <button type="button" className="ob-next" onClick={() => { navigator.clipboard?.writeText(invite).then(() => setCopied(true), () => undefined); }}>{copied ? "نُسخ ✓" : "نسخ الرابط"}</button>
              <button type="button" className="ob-soft" onClick={() => onAssigned(chosen?.name || "المشرف", invite)}>تم</button>
            </div>
          </div>
        ) : (
          <>
            <p className="ob-dialog-hint">ينتقل المتدرب إلى «البدء بالإشراف» ويظهر في قائمة المتدربين وعند المشرف.</p>
            <div className="ob-sups" role="radiogroup" aria-label="المشرف">
              {options.map((s) => (
                <label key={s.id} className={selected === s.id ? "is-on" : ""}>
                  <input type="radio" name="ob-sup" value={s.id} checked={selected === s.id} onChange={() => setSelected(s.id)} />
                  <span className="ob-av" aria-hidden="true">{s.name.trim().slice(0, 1)}</span>
                  <b>{s.name}</b>
                  <em className={s.seats ? "" : "is-zero"}>{s.seats ? `${s.seats} مقعد` : "بلا مقاعد"}</em>
                  {s.id === defaultSupervisor && <small>أجرى المقابلة</small>}
                </label>
              ))}
            </div>
            <label className="ob-date">تاريخ بدء الإشراف <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" /></label>
            {chosen && chosen.seats === 0 && <p className="ob-warn">هذا المشرف ليس لديه مقاعد متاحة. يمكنك المتابعة إن كان الإسناد متفقًا عليه.</p>}
            {error && <p className="ob-error" role="alert">{error}</p>}
            <div className="ob-dialog-actions">
              <button type="button" className="ob-next is-assign" disabled={busy || !selected} onClick={submit}>{busy ? "جارٍ الإسناد…" : "إسناد وبدء الإشراف"}</button>
              <button type="button" className="ob-soft" onClick={onClose} disabled={busy}>إلغاء</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
