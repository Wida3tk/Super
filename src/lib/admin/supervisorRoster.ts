import { traineeRules } from "@/lib/qaba/compliance";
import { resolveLifecycleStage } from "@/lib/lifecycle/stages";
import { ackState } from "@/lib/supervision/sessionAcknowledgment";

/**
 * The admin's operational view of supervisors: who works how many paid hours,
 * how many seats are open, and which trainees need attention. Pure functions;
 * the page loads a short window of data and passes it in.
 *
 * Decisions confirmed by the program owner (2026-11-03):
 * - A paid supervisor hour is the duration of a supervision session the
 *   supervisor logged, counted once per session (a one-hour group session with
 *   four trainees is one hour). Only sessions the trainees acknowledged are
 *   payable; disputed ones are held.
 * - A trainee in active service with no hours logged for 14 days is inactive;
 *   7–13 days is "watch". An approved pause is never inactive.
 * - A trainee is near completion when under 20% of the required hours remain,
 *   or when the recent pace finishes the requirement within 3 months.
 * - Seats are the number the supervisor enters.
 */

export const INACTIVE_DAYS = 14;
export const WATCH_DAYS = 7;
export const NEAR_FINISH_REMAINING = 0.2;
export const NEAR_FINISH_MONTHS = 3;

export type Standing = "near_finish" | "inactive" | "watch" | "new" | "on_track";

export const STANDINGS: Record<Standing, { label: string; tone: "success" | "danger" | "warning" | "info" | "muted" }> = {
  near_finish: { label: "قريب من الإنهاء", tone: "success" },
  inactive: { label: "منقطع", tone: "danger" },
  watch: { label: "تحت المراقبة", tone: "warning" },
  new: { label: "بداية الإشراف", tone: "info" },
  on_track: { label: "على المسار", tone: "muted" },
};

type Trainee = {
  id: string; name?: string; license?: string; contractSignedAt?: unknown; status?: string; lifecycleStage?: string;
  currentSupervisorId?: string | null; approvedFieldworkHours?: number; lifecycleStageChangedAt?: string; createdAt?: string;
};
type Row = { id?: string; supervisorId?: string; format?: string; month?: string; traineeId: string; date?: string; createdAt?: string; duration?: number | string; status?: string; sessionId?: string; priorCreditId?: string; activityType?: string; traineeAcknowledgment?: { status?: string; note?: string | null } | null };
type Session = { id: string; supervisorId?: string; type?: string; duration?: number | null; month?: string; traineeIds?: string[] };

const DAY = 86400000;
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const day = (value: unknown) => {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};
const daysBetween = (from: string, to: string) => Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** Rows the trainee logged themself: not supervisor sessions, not imports. */
function traineeLogged(row: Row) {
  return row.status !== "rejected" && !row.sessionId && !row.priorCreditId && Number(row.duration) > 0;
}

export interface TraineeStanding {
  traineeId: string;
  name: string;
  license: string;
  supervisorId: string;
  completed: boolean;
  /** In active service (or approved pause): the trainees a supervisor is serving. */
  serving: boolean;
  paused: boolean;
  standing: Standing | null;
  hours: number;
  required: number;
  percent: number;
  remaining: number;
  /** Average hours a month over the window, from rows the trainee logged. */
  pace: number;
  projectedFinish: string | null;
  lastLogged: string | null;
  daysSinceLog: number | null;
}

/**
 * @param rows the trainee's fieldwork rows dated inside the window
 * @param windowStart first day of the window (YYYY-MM-DD), at most ~3 months back
 */
