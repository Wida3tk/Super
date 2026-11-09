import type { FieldworkActivity } from "@/types";
import { evaluatePeriod, hourBreakdown, traineeRules } from "@/lib/qaba/compliance";
import { projectLegacySessions } from "@/lib/supervision/legacySessions";
import { ackSummary } from "@/lib/supervision/sessionAcknowledgment";

/**
 * The admin control room: where every active trainee stands in the monthly
 * cycle, computed from the same ledger and rules engine the supervisor uses to
 * approve a month. Pure functions only — the page loads month-scoped data and
 * passes it in, so the whole picture costs a handful of queries.
 */

export type CycleStage =
  | "no_hours"
  | "trainee_drafting"
  | "awaiting_supervisor"
  | "ready_to_approve"
  | "awaiting_trainee"
  | "locked";

export const CYCLE_STAGES: { key: CycleStage; label: string; hint: string; tone: "muted" | "info" | "warning" | "success" }[] = [
  { key: "no_hours", label: "لا ساعات", hint: "لم يُسجَّل أي نشاط هذا الشهر", tone: "muted" },
  { key: "trainee_drafting", label: "عند المتدرب", hint: "مسودات أو سجلات أُعيدت للتعديل", tone: "muted" },
  { key: "awaiting_supervisor", label: "بانتظار مراجعة المشرف", hint: "سجلات مُرسلة لم تُراجع", tone: "warning" },
  { key: "ready_to_approve", label: "جاهز للاعتماد الشهري", hint: "كل السجلات معتمدة ولم يُعتمد الشهر", tone: "info" },
  { key: "awaiting_trainee", label: "بانتظار إقرار المتدرب", hint: "اعتمده المشرف ولم يُقر المتدرب", tone: "info" },
  { key: "locked", label: "مقفل", hint: "اعتمده المشرف وأقر المتدرب", tone: "success" },
];

export type AlertKey = "session_disputed" | "supervision_below_rate" | "no_individual_contact" | "group_over_limit" | "over_monthly_max" | "under_monthly_min";

export const ALERTS: { key: AlertKey; label: string; tone: "warning" | "danger" }[] = [
  { key: "session_disputed", label: "اعتراض على جلسة", tone: "danger" },
  { key: "supervision_below_rate", label: "إشراف أقل من 5%", tone: "warning" },
  { key: "no_individual_contact", label: "لا اتصال فردي (ساعة)", tone: "warning" },
  { key: "group_over_limit", label: "جماعي فوق 50%", tone: "danger" },
  { key: "over_monthly_max", label: "فوق 140 ساعة", tone: "danger" },
  { key: "under_monthly_min", label: "أقل من 20 ساعة", tone: "warning" },
];

const HOUR_TYPES = ["direct", "indirect", "supervision_direct", "supervision_indirect"];
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Trainee = { id: string; name?: string; license?: string; contractSignedAt?: unknown; currentSupervisorId?: string; status?: string };
type Approval = { traineeId: string; supervisorApprovedAt?: string | null; traineeAcknowledgedAt?: string | null; locked?: boolean };

export interface MonthRow {
  traineeId: string;
  name: string;
  supervisorId: string;
  stage: CycleStage;
  /** Approved hours — what counts officially. */
  approved: { total: number; supervision: number; group: number; required: number };
  /** Everything logged and not rejected — the early-warning view. */
  logged: { total: number; supervision: number; group: number; required: number; shortfall: number; groupRate: number };
  pendingReview: number;
  /** Supervisor-logged sessions the trainee has not confirmed / has disputed. */
  sessions: { unconfirmed: number; disputed: number };
  hasIndividualContact: boolean;
  alerts: AlertKey[];
}

/** Rows counted while the month is still open: logged, not rejected, real hours. */
function loggedRows(rows: FieldworkActivity[]) {
  return rows
    .filter((row) => row.status !== "rejected" && HOUR_TYPES.includes(row.activityType) && Number(row.duration) > 0)
    .map((row) => ({ ...row, status: "approved" as const }));
}

export function stageFor(rows: FieldworkActivity[], approval?: Approval | null): CycleStage {
  if (approval?.locked || approval?.traineeAcknowledgedAt) return "locked";
  if (approval?.supervisorApprovedAt) return "awaiting_trainee";
  const live = rows.filter((row) => row.status !== "rejected");
  if (!live.length) return "no_hours";
  if (live.some((row) => row.status === "submitted")) return "awaiting_supervisor";
  if (live.some((row) => row.status === "draft" || row.status === "revision_requested")) return "trainee_drafting";
  return "ready_to_approve";
}

/**
 * @param monthClosed when true the low-hours alert is raised; while the month
 * is young almost everyone is under 20 and the alert would be noise.
 */
