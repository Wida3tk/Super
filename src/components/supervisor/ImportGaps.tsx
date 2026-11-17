"use client";

import { useState } from "react";

export type ImportGap = {
  id: string; traineeId: string; traineeName: string; sourceFile: string; sheet: string; cell: string;
  raw: string; expectedMonth: string | null; suggestion: string | null; individual: number; group: number;
};

const ERRORS: Record<string, string> = {
  INVALID_DATE: "اكتب تاريخًا صحيحًا غير مستقبلي.",
  MONTH_LOCKED: "هذا الشهر مقفل لهذا المتدرب. تواصل مع الإدارة.",
  PROTECTED_MONTH: "هذا الشهر محمي بإشراف سابق معتمد. تواصل مع الإدارة.",
  NOTE_REQUIRED: "اكتب سببًا مختصرًا.",
  ALREADY_DONE: "أُكملت هذه الجلسة مسبقًا.",
  NOT_FOUND: "لم تعد هذه الجلسة متاحة.",
};
const monthLabel = (month: string | null) => month
  ? new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))
  : "";
const hoursLabel = (gap: ImportGap) => [gap.individual ? `${gap.individual} فردي` : "", gap.group ? `${gap.group} جماعي` : ""].filter(Boolean).join(" + ");

/**
 * Sessions from the supervisor's own workbook that came in without a usable
 * date. Each one counts once the supervisor writes its date.
 */
export default function ImportGaps({ initialGaps }: { initialGaps: ImportGap[] }) {
  const [gaps, setGaps] = useState(initialGaps);
  const [dates, setDates] = useState<Record<string, string>>(() => Object.fromEntries(initialGaps.map((g) => [g.id, g.suggestion || ""])));
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!gaps.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const byTrainee = [...new Map(gaps.map((g) => [g.traineeId, g.traineeName])).entries()];

  async function send(gap: ImportGap, action: "fill" | "dismiss") {
    setBusy(gap.id);
    setErrors((e) => ({ ...e, [gap.id]: "" }));
    try {
      const response = await fetch("/api/supervisor/import-gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gapId: gap.id, action, date: dates[gap.id], note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setErrors((e) => ({ ...e, [gap.id]: ERRORS[data.error] || "تعذّر الحفظ، حاول مرة أخرى." })); return; }
      setGaps((rows) => rows.filter((row) => row.id !== gap.id));
      setDismissing(null);
      setNote("");
    } catch {
      setErrors((e) => ({ ...e, [gap.id]: "تعذّر الاتصال، حاول مرة أخرى." }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="sk-card ig-card" id="import-gaps" aria-labelledby="ig-title">
      <header className="sk-card-head">
        <div>
          <h2 id="ig-title">جلسات من ملفك تحتاج تاريخًا <span className="sk-chip warning">{gaps.length}</span></h2>
          <p>استوردت الإدارة ملفك، وهذه الجلسات لم يكن لها تاريخ واضح فيه. اكتب تاريخ كل جلسة لتُحسب للمتدرب، أو اذكر سبب عدم احتسابها.</p>
        </div>
      </header>
      {byTrainee.map(([traineeId, name]) => (
        <div key={traineeId} className="ig-group">
          <h3>{name}</h3>
          <ul>
            {gaps.filter((g) => g.traineeId === traineeId).map((gap) => (
              <li key={gap.id}>
                <div className="ig-row">
                  <div className="ig-info">
                    <b>{hoursLabel(gap)} ساعة{gap.expectedMonth ? ` · مجموعة ${monthLabel(gap.expectedMonth)}` : ""}</b>
                    <small>في الملف: «{gap.raw || "بدون تاريخ"}» · ورقة {gap.sheet}، الخلية {gap.cell}</small>
                  </div>
                  {dismissing !== gap.id ? (
                    <div className="ig-actions">
                      <label className="ig-sr" htmlFor={`ig-${gap.id}`}>تاريخ الجلسة</label>
                      <input id={`ig-${gap.id}`} type="date" dir="ltr" max={today} value={dates[gap.id] || ""} onChange={(e) => setDates((d) => ({ ...d, [gap.id]: e.target.value }))} />
                      <button type="button" className="ig-save" disabled={busy === gap.id || !dates[gap.id]} onClick={() => send(gap, "fill")}>{busy === gap.id ? "جارٍ الحفظ…" : "حفظ التاريخ"}</button>
                      <button type="button" className="ig-skip" disabled={busy === gap.id} onClick={() => { setDismissing(gap.id); setNote(""); }}>لا تُحتسب</button>
                    </div>
                  ) : (
                    <form className="ig-actions" onSubmit={(e) => { e.preventDefault(); send(gap, "dismiss"); }}>
                      <label className="ig-sr" htmlFor={`ig-note-${gap.id}`}>السبب</label>
                      <input id={`ig-note-${gap.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: مكررة، أو لم تُعقد" maxLength={500} autoFocus />
                      <button type="submit" className="ig-skip" disabled={busy === gap.id || note.trim().length < 5}>تأكيد</button>
                      <button type="button" className="ig-cancel" onClick={() => setDismissing(null)}>إلغاء</button>
                    </form>
                  )}
                </div>
                {errors[gap.id] && <p role="alert" className="ig-error">{errors[gap.id]}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <style>{`
        .ig-card .sk-card-head h2{display:flex;align-items:center;gap:8px}
        .ig-group{padding:4px 20px 12px}
        .ig-group h3{margin:10px 0 6px;font-size:14px;color:var(--sk-deep,#001442)}
        .ig-group ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
        .ig-group li{border:1px solid var(--sk-line-2,#eff3f8);border-radius:10px;padding:10px 12px}
        .ig-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .ig-info{display:grid;gap:2px;min-width:0;flex:1 1 240px}
        .ig-info b{font-size:13px}
        .ig-info small{font-size:12px;color:var(--sk-muted,#6b7a92)}
        .ig-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
        .ig-actions input{height:36px;border:1px solid var(--sk-line,#e6ebf2);border-radius:9px;padding:0 10px;font:inherit;font-size:13px}
        .ig-actions button{height:36px;border-radius:9px;padding:0 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--sk-line,#e6ebf2);background:#fff;color:var(--sk-ink-2,#3c4a63)}
        .ig-actions .ig-save{background:var(--sk-primary,#0d40fc);border-color:var(--sk-primary,#0d40fc);color:#fff}
        .ig-actions button:disabled{opacity:.5;cursor:not-allowed}
        .ig-actions button:focus-visible,.ig-actions input:focus-visible{outline:2px solid var(--sk-neon,#55d7ff);outline-offset:1px}
        .ig-error{margin:6px 0 0;font-size:12px;color:var(--sk-danger,#c42b2b)}
        .ig-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
        @media(max-width:600px){.ig-group{padding-inline:14px}.ig-actions{width:100%}.ig-actions input{flex:1}}
      `}</style>
    </section>
  );
}