export function traineeStanding(trainee: Trainee, rows: Row[], today: string, windowStart: string): TraineeStanding {
  const stage = resolveLifecycleStage(trainee);
  const completed = stage === "completed";
  const paused = stage === "approved_pause";
  const serving = stage === "active_service" || paused;
  const required = traineeRules(trainee).total;
  const hours = round(Number(trainee.approvedFieldworkHours || 0));
  const remaining = round(Math.max(0, required - hours));
  const percent = required > 0 ? Math.min(100, Math.round((hours / required) * 1000) / 10) : 0;

  const own = rows.filter(traineeLogged);
  let lastLogged = "";
  // The work date, not createdAt: imports and bulk edits would make everyone look active.
  for (const row of own) if (day(row.date) > lastLogged && day(row.date) <= today) lastLogged = day(row.date);
  // Pace over the window, or since service started if that is later.
  const since = [windowStart, day(trainee.lifecycleStageChangedAt)].sort().pop() || windowStart;
  const months = Math.max(1, daysBetween(since, today) / 30.4);
  const windowHours = own.filter((row) => day(row.date) >= since).reduce((sum, row) => sum + Number(row.duration), 0);
  const pace = round(windowHours / months);
  const monthsLeft = pace > 0 ? remaining / pace : Infinity;
  const projectedFinish = pace > 0 && remaining > 0
    ? new Date(Date.parse(`${today}T00:00:00Z`) + monthsLeft * 30.4 * DAY).toISOString().slice(0, 7)
    : null;

  const daysSinceLog = lastLogged ? daysBetween(lastLogged, today) : null;
  const serviceDays = day(trainee.lifecycleStageChangedAt) ? daysBetween(day(trainee.lifecycleStageChangedAt), today) : Infinity;

  let standing: Standing | null = null;
  if (serving) {
    const nearFinish = remaining <= required * NEAR_FINISH_REMAINING || monthsLeft <= NEAR_FINISH_MONTHS;
    const quiet = daysSinceLog === null ? serviceDays : daysSinceLog;
    if (nearFinish) standing = "near_finish";
    else if (paused) standing = "on_track";
    else if (quiet >= INACTIVE_DAYS) standing = "inactive";
    else if (quiet >= WATCH_DAYS) standing = "watch";
    else if (serviceDays < 60 && hours < required * 0.1) standing = "new";
    else standing = "on_track";
    // Near finish but silent: the admin needs to know it stalled.
    if (nearFinish && !paused && quiet >= INACTIVE_DAYS) standing = "inactive";
  }

  return {
    traineeId: trainee.id,
    name: trainee.name || trainee.id,
    license: trainee.license || "QASP-S",
    supervisorId: trainee.currentSupervisorId || "",
    completed,
    serving,
    paused,
    standing,
    hours,
    required,
    percent,
    remaining,
    pace,
    projectedFinish,
    lastLogged: lastLogged || null,
    daysSinceLog,
  };
}

export type SessionPay = "payable" | "pending" | "disputed";

/** One session, counted once: payable once every attendee acknowledged it. */
export function sessionPay(session: Session, linked: Row[]): SessionPay {
  if (linked.some((row) => row.traineeAcknowledgment?.status === "disputed")) return "disputed";
  // Sessions logged before acknowledgments existed have no linked rows.
  if (!linked.length) return "payable";
  return linked.every((row) => row.traineeAcknowledgment?.status === "confirmed") ? "payable" : "pending";
}

export interface SupervisorHours { payable: number; pending: number; disputed: number; total: number; sessions: number; individual: number; group: number }

export function supervisorHours(sessions: Session[], rows: Row[], month: string) {
  const bySession = new Map<string, Row[]>();
  for (const row of rows) if (row.sessionId) bySession.set(row.sessionId, [...(bySession.get(row.sessionId) || []), row]);
  const result = new Map<string, SupervisorHours>();
  for (const session of sessions) {
    if (session.month !== month || (session.type !== "individual" && session.type !== "group")) continue;
    const duration = Number(session.duration);
    if (!(duration > 0)) continue;
    const id = session.supervisorId || "";
    const entry = result.get(id) || { payable: 0, pending: 0, disputed: 0, total: 0, sessions: 0, individual: 0, group: 0 };
    entry[sessionPay(session, bySession.get(session.id) || [])] += duration;
    entry.total += duration;
    entry.sessions += 1;
    entry[session.type] += duration;
    result.set(id, entry);
  }
  for (const entry of result.values()) for (const key of Object.keys(entry) as (keyof SupervisorHours)[]) entry[key] = round(entry[key]);
  return result;
}

