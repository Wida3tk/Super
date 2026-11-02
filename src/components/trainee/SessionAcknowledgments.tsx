"use client";

import { useState } from "react";
import type { FieldworkActivity } from "@/types";
import { DISPUTE_NOTE_MIN, ackState } from "@/lib/supervision/sessionAcknowledgment";

const ERRORS: Record<string, string> = {
  NOTE_REQUIRED: "اكتب سبب الاعتراض باختصار.",
  MONTH_LOCKED: "هذا الشهر مقفل ولا يمكن تعديل الإقرار.",
  NOT_ACKNOWLEDGEABLE: "هذه الجلسة لم تعد قابلة للإقرار (ربما حذفها المشرف).",
  NOT_FOUND: "الجلسة غير موجودة.",
};

/**
 * Supervision sessions the supervisor logged, waiting for the trainee to
 * confirm they attended. Shown above the portal tabs while anything is open.
 */
export default function SessionAcknowledgments({
  activities,
  supervisorName,
  onChange,
}: {
  activities: FieldworkActivity[];
  supervisorName?: string;
  onChange: (row: FieldworkActivity) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  const open = activities
    .filter((row) => {
      const state = ackState(row);
      return state === "pending" || state === "disputed";
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!open.length) return null;
  const pendingCount = open.filter((row) => ackState(row) === "pending").length;

  const send = async (row: FieldworkActivity, action: "confirm" | "dispute") => {
    setBusy(row.id);
    setError(null);
    try {
      const response = await fetch("/api/trainee/session-acknowledgment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: row.id, action, note: action === "dispute" ? note : undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError({ id: row.id, text: ERRORS[data.error] || "تعذر الحفظ، حاول مرة أخرى." });
        return;
      }
      onChange(data.activity);
      setDisputing(null);
      setNote("");
    } catch {
      setError({ id: row.id, text: "تعذر الاتصال، حاول مرة أخرى." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ack-card" aria-labelledby="ack-title">
      <header>
        <div>
          <h2 id="ack-title">جلسات إشراف بانتظار إقرارك</h2>
          <p>
            سجّل {supervisorName || "مشرفك"} هذه الجلسات. أقِرّ بكل جلسة حضرتها، أو اعترض إن كان فيها خطأ في التاريخ أو المدة أو النوع.
            {pendingCount > 1 && " الجلسات التي لا تُقرّ بها هنا تُعدّ مُقرّة عند إقرارك بالسجل الشهري."}
          </p>
        </div>
        {pendingCount > 0 && <span className="ack-count">{pendingCount}</span>}
      </header>
      <ul>
        {open.map((row) => {
          const disputed = ackState(row) === "disputed";
          const isDisputing = disputing === row.id;
          return (
            <li key={row.id} className={disputed ? "is-disputed" : ""}>
              <div className="ack-row">
                <div className="ack-info">
                  <b>{row.date}</b>
                  <span>
                    {row.duration} ساعة · {row.format === "group" ? "جماعية" : "فردية"}
                    {row.setting === "in_person" ? " · حضوري" : row.setting === "video" ? " · اتصال مرئي" : ""}
                  </span>
                  {row.description && <small>{row.description}</small>}
                  {disputed && (
                    <small className="ack-note">
                      اعترضت: «{row.traineeAcknowledgment?.note}» — بانتظار تصحيح المشرف. يمكنك الإقرار إن تبيّن أن الجلسة صحيحة.
                    </small>
                  )}
                </div>
                {!isDisputing && (
                  <div className="ack-actions">
                    <button type="button" className="ack-confirm" disabled={busy === row.id} onClick={() => send(row, "confirm")}>
                      {busy === row.id ? "جارٍ الحفظ…" : "أُقرّ بالجلسة"}
                    </button>
                    {!disputed && (
                      <button type="button" className="ack-dispute-btn" disabled={busy === row.id} onClick={() => { setDisputing(row.id); setNote(""); setError(null); }}>
                        اعتراض
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isDisputing && (
                <form
                  className="ack-form"
                  onSubmit={(event) => { event.preventDefault(); send(row, "dispute"); }}
                >
                  <label htmlFor={`ack-note-${row.id}`}>ما الخطأ في هذه الجلسة؟</label>
                  <textarea
                    id={`ack-note-${row.id}`}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="مثال: الجلسة كانت 30 دقيقة وليست ساعة"
                    maxLength={1000}
                    rows={2}
                    autoFocus
                  />
                  <div className="ack-actions">
                    <button type="submit" className="ack-dispute-btn" disabled={busy === row.id || note.trim().length < DISPUTE_NOTE_MIN}>
                      إرسال الاعتراض للمشرف
                    </button>
                    <button type="button" className="ack-cancel" onClick={() => setDisputing(null)}>إلغاء</button>
                  </div>
                </form>
              )}
              {error?.id === row.id && <p role="alert" className="ack-error">{error.text}</p>}
            </li>
          );
        })}
      </ul>
      <style>{`
        .ack-card{background:#fff;border:1px solid #dbe6ff;border-radius:18px;margin-bottom:18px;box-shadow:0 1px 3px rgb(0 20 66/.05);overflow:hidden}
        .ack-card header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:16px 20px;background:#f5f8ff;border-bottom:1px solid #e5edff}
        .ack-card h2{margin:0;font-size:16px;color:#001442}
        .ack-card header p{margin:4px 0 0;font-size:13px;line-height:1.7;color:#475569}
        .ack-count{flex:0 0 auto;min-width:30px;height:30px;padding:0 8px;border-radius:99px;display:grid;place-items:center;background:#0d40fc;color:#fff;font-weight:700;font-size:14px}
        .ack-card ul{list-style:none;margin:0;padding:0}
        .ack-card li{padding:14px 20px;border-bottom:1px solid #eef2f7}
        .ack-card li:last-child{border-bottom:0}
        .ack-card li.is-disputed{background:#fffbfb}
        .ack-row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
        .ack-info{display:grid;gap:2px;min-width:0;flex:1 1 220px}
        .ack-info b{font-size:14px;color:#0f172a}
        .ack-info span{font-size:13px;color:#334155}
        .ack-info small{font-size:12px;color:#64748b;line-height:1.6}
        .ack-info .ack-note{color:#b91c1c}
        .ack-actions{display:flex;gap:8px;flex-wrap:wrap}
        .ack-card button{font:inherit;font-size:13px;font-weight:700;border-radius:10px;padding:8px 14px;cursor:pointer;min-height:38px}
        .ack-card button:disabled{opacity:.55;cursor:not-allowed}
        .ack-card button:focus-visible,.ack-card textarea:focus-visible{outline:2px solid #57ddff;outline-offset:2px}
        .ack-confirm{background:#0d40fc;border:1px solid #0d40fc;color:#fff}
        .ack-dispute-btn{background:#fff;border:1px solid #fecaca;color:#b91c1c}
        .ack-cancel{background:#fff;border:1px solid #e2e8f0;color:#475569}
        .ack-form{display:grid;gap:8px;margin-top:12px}
        .ack-form label{font-size:13px;font-weight:600;color:#334155}
        .ack-form textarea{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;resize:vertical}
        .ack-error{margin:8px 0 0;font-size:12px;color:#b91c1c}
        @media(max-width:600px){.ack-card header,.ack-card li{padding-inline:14px}.ack-actions{width:100%}.ack-actions button{flex:1}}
      `}</style>
    </section>
  );
}