export function buildMonthRow(trainee: Trainee, rows: FieldworkActivity[], approval: Approval | null | undefined, monthClosed: boolean): MonthRow {
  const rules = traineeRules(trainee);
  const approvedHours = hourBreakdown(rows);
  const approvedPeriod = evaluatePeriod(approvedHours, rules);
  const logged = loggedRows(rows);
  const loggedHours = hourBreakdown(logged);
  const period = evaluatePeriod(loggedHours, rules);
  // Same test the supervisor's monthly approval applies.
  const hasIndividualContact = logged.some((row) => row.activityType.startsWith("supervision_") && row.format === "individual" && Number(row.duration) >= 1);

  const acks = ackSummary(rows);
  const alerts: AlertKey[] = [];
  if (acks.disputed) alerts.push("session_disputed");
  if (loggedHours.total > 0) {
    if (!period.meetsSupervision) alerts.push("supervision_below_rate");
    if (!hasIndividualContact) alerts.push("no_individual_contact");
    if (!period.meetsGroupLimit) alerts.push("group_over_limit");
    if (period.overMonthlyMax) alerts.push("over_monthly_max");
  }
  if (monthClosed && period.underMonthlyMin) alerts.push("under_monthly_min");

  return {
    traineeId: trainee.id,
    name: trainee.name || trainee.id,
    supervisorId: trainee.currentSupervisorId || "",
    stage: stageFor(rows, approval),
    approved: { total: approvedHours.total, supervision: approvedHours.supervision, group: approvedHours.group, required: approvedPeriod.requiredSupervision },
    logged: {
      total: loggedHours.total,
      supervision: loggedHours.supervision,
      group: loggedHours.group,
      required: period.requiredSupervision,
      shortfall: period.supervisionShortfall,
      groupRate: period.groupRate,
    },
    pendingReview: rows.filter((row) => row.status === "submitted").length,
    sessions: { unconfirmed: acks.pending, disputed: acks.disputed },
    hasIndividualContact,
    alerts,
  };
}

export function buildMonthCycle(input: {
  trainees: Trainee[];
  activities: FieldworkActivity[];
  sessions: { id: string; data: Record<string, any> }[];
  approvals: Approval[];
  monthClosed: boolean;
}) {
  const byTrainee = new Map<string, FieldworkActivity[]>();
  for (const row of input.activities) byTrainee.set(row.traineeId, [...(byTrainee.get(row.traineeId) || []), row]);
  const approvals = new Map(input.approvals.map((approval) => [approval.traineeId, approval]));
  const rows = input.trainees.map((trainee) =>
    buildMonthRow(trainee, projectLegacySessions(byTrainee.get(trainee.id) || [], input.sessions, trainee.id), approvals.get(trainee.id), input.monthClosed));
  const stageCounts = Object.fromEntries(CYCLE_STAGES.map((stage) => [stage.key, rows.filter((row) => row.stage === stage.key).length])) as Record<CycleStage, number>;
  const alertCounts = Object.fromEntries(ALERTS.map((alert) => [alert.key, rows.filter((row) => row.alerts.includes(alert.key)).length])) as Record<AlertKey, number>;
  const totals = rows.reduce((sum, row) => ({
    logged: round(sum.logged + row.logged.total),
    approved: round(sum.approved + row.approved.total),
    supervision: round(sum.supervision + row.logged.supervision),
    required: round(sum.required + row.logged.required),
  }), { logged: 0, approved: 0, supervision: 0, required: 0 });
  return { rows, stageCounts, alertCounts, totals };
}

/** Submitted rows waiting for each supervisor, with the age of the oldest. */
export function supervisorBacklog(pending: { supervisorId?: string; traineeId: string; createdAt?: string; updatedAt?: string }[], now: Date) {
  const map = new Map<string, { count: number; trainees: Set<string>; oldest: string }>();
  for (const row of pending) {
    const id = row.supervisorId || "";
    const since = String(row.updatedAt || row.createdAt || "");
    const entry = map.get(id) || { count: 0, trainees: new Set<string>(), oldest: since };
    entry.count += 1;
    entry.trainees.add(row.traineeId);
    if (since && (!entry.oldest || since < entry.oldest)) entry.oldest = since;
    map.set(id, entry);
  }
  return [...map.entries()]
    .map(([supervisorId, entry]) => ({
      supervisorId,
      count: entry.count,
      trainees: entry.trainees.size,
      oldestDays: entry.oldest ? Math.max(0, Math.floor((now.getTime() - new Date(entry.oldest).getTime()) / 86400000)) : 0,
    }))
    .sort((a, b) => b.oldestDays - a.oldestDays || b.count - a.count);
}
