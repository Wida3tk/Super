"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MAIN_STAGES, EXCEPTIONAL_ACTIONS } from "@/lib/lifecycle/presentation";
import { directoryState } from "@/lib/lifecycle/directory";
import { STANDINGS, type Standing, type TraineeStanding } from "@/lib/admin/supervisorRoster";
import { markGraduated } from "@/lib/admin/graduate";
import UiIcon from "@/components/ui/UiIcon";

/**
 * The admin's trainee list. One row of tabs splits it by where the trainee is:
 * in supervision, graduated, or still joining (managed on «الانضمام»).
 * Inside supervision, follow-up chips show who needs attention.
 */

export type Scope = "serving" | "graduates" | "onboarding" | "all";
export type Follow = "all" | "attention" | Standing | "exception" | "unassigned";
export interface Jump { scope: Scope; follow?: Follow; n: number }

const ONBOARDING = new Set(["registered", "initial_interview", "post_interview", "contracting"]);
const STAGE_TONE: Record<string, string> = { registered: "violet", initial_interview: "blue", contracting: "amber", active_service: "green", completed: "teal" };
const num = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
const PAGE = 20;

const lastLog = (s?: TraineeStanding) =>
  !s ? "—" : s.daysSinceLog === null ? "لا تسجيل خلال 3 أشهر" : s.daysSinceLog <= 0 ? "اليوم" : s.daysSinceLog === 1 ? "أمس" : `منذ ${s.daysSinceLog} يوم`;

export function scopeOf(stage: string): Exclude<Scope, "all"> {
  if (stage === "completed") return "graduates";
  if (ONBOARDING.has(stage)) return "onboarding";
  return "serving";
}