const EMPTY_HOURS: SupervisorHours = { payable: 0, pending: 0, disputed: 0, total: 0, sessions: 0, individual: 0, group: 0 };

/** A supervisor-logged session row the trainee has not confirmed. */
export interface OpenSession {
  activityId: string;
  traineeId: string;
  traineeName: string;
  date: string;
  duration: number;
  format: string;
  state: "pending" | "disputed";
  note: string | null;
}

export interface SupervisorCard {
  supervisorId: string;
  name: string;
  consultant: boolean;
  seats: number;
  active: number;
  paused: number;
  graduates: number;
  counts: Record<Standing, number>;
  hours: { current: SupervisorHours; previous: SupervisorHours };
  openSessions: OpenSession[];
}

export function buildRoster(input: {
  supervisors: { id: string; name?: string; accountType?: string; availableSeats?: number; isActive?: boolean }[];
  trainees: Trainee[];
  rows: Row[];
  sessions: Session[];
  today: string;
  windowStart: string;
  currentMonth: string;
  previousMonth: string;
}) {
  const rowsByTrainee = new Map<string, Row[]>();
  for (const row of input.rows) rowsByTrainee.set(row.traineeId, [...(rowsByTrainee.get(row.traineeId) || []), row]);
  const standings = input.trainees.map((trainee) => traineeStanding(trainee, rowsByTrainee.get(trainee.id) || [], input.today, input.windowStart));
  const current = supervisorHours(input.sessions, input.rows, input.currentMonth);
  const previous = supervisorHours(input.sessions, input.rows, input.previousMonth);

  const names = new Map(input.trainees.map((trainee) => [trainee.id, trainee.name || trainee.id]));
  const open = new Map<string, OpenSession[]>();
  for (const row of input.rows) {
    const state = ackState(row as never);
    if ((state !== "pending" && state !== "disputed") || !row.id) continue;
    const key = row.supervisorId || "";
    open.set(key, [...(open.get(key) || []), {
      activityId: row.id, traineeId: row.traineeId, traineeName: names.get(row.traineeId) || row.traineeId,
      date: String(row.date || ""), duration: Number(row.duration) || 0, format: row.format || "individual",
      state, note: row.traineeAcknowledgment?.note || null,
    }]);
  }
  const cards: SupervisorCard[] = input.supervisors.map((supervisor) => {
    const mine = standings.filter((item) => item.supervisorId === supervisor.id);
    const counts = { near_finish: 0, inactive: 0, watch: 0, new: 0, on_track: 0 } as Record<Standing, number>;
    for (const item of mine) if (item.standing) counts[item.standing] += 1;
    return {
      supervisorId: supervisor.id,
      name: supervisor.name || supervisor.id,
      consultant: supervisor.accountType === "consultant",
      seats: Number(supervisor.availableSeats || 0),
      active: mine.filter((item) => item.serving && !item.paused).length,
      paused: mine.filter((item) => item.paused).length,
      graduates: mine.filter((item) => item.completed).length,
      counts,
      hours: { current: current.get(supervisor.id) || EMPTY_HOURS, previous: previous.get(supervisor.id) || EMPTY_HOURS },
      // Disputes first, then oldest first.
      openSessions: (open.get(supervisor.id) || []).sort((a, b) => (a.state === b.state ? a.date.localeCompare(b.date) : a.state === "disputed" ? -1 : 1)),
    };
  })
    // Keep a supervisor visible while they serve anyone or worked this period.
    .filter((card) => input.supervisors.find((s) => s.id === card.supervisorId)?.isActive !== false || card.active || card.paused || card.hours.current.total || card.hours.previous.total)
    .sort((a, b) => b.counts.inactive - a.counts.inactive || b.counts.near_finish - a.counts.near_finish || a.name.localeCompare(b.name, "ar"));

  return { cards, standings };
}

/** First day of the month `back` months before `month` (YYYY-MM). */
export function monthStart(month: string, back = 0) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 - back, 1));
  return date.toISOString().slice(0, 10);
}
