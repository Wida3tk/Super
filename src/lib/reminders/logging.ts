import type { TraineeStanding } from "@/lib/admin/supervisorRoster";

/**
 * Reminders for trainees who stop logging their own hours (approved by the
 * program owner, 2026-11-17):
 * - 7 days without logging: the trainee;
 * - 14 days: the trainee again, and the supervisor;
 * - 3 days before the month ends with fewer than 20 hours: the trainee.
 * Each reminder goes once: the quiet ones once per silence (a new log
 * starts a new count), the month-end one once per month.
 */

export type ReminderKind = "week" | "fortnight" | "monthEnd";
export interface ReminderState { week?: string; fortnight?: string; monthEnd?: string }
export interface ReminderAction { kind: ReminderKind; toSupervisor: boolean; key: string }

export const MONTH_MIN = 20;

export function lastDayOfMonth(today: string) {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * @param standing the trainee's standing (only trainees in service, not on an approved pause, get reminders)
 * @param quietDays days since the last logged hours, or since service started when nothing was logged
 * @param anchor what the silence is measured from: the last logged date, or the service start
 * @param monthHours hours the trainee logged themself this month (not rejected)
 */
export function loggingReminders(
  standing: Pick<TraineeStanding, "serving" | "paused">,
  quietDays: number | null,
  anchor: string,
  monthHours: number,
  today: string,
  state: ReminderState = {},
): ReminderAction[] {
  if (!standing.serving || standing.paused) return [];
  const out: ReminderAction[] = [];
  if (quietDays !== null && anchor) {
    if (quietDays >= 14) {
      if (state.fortnight !== anchor) out.push({ kind: "fortnight", toSupervisor: true, key: anchor });
    } else if (quietDays >= 7 && state.week !== anchor) {
      out.push({ kind: "week", toSupervisor: false, key: anchor });
    }
  }
  const month = today.slice(0, 7);
  const daysLeft = Math.round((Date.parse(`${lastDayOfMonth(today)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (daysLeft <= 3 && daysLeft >= 0 && monthHours < MONTH_MIN && state.monthEnd !== month) {
    out.push({ kind: "monthEnd", toSupervisor: false, key: month });
  }
  return out;
}