export default function TraineeDirectory({ trainees, supervisors, transitions, initialSupervisor, initialScope = "serving", standings = [], jump }: {
  trainees: any[];
  supervisors: any[];
  transitions: any[];
  initialSupervisor?: string;
  initialScope?: Scope;
  standings?: TraineeStanding[];
  jump?: Jump | null;
}) {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const standingOf = useMemo(() => new Map(standings.map((s) => [s.traineeId, s])), [standings]);
  const supName = useMemo(() => new Map(supervisors.map((s) => [s.id, String(s.name || "")])), [supervisors]);

  const [scope, setScopeState] = useState<Scope>(initialScope);
  const [follow, setFollow] = useState<Follow>("all");
  const [search, setSearch] = useState("");
  const [supervisor, setSupervisor] = useState(initialSupervisor || "all");
  const [license, setLicense] = useState("all");
  const [sort, setSort] = useState(initialScope === "graduates" ? "graduated" : standings.length ? "attention" : "name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  function setScope(next: Scope, nextFollow: Follow = "all") {
    setScopeState(next);
    setFollow(nextFollow);
    setPage(1);
    setSelected(new Set());
    setSort((current) => (next === "graduates" ? "graduated" : current === "graduated" ? (standings.length ? "attention" : "name") : current));
    try {
      const url = new URL(window.location.href);
      if (next === "serving") url.searchParams.delete("scope"); else url.searchParams.set("scope", next);
      window.history.replaceState(null, "", url);
    } catch { /* ignore */ }
  }
  // The header tiles steer the list.
  useEffect(() => {
    if (jump) setScope(jump.scope, jump.follow || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.n]);

  const entries = useMemo(() => trainees.map((t) => {
    const state = directoryState(t, transitions);
    return { t, ...state, scope: scopeOf(state.stage), st: standingOf.get(t.id) };
  }), [trainees, transitions, standingOf]);
  type Entry = (typeof entries)[number];

  const counts = { serving: 0, graduates: 0, onboarding: 0, all: entries.length };
  for (const e of entries) counts[e.scope] += 1;
  const inScope = entries.filter((e) => scope === "all" || e.scope === scope);

  const followMatch = (e: Entry, key: Follow) => {
    const st = e.st?.standing;
    if (key === "all") return true;
    if (key === "unassigned") return !e.t.currentSupervisorId;
    if (key === "exception") return !!e.exception;
    if (e.st?.paused) return false;
    if (key === "attention") return st === "inactive" || st === "watch" || st === "near_finish";
    return st === key;
  };
  const followChips: [Follow, string, string?][] = [
    ["all", "الكل"],
    ["attention", "يحتاج متابعة"],
    ["inactive", STANDINGS.inactive.label, "danger"],
    ["watch", STANDINGS.watch.label, "warning"],
    ["near_finish", STANDINGS.near_finish.label, "success"],
    ["exception", "تأجيل أو إجراء استثنائي", "info"],
    ["unassigned", "بلا مشرف"],
  ];

  const q = search.trim().toLowerCase();
  const filtered = inScope.filter((e) =>
    (scope !== "serving" || followMatch(e, follow))
    && (supervisor === "all" || (supervisor === "unassigned" ? !e.t.currentSupervisorId : e.t.currentSupervisorId === supervisor))
    && (license === "all" || (e.t.license || "QASP-S") === license)
    && (!q || [e.t.name, e.t.email, e.t.phone].some((v) => String(v || "").toLowerCase().includes(q))));

  const rank = (e: Entry) => {
    const st = e.st?.paused ? null : e.st?.standing;
    return st === "inactive" ? 0 : st === "near_finish" ? 1 : st === "watch" ? 2 : 3;
  };
  const byName = (a: Entry, b: Entry) => String(a.t.name || "").localeCompare(String(b.t.name || ""), "ar") || a.t.id.localeCompare(b.t.id);
  const grouped = sort === "supervisor";
  filtered.sort((a, b) => {
    if (sort === "attention") return rank(a) - rank(b) || byName(a, b);
    if (sort === "supervisor") return (supName.get(a.t.currentSupervisorId) || "ي").localeCompare(supName.get(b.t.currentSupervisorId) || "ي", "ar") || rank(a) - rank(b) || byName(a, b);
    if (sort === "progress") return (b.st?.percent || 0) - (a.st?.percent || 0) || byName(a, b);
    if (sort === "quiet") return (b.st?.daysSinceLog ?? 999) - (a.st?.daysSinceLog ?? 999) || byName(a, b);
    if (sort === "recent") return String(b.t.createdAt || "").localeCompare(String(a.t.createdAt || "")) || byName(a, b);
    if (sort === "graduated") return String(b.st?.completedAt || "").localeCompare(String(a.st?.completedAt || "")) || byName(a, b);
    return byName(a, b);
  });
  const groupSize = new Map<string, number>();
  if (grouped) for (const e of filtered) groupSize.set(e.t.currentSupervisorId || "", (groupSize.get(e.t.currentSupervisorId || "") || 0) + 1);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE, current * PAGE);

  const selectable = scope === "serving";
  const pageIds = visible.map((e) => e.t.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setSelected((s) => { const n = new Set(s); pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id))); return n; });

  async function graduate(ids: string[]) {
    const names = ids.map((id) => trainees.find((t) => t.id === id)?.name).filter(Boolean);
    const text = ids.length === 1
      ? `تسجيل ${names[0]} متخرجًا؟`
      : `تسجيل ${ids.length} متدربين متخرجين؟\n${names.slice(0, 8).join("، ")}${names.length > 8 ? "…" : ""}`;
    if (!window.confirm(`${text}\nينتقلون إلى «المتخرجون» ويبقون مرتبطين بمشرفهم. لا تتغير الساعات ولا الملفات.`)) return;
    setWorking(true);
    setNotice(null);
    const { done, failed } = await markGraduated(ids);
    setWorking(false);
    setSelected(new Set(failed));
    setNotice(failed.length
      ? { tone: "bad", text: `سُجّل ${done} وتعذّر ${failed.length}. بقي المتعذّر محددًا لإعادة المحاولة.` }
      : { tone: "ok", text: done === 1 ? `سُجّل ${names[0]} متخرجًا.` : `سُجّل ${done} متخرجين.` });
    router.refresh();
  }

  function clear() { setFollow("all"); setSearch(""); setSupervisor("all"); setLicense("all"); setPage(1); }
  const filtering = follow !== "all" || !!q || supervisor !== "all" || license !== "all";

  // Status dialog: the same lifecycle and assignment actions as before.
  const [editor, setEditor] = useState<any>(null);
  const [nextStage, setNextStage] = useState("");
  const [assignment, setAssignment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; if (editor && el && !el.open) el.showModal(); else if (!editor && el?.open) el.close(); }, [editor]);
  function open(t: any) { setEditor(t); setNextStage(directoryState(t).stage); setAssignment(""); setError(""); }
  async function save(action: "updateLifecycle" | "assign") {
    if (!editor || (action === "assign" && !assignment)) return;
    if (!confirm(action === "assign" ? `إسناد ${editor.name} وتفعيل الإشراف مباشرة؟` : `تأكيد تحديث حالة ${editor.name} دون تغيير الساعات؟`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/trainee", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traineeId: editor.id, action, ...(action === "assign" ? { supervisorId: assignment } : { stage: nextStage, reason: `تحديث إداري لحالة ${editor.name} من قائمة المتدربين` }) }) });
      if (!response.ok) { setError("تعذر حفظ التعديل. تحققي من البيانات وحاولي مجددًا."); return; }
      setEditor(null); router.refresh();
    } catch { setError("تعذر الاتصال. حدّثي الصفحة للتحقق من الحالة قبل المحاولة مجددًا."); }
    finally { setBusy(false); }
  }

  // Monthly movement between stages, loaded on demand.
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [history, setHistory] = useState<{ month: string; rows: any[] } | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const historyRequest = useRef<AbortController | null>(null);
  useEffect(() => () => historyRequest.current?.abort(), []);
  async function loadMonth(value: string) {
    historyRequest.current?.abort();
    historyRequest.current = null; setHistoryBusy(false);
    setMonth(value); setHistory(null); setHistoryError("");
    if (!value) return;
    const controller = new AbortController(); historyRequest.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    setHistoryBusy(true);
    try {
      const response = await fetch(`/api/admin/lifecycle-history?month=${encodeURIComponent(value)}`, { signal: controller.signal });
      if (!response.ok) throw new Error("FAILED");
      const data = await response.json();
      if (historyRequest.current === controller) setHistory({ month: value, rows: data.transitions });
    } catch { if (historyRequest.current === controller) setHistoryError("تعذر تحميل حركة الشهر. حاولي مجددًا."); }
    finally { clearTimeout(timer); if (historyRequest.current === controller) setHistoryBusy(false); }
  }
  const moves = (history?.rows || []).filter((m) => String(m.changedMonth || m.changedAt || "").slice(0, 7) === month);

  // Grouped by supervisor, the group heading already names them.
  const showSupervisor = scope !== "onboarding" && !grouped;
  const showStage = scope === "onboarding" || scope === "all";
  const showProgress = scope !== "onboarding";
  const columns = (selectable ? 1 : 0) + 2 + (showStage ? 1 : 0) + (showSupervisor ? 1 : 0) + (showProgress ? 1 : 0) + (scope === "onboarding" ? 0 : 1);

  return (
    <div className="td" dir="rtl">
      <section className="td-card" aria-label="قائمة المتدربين">
        <nav className="td-tabs" aria-label="أقسام القائمة">
          {([
            ["serving", "بالإشراف"],
            ["graduates", "المتخرجون"],
            ["onboarding", "قيد الانضمام"],
            ["all", "الجميع"],
          ] as [Scope, string][]).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={scope === key} className={`is-${key}`} onClick={() => setScope(key)}>
              {label}<em>{counts[key]}</em>
            </button>
          ))}
        </nav>

        {scope === "serving" && standings.length > 0 && (
          <div className="td-follow" role="group" aria-label="المتابعة">
            {followChips.map(([key, label, tone]) => (
              <button key={key} type="button" data-tone={tone} aria-pressed={follow === key} onClick={() => { setFollow(key); setPage(1); }}>
                {label}<span>{inScope.filter((e) => followMatch(e, key)).length}</span>
              </button>
            ))}
          </div>
        )}
        {scope === "onboarding" && (
          <p className="td-banner">
            <UiIcon name="folder" size={16} /> مسار الانضمام (الطلب، المقابلة، الاتفاقية، الإسناد) يُدار من لوحة الانضمام. هذه القائمة للبحث السريع فقط.
            <Link href={`/${locale}/admin/onboarding`}>فتح لوحة الانضمام</Link>
          </p>
        )}

        <div className="td-filters">
          <label className="td-search"><span className="td-sr">بحث</span><input type="search" placeholder="ابحث بالاسم أو البريد أو الجوال" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
          {scope !== "onboarding" && (
            <label><span>المشرف</span><select value={supervisor} onChange={(e) => { setSupervisor(e.target.value); setPage(1); }}><option value="all">كل المشرفين</option><option value="unassigned">دون مشرف</option>{supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          )}
          <label><span>الرخصة</span><select value={license} onChange={(e) => { setLicense(e.target.value); setPage(1); }}><option value="all">الكل</option><option>QASP-S</option><option>QBA</option></select></label>
          <label><span>الترتيب</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              {scope !== "onboarding" && <option value="supervisor">حسب المشرف (مجمّع)</option>}
              {scope === "serving" && standings.length > 0 && <option value="attention">يحتاج متابعة أولًا</option>}
              {scope === "graduates" && <option value="graduated">الأحدث تخرّجًا</option>}
              {showProgress && <option value="progress">الأعلى تقدمًا</option>}
              {scope === "serving" && standings.length > 0 && <option value="quiet">الأطول انقطاعًا</option>}
              <option value="name">الاسم</option>
              <option value="recent">الأحدث إضافة</option>
            </select>
          </label>
        </div>

        <div className="td-result">
          <span role="status">{filtered.length} متدرب</span>
          {filtering && <button type="button" onClick={clear}>مسح التصفية</button>}
        </div>

        {notice && <p className={`td-notice is-${notice.tone}`} role="status">{notice.text}</p>}
        {selectable && selected.size > 0 && (
          <div className="td-bulk" role="region" aria-label="إجراء على المحددين">
            <b>{selected.size} محدد</b>
            <button type="button" className="td-bulk-go" disabled={working} onClick={() => void graduate([...selected])}>
              <UiIcon name="star" size={16} /> {working ? "جارٍ التسجيل…" : "تسجيل تخرّج للمحددين"}
            </button>
            <button type="button" className="td-bulk-clear" disabled={working} onClick={() => setSelected(new Set())}>إلغاء التحديد</button>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="td-empty">
            <UiIcon name={scope === "graduates" ? "star" : "users"} size={28} />
            <h3>{filtering ? "لا نتائج بهذه التصفية" : scope === "graduates" ? "لا متخرجين بعد" : "لا متدربين هنا"}</h3>
            <p>{filtering ? "غيّري التصفية أو امسحيها." : scope === "graduates" ? "من «بالإشراف» حدّدي من أنهى الإشراف واضغطي «تسجيل تخرّج»." : ""}</p>
            {filtering && <button type="button" onClick={clear}>مسح التصفية</button>}
          </div>
        ) : (
          <div className="td-scroll" role="region" aria-label="جدول المتدربين، قابل للتمرير أفقيًا" tabIndex={0}>
            <table className="td-table">
              <thead>
                <tr>
                  {selectable && <th scope="col" className="td-check"><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="تحديد كل الصفحة" /></th>}
                  <th scope="col">المتدرب</th>
                  {showStage && <th scope="col">المرحلة</th>}
                  {showSupervisor && <th scope="col">المشرف</th>}
                  {showProgress && <th scope="col">الساعات المعتمدة</th>}
                  {scope === "serving" && <th scope="col">آخر تسجيل ساعات</th>}
                  {scope === "graduates" && <th scope="col">تاريخ التخرّج</th>}
                  {scope === "all" && <th scope="col">المتابعة</th>}
                  <th scope="col"><span className="td-sr">إجراءات</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e, i) => {
                  const t = e.t, st = e.st;
                  const supId = t.currentSupervisorId || "";
                  const header = grouped && (i === 0 || (visible[i - 1].t.currentSupervisorId || "") !== supId);
                  const tone = st?.standing && !st.paused ? STANDINGS[st.standing].tone : undefined;
                  return (
                    <Fragment key={t.id}>
                      {header && (
                        <tr className="td-group">
                          <th scope="rowgroup" colSpan={columns}>
                            {supId ? <Link prefetch={false} href={`/${locale}/admin/supervisors?supervisor=${encodeURIComponent(supId)}`}>{supName.get(supId) || "مشرف"}</Link> : <span>دون مشرف</span>}
                            <em>{groupSize.get(supId) || 0}</em>
                          </th>
                        </tr>
                      )}
                      <tr className={selected.has(t.id) ? "is-selected" : ""}>
                        {selectable && <td className="td-check"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`تحديد ${t.name}`} /></td>}
                        <th scope="row">
                          <div className="td-who">
                            <span className={`td-avatar is-${e.scope}`} aria-hidden="true">{String(t.name || "م").trim().slice(0, 1)}</span>
                            <div>
                              <Link prefetch={false} href={`/${locale}/admin/trainees/${t.id}`}>{t.name}</Link>
                              <small dir="ltr">{t.email}{grouped ? ` · ${t.license || "QASP-S"}` : ""}</small>
                            </div>
                          </div>
                        </th>
                        {showStage && (
                          <td>
                            <span className={`td-stage tone-${STAGE_TONE[e.main.key] || "blue"}`}>{e.main.label}</span>
                            {e.exception && <small className="td-exc">{e.exception.label}</small>}
                            {e.stage === "post_interview" && <small>بانتظار القرار بعد المقابلة</small>}
                          </td>
                        )}
                        {showSupervisor && (
                          <td>
                            {supId ? <Link prefetch={false} className="td-sup" href={`/${locale}/admin/supervisors?supervisor=${encodeURIComponent(supId)}`}>{supName.get(supId) || "—"}</Link> : <span className="td-dim">لم يُسند بعد</span>}
                            <small className="td-lic">{t.license || "QASP-S"}</small>
                          </td>
                        )}
                        {showProgress && (
                          <td>
                            {!st ? <span className="td-dim">—</span> : (
                              <div className="td-progress">
                                <span><b>{num(st.hours)}</b> من {num(st.required)}</span>
                                <div className={`td-bar${e.scope === "graduates" ? " is-done" : ""}`} role="progressbar" aria-label={`تقدم ${t.name}`} aria-valuenow={Math.round(st.percent)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${st.percent}%` }} /></div>
                                {e.scope === "serving" && <small>{st.remaining ? `بقي ${num(st.remaining)} ساعة` : "أكمل الساعات المطلوبة"}</small>}
                              </div>
                            )}
                          </td>
                        )}
                        {scope === "serving" && (
                          <td>
                            {st?.serving && st.standing && <span className="td-chip" data-tone={tone}>{st.paused ? "تأجيل معتمد" : st.standing === "near_finish" && !st.remaining ? "أكمل الساعات" : STANDINGS[st.standing].label}</span>}
                            {e.exception && !st?.paused && <span className="td-chip" data-tone="info">{e.exception.label}</span>}
                            <small className={st?.standing === "inactive" && !st.paused ? "td-late" : ""}>{lastLog(st)}</small>
                          </td>
                        )}
                        {scope === "graduates" && <td>{st?.completedAt ? <span dir="ltr">{st.completedAt}</span> : <span className="td-dim">—</span>}</td>}
                        {scope === "all" && (
                          <td>{e.scope === "serving" && st?.standing ? <span className="td-chip" data-tone={tone}>{st.paused ? "تأجيل معتمد" : STANDINGS[st.standing].label}</span> : <span className="td-dim">—</span>}</td>
                        )}
                        <td className="td-actions">
                          <Link prefetch={false} href={`/${locale}/admin/trainees/${t.id}`}>الملف</Link>
                          {e.scope === "serving" && <button type="button" className="is-grad" disabled={working} onClick={() => void graduate([t.id])}>تخرّج</button>}
                          <button type="button" onClick={() => open(t)} aria-label={`إدارة حالة ${t.name}`}>الحالة</button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE && (
          <footer className="td-pages">
            <span>{(current - 1) * PAGE + 1}–{Math.min(current * PAGE, filtered.length)} من {filtered.length}</span>
            <div>
              <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>السابق</button>
              <span>صفحة {current} من {pages}</span>
              <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>التالي</button>
            </div>
          </footer>
        )}
      </section>

      <details className="td-history" onToggle={(e) => { if (e.currentTarget.open && !history && !historyBusy) void loadMonth(month); }}>
        <summary>حركة المراحل خلال الشهر <small>كم دخل وكم غادر كل مرحلة</small></summary>
        <label>الشهر<input type="month" value={month} onChange={(e) => void loadMonth(e.target.value)} /></label>
        {historyBusy ? <p role="status">جاري تحميل حركة الشهر…</p> : historyError ? <p role="alert">{historyError}</p> : !history ? <p>اختاري الشهر لعرض الحركة.</p> : (
          <div className="td-history-grid">
            {[...MAIN_STAGES, ...EXCEPTIONAL_ACTIONS].map((s) => (
              <div key={s.key}><b>{s.label}</b><span>دخل: {moves.filter((m) => m.toStage === s.key).length} · غادر: {moves.filter((m) => m.fromStage === s.key).length}</span></div>
            ))}
          </div>
        )}
      </details>

      <dialog ref={dialog} className="td-dialog" onCancel={(e) => { if (busy) e.preventDefault(); else setEditor(null); }} onClose={() => setEditor(null)} aria-labelledby="td-dialog-title">
        {editor && (
          <>
            <header><h3 id="td-dialog-title">إدارة حالة {editor.name}</h3><button type="button" disabled={busy} onClick={() => setEditor(null)} aria-label="إغلاق">×</button></header>
            <p>الحفظ يحدّث الحالة الفعلية وفق الصلاحيات الحالية، دون تعديل الساعات أو حذف الملف.</p>
            <label>الحالة الإدارية
              <select disabled={busy} value={nextStage} onChange={(e) => setNextStage(e.target.value)}>
                <optgroup label="المراحل الأساسية">{MAIN_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>
                <optgroup label="الإجراءات الاستثنائية">{EXCEPTIONAL_ACTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>
                <optgroup label="تفاصيل المقابلة الإدارية"><option value="post_interview">المقابلة — اتخاذ القرار</option></optgroup>
              </select>
            </label>
            <button type="button" className="td-primary" disabled={busy || nextStage === directoryState(editor).stage} onClick={() => void save("updateLifecycle")}>حفظ الحالة</button>
            {!editor.currentSupervisorId && editor.status === "onboarding" && (
              <section>
                <label>إسناد مباشر لمشرف
                  <select disabled={busy} value={assignment} onChange={(e) => setAssignment(e.target.value)}>
                    <option value="">اختيار المشرف</option>
                    {supervisors.filter((s) => s.isActive !== false && s.accountType !== "consultant").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <button type="button" disabled={busy || !assignment} onClick={() => void save("assign")}>إسناد وتفعيل الإشراف</button>
              </section>
            )}
            {error && <p role="alert" className="td-error">{error}</p>}
          </>
        )}
      </dialog>
    </div>
  );
}
