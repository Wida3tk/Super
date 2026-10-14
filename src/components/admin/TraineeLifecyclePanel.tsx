"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MAIN_STAGES, EXCEPTIONAL_ACTIONS } from "@/lib/lifecycle/presentation";
import { directoryState, supervisionProgress } from "@/lib/lifecycle/directory";
import styles from "./TraineeLifecyclePanel.module.css";
const colors: Record<string, string> = { registered: "#7C3AED", initial_interview: "#2563EB", contracting: "#B45309", active_service: "#047857", completed: "#0F766E" };
const number = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);
type Scope = "ongoing" | "completed" | "all";
export default function TraineeLifecyclePanel({ trainees, supervisors, transitions }: { trainees: any[]; supervisors: any[]; transitions: any[] }) {
  const { locale } = useParams<{ locale: string }>(), router = useRouter();
  const [scope, setScope] = useState<Scope>("ongoing"), [search, setSearch] = useState(""), [stage, setStage] = useState("all"), [exception, setException] = useState("all"), [supervisor, setSupervisor] = useState("all"), [license, setLicense] = useState("all"), [sort, setSort] = useState("name"), [page, setPage] = useState(1);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [history, setHistory] = useState<{ month: string; rows: any[] } | null>(null), [historyError, setHistoryError] = useState(""), [historyBusy, setHistoryBusy] = useState(false);
  const historyRequest = useRef<AbortController | null>(null);
  useEffect(() => () => historyRequest.current?.abort(), []);
  const monthlyTransitions = history?.month === month ? history.rows : transitions;
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
    } catch { if (historyRequest.current === controller) setHistoryError("تعذر تحميل حركة الشهر. حاولي مجددًا؛ الأرقام أدناه غير متاحة حاليًا."); }
    finally { clearTimeout(timer); if (historyRequest.current === controller) setHistoryBusy(false); }
  }
  const [editor, setEditor] = useState<any>(null), [nextStage, setNextStage] = useState(""), [assignment, setAssignment] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; if (editor && el && !el.open) el.showModal(); else if (!editor && el?.open) el.close(); }, [editor]);
  const entries = trainees.map(t => ({ t, ...directoryState(t, transitions), progress: supervisionProgress(t) }));
  const completed = entries.filter(e => e.completed).length;
  const base = entries.filter(e => scope === "all" || (scope === "completed" ? e.completed : !e.completed));
  const q = search.trim().toLowerCase();
  const filtered = base.filter(e => (stage === "all" || e.main.key === stage) && (exception === "all" || (exception === "none" ? !e.exception : e.exception?.key === exception)) && (supervisor === "all" || (supervisor === "unassigned" ? !e.t.currentSupervisorId : e.t.currentSupervisorId === supervisor)) && (license === "all" || e.t.license === license) && (!q || [e.t.name, e.t.email, e.t.phone].some(v => String(v || "").toLowerCase().includes(q))));
  filtered.sort((a, b) => (sort === "recent" ? String(b.t.createdAt || "").localeCompare(String(a.t.createdAt || "")) : sort === "progress" ? a.progress.percent - b.progress.percent : 0) || String(a.t.name || "").localeCompare(String(b.t.name || ""), "ar") || a.t.id.localeCompare(b.t.id));
  const pageSize = 15, pages = Math.max(1, Math.ceil(filtered.length / pageSize)), current = Math.min(page, pages), visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  function clear() { setSearch(""); setStage("all"); setException("all"); setSupervisor("all"); setLicense("all"); setPage(1); }
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
  return <div className={styles.directory} dir="rtl">
    <section className={styles.list} aria-label="قائمة المتدربين">
      <header className={styles.header}><div><h2>قائمة المتدربين</h2><p>ملفات واضحة وحالات موحّدة، وإجراءات إدارية عند الحاجة.</p></div>
        <nav className={styles.scopes} aria-label="نطاق القائمة">{([{ key: "ongoing", label: "قيد المتابعة", count: trainees.length - completed }, { key: "completed", label: "المكتملون", count: completed }, { key: "all", label: "الجميع", count: trainees.length }] as const).map(s => <button key={s.key} aria-pressed={scope === s.key} onClick={() => { setScope(s.key); setStage("all"); setException("all"); setPage(1); }}>{s.label}<span>{s.count}</span></button>)}</nav>
      </header>
      <div className={styles.filters}>
        <label className={styles.search}>البحث<input type="search" placeholder="الاسم، البريد أو رقم الجوال" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
        <label>المشرف<select value={supervisor} onChange={e => { setSupervisor(e.target.value); setPage(1); }}><option value="all">كل المشرفين</option><option value="unassigned">دون مشرف</option>{supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>الرخصة<select value={license} onChange={e => { setLicense(e.target.value); setPage(1); }}><option value="all">كل الرخص</option><option>QASP-S</option><option>QBA</option></select></label>
        <label>الإجراء الاستثنائي<select value={exception} onChange={e => { setException(e.target.value); setPage(1); }}><option value="all">كل الحالات</option><option value="none">دون إجراء استثنائي</option>{EXCEPTIONAL_ACTIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
        <label>الترتيب<select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="name">الاسم</option><option value="recent">الأحدث إضافة</option><option value="progress">الأقل تقدمًا في الإشراف</option></select></label>
      </div>
      <div className={styles.stages} aria-label="تصفية المراحل الأساسية"><button aria-pressed={stage === "all"} onClick={() => { setStage("all"); setPage(1); }}>كل المراحل</button>{MAIN_STAGES.map(s => <button key={s.key} aria-pressed={stage === s.key} onClick={() => { setStage(s.key); setPage(1); }}>{s.label}<span>{base.filter(e => e.main.key === s.key).length}</span></button>)}</div>
      <div className={styles.result}><span role="status">{filtered.length} متدرب مطابق</span><button onClick={clear}>مسح الفلاتر</button></div>
      <div className={styles.scroll} role="region" aria-label="جدول المتدربين، قابل للتمرير أفقيًا" tabIndex={0}><table><thead><tr>{["المتدرب", "المرحلة الأساسية والحالة", "المشرف", "الرخصة", "ساعات الإشراف", "آخر تحديث للحالة", "الإجراءات"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>
        {visible.map(e => { const t = e.t, sup = supervisors.find(s => s.id === t.currentSupervisorId); return <tr key={t.id}>
          <td><div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{String(t.name || "م").trim().slice(0, 1)}</span><div><Link prefetch={false} href={`/${locale}/admin/trainees/${t.id}`}>{t.name}</Link><small dir="ltr">{t.email}</small></div></div></td>
          <td><span className={styles.badge} style={{ color: colors[e.main.key], background: `${colors[e.main.key]}12` }}>{e.main.label}</span>{e.exception && <small className={styles.exception}>{e.exception.label}</small>}{e.stage === "post_interview" && <small>اتخاذ القرار بعد المقابلة</small>}{e.completed && <small>اكتمال إداري، لا يشترط اكتمال عدّاد الساعات</small>}</td>
          <td>{sup?.name || "لم يُسند بعد"}</td><td><span className={styles.license}>{t.license}</span></td>
          <td><b dir="ltr" className={styles.hours}>{number(e.progress.hours)} / {number(e.progress.target)}</b><div className={styles.track} role="progressbar" aria-label={`تقدم إشراف ${t.name}`} aria-valuenow={Math.round(e.progress.percent)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${e.progress.percent}%` }} /></div><small>{Math.round(e.progress.percent)}% من الهدف</small></td>
          <td><time dir="ltr">{String(t.lifecycleStageChangedAt || t.updatedAt || t.createdAt || "").slice(0, 10) || "—"}</time></td>
          <td><div className={styles.actions}><Link prefetch={false} href={`/${locale}/admin/trainees/${t.id}`}>فتح الملف</Link><button onClick={() => open(t)} aria-label={`إدارة حالة ${t.name}`}>إدارة الحالة</button></div></td>
        </tr>; })}
      </tbody></table></div>
      {!visible.length && <div className={styles.empty}><h3>لا توجد نتائج مطابقة</h3><p>غيّري نطاق القائمة أو امسحي الفلاتر.</p><button onClick={clear}>مسح الفلاتر</button></div>}
      <footer className={styles.pagination}><span>{filtered.length ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, filtered.length)} من ${filtered.length}` : "0 نتائج"}</span><div><button disabled={current === 1} onClick={() => setPage(current - 1)}>السابق</button><span>صفحة {current} من {pages}</span><button disabled={current === pages} onClick={() => setPage(current + 1)}>التالي</button></div></footer>
    </section>
    <details className={styles.history} onToggle={e => { if (e.currentTarget.open && !history && !historyBusy) void loadMonth(month); }}><summary>حركة المراحل والإجراءات خلال الشهر</summary><label>الشهر<input type="month" value={month} onChange={e => void loadMonth(e.target.value)} /></label>{historyBusy ? <p role="status">جاري تحميل حركة الشهر…</p> : historyError ? <p role="alert">{historyError}</p> : !history ? <p>اختاري الشهر لعرض الحركة.</p> : <div className={styles.historyGrid}>{[...MAIN_STAGES, ...EXCEPTIONAL_ACTIONS].map(s => { const moves = monthlyTransitions.filter(t => String(t.changedMonth || t.changedAt || "").slice(0, 7) === month); return <div key={s.key}><b>{s.label}</b><span>دخل: {moves.filter(m => m.toStage === s.key).length} · غادر: {moves.filter(m => m.fromStage === s.key).length}</span></div>; })}</div>}</details>
    <dialog ref={dialog} className={styles.dialog} onCancel={e => { if (busy) e.preventDefault(); else setEditor(null); }} onClose={() => setEditor(null)} aria-labelledby="trainee-status-title">{editor && <>
      <header><h3 id="trainee-status-title">إدارة حالة {editor.name}</h3><button disabled={busy} onClick={() => setEditor(null)} aria-label="إغلاق">×</button></header><p>الحفظ يحدّث الحالة الفعلية وفق الصلاحيات الحالية، دون تعديل الساعات أو حذف الملف.</p>
      <label>الحالة الإدارية<select disabled={busy} value={nextStage} onChange={e => setNextStage(e.target.value)}><optgroup label="المراحل الأساسية">{MAIN_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup><optgroup label="الإجراءات الاستثنائية">{EXCEPTIONAL_ACTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup><optgroup label="تفاصيل المقابلة الإدارية"><option value="post_interview">المقابلة — اتخاذ القرار</option></optgroup></select></label><button className={styles.primary} disabled={busy || nextStage === directoryState(editor).stage} onClick={() => void save("updateLifecycle")}>حفظ الحالة</button>
      {!editor.currentSupervisorId && editor.status === "onboarding" && <section><label>إسناد مباشر لمشرف<select disabled={busy} value={assignment} onChange={e => setAssignment(e.target.value)}><option value="">اختيار المشرف</option>{supervisors.filter(s => s.isActive !== false && s.accountType !== "consultant").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button disabled={busy || !assignment} onClick={() => void save("assign")}>إسناد وتفعيل الإشراف</button></section>}
      {error && <p role="alert">{error}</p>}
    </>}</dialog>
  </div>;
}
