/**
 * Hours a supervisor delivered, counted the way a supervisor works them.
 *
 * A group session writes one supervision row per attending trainee
 * (`session_<id>_<trainee>`). Each trainee earns the full hour, but the
 * supervisor delivered it once. Summing trainee rows counts a one-hour group
 * session with three trainees as three hours; this function counts it once.
 *
 * Rows from a logged session are grouped by `sessionId`. Imported or
 * trainee-logged group rows have no session, so they are grouped by
 * supervisor, date, start time and duration.
 */

export interface SupervisionRow {
  traineeId?: string;
  supervisorId?: string;
  activityType?: string;
  format?: string;
  status?: string;
  date?: string;
  startTime?: string;
  duration?: number | string;
  sessionId?: string;
  month?: string;
}

export interface DeliveredHours {
  individual: number;
  group: number;
  total: number;
  groupSessions: number;
  individualSessions: number;
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function groupKey(row: SupervisionRow) {
  if (row.sessionId) return `session:${row.sessionId}`;
  return `row:${row.supervisorId || ""}|${String(row.date || "").slice(0, 10)}|${row.startTime || ""}|${Number(row.duration) || 0}`;
}

/** Approved supervision rows only; pass `supervisorId` to keep one supervisor's rows. */
export function supervisorDeliveredHours(rows: SupervisionRow[], options: { supervisorId?: string; month?: string } = {}): DeliveredHours {
  let individual = 0, individualSessions = 0;
  const groups = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "approved") continue;
    if (!String(row.activityType || "").startsWith("supervision_")) continue;
    if (options.supervisorId && row.supervisorId && row.supervisorId !== options.supervisorId) continue;
    if (options.month && String(row.month || row.date || "").slice(0, 7) !== options.month) continue;
    const duration = Number(row.duration);
    if (!(duration > 0)) continue;
    if (String(row.format || "").toLowerCase() === "group") {
      const key = groupKey(row);
      groups.set(key, Math.max(groups.get(key) || 0, duration));
    } else {
      individual += duration;
      individualSessions += 1;
    }
  }
  const group = [...groups.values()].reduce((sum, value) => sum + value, 0);
  return {
    individual: round(individual),
    group: round(group),
    total: round(individual + group),
    groupSessions: groups.size,
    individualSessions,
  };
}

/** The same count for every supervisor at once. */
export function deliveredHoursBySupervisor(rows: SupervisionRow[], month?: string) {
  const bySupervisor = new Map<string, SupervisionRow[]>();
  for (const row of rows) {
    const id = row.supervisorId || "";
    if (!id) continue;
    bySupervisor.set(id, [...(bySupervisor.get(id) || []), row]);
  }
  const result: Record<string, DeliveredHours> = {};
  for (const [id, list] of bySupervisor) result[id] = supervisorDeliveredHours(list, { supervisorId: id, month });
  return result;
}
