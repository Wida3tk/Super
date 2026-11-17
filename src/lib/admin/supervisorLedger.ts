
/**
 * A supervisor's worked hours, the way they are paid: a session counts once
 * however many trainees attended. Trainee files still count a group hour for
 * every trainee in it; only the supervisor's view deduplicates.
 *
 * Sources:
 * - sessions the supervisor logged on the platform (one per session);
 * - approved supervision rows not linked to such a session (imported
 *   workbooks, completed import gaps, trainee-logged supervision): an
 *   individual row is its own hour; group rows on the same day with the same
 *   duration are one session.
 * Rows for a trainee on a day the supervisor already logged a platform
 * session with them are skipped, and prior credit from another supervisor
 * never counts.
 */

export type SessionPay = "payable" | "pending" | "disputed";

/** One platform session, counted once: payable once every attendee acknowledged it. */
export function sessionPay(_session: unknown, linked: { traineeAcknowledgment?: { status?: string } | null }[]): SessionPay {
  if (linked.some((row) => row.traineeAcknowledgment?.status === "disputed")) return "disputed";
  // Sessions logged before acknowledgments existed have no linked rows.
  if (!linked.length) return "payable";
  return linked.every((row) => row.traineeAcknowledgment?.status === "confirmed") ? "payable" : "pending";
}

export interface LedgerMonth { payable: number; pending: number; disputed: number; total: number; sessions: number; individual: number; group: number }

type Session = { id: string; supervisorId?: string; type?: string; duration?: number | null; month?: string; date?: string; traineeIds?: string[] };
type Row = {
  traineeId: string; supervisorId?: string; date?: string; month?: string; duration?: number | string; format?: string;
  status?: string; sessionId?: string; activityType?: string; priorCreditId?: string; traineeAcknowledgment?: { status?: string } | null;
};

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const empty = (): LedgerMonth => ({ payable: 0, pending: 0, disputed: 0, total: 0, sessions: 0, individual: 0, group: 0 });

export function supervisorLedger(sessions: Session[], rows: Row[]) {
  const out = new Map<string, Map<string, LedgerMonth>>();
  const add = (supervisorId: string, month: string, kind: "individual" | "group", duration: number, pay: SessionPay) => {
    if (!supervisorId || !/^\d{4}-\d{2}$/.test(month)) return;
    const months = out.get(supervisorId) || new Map<string, LedgerMonth>();
    const entry = months.get(month) || empty();
    entry[pay] += duration;
    entry.total += duration;
    entry.sessions += 1;
    entry[kind] += duration;
    months.set(month, entry);
    out.set(supervisorId, months);
  };

  const linked = new Map<string, Row[]>();
  for (const row of rows) if (row.sessionId) linked.set(row.sessionId, [...(linked.get(row.sessionId) || []), row]);
  const covered = new Set<string>();
  for (const session of sessions) {
    if (session.type !== "individual" && session.type !== "group") continue;
    const duration = Number(session.duration);
    if (!(duration > 0)) continue;
    const month = session.month || String(session.date || "").slice(0, 7);
    add(session.supervisorId || "", month, session.type, duration, sessionPay(session, linked.get(session.id) || []));
    for (const traineeId of session.traineeIds || []) covered.add(`${session.supervisorId}|${traineeId}|${session.date}`);
  }

  const groups = new Set<string>();
  for (const row of rows) {
    if (row.sessionId || row.priorCreditId || row.status !== "approved" || !String(row.activityType || "").startsWith("supervision_")) continue;
    const duration = Number(row.duration);
    const date = String(row.date || "").slice(0, 10);
    if (!(duration > 0) || !row.supervisorId || !date) continue;
    if (covered.has(`${row.supervisorId}|${row.traineeId}|${date}`)) continue;
    const month = row.month || date.slice(0, 7);
    if (row.format === "group") {
      const key = `${row.supervisorId}|${date}|${duration}`;
      if (groups.has(key)) continue;
      groups.add(key);
      add(row.supervisorId, month, "group", duration, "payable");
    } else {
      add(row.supervisorId, month, "individual", duration, "payable");
    }
  }

  for (const months of out.values()) for (const entry of months.values()) for (const key of Object.keys(entry) as (keyof LedgerMonth)[]) entry[key] = round(entry[key]);
  return out;
}

/** Months newest first, with a running total, for one supervisor. */
export function ledgerHistory(months: Map<string, LedgerMonth> | undefined) {
  const list = [...(months || new Map()).entries()].sort(([a], [b]) => a.localeCompare(b));
  let running = 0;
  const withTotals = list.map(([month, hours]) => {
    running = round(running + hours.total);
    return { month, ...hours, cumulative: running };
  });
  return { months: withTotals.reverse(), cumulative: running, payableCumulative: round(list.reduce((n, [, h]) => n + h.payable, 0)) };
}
