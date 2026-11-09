import type { FieldworkActivity } from "@/types";
import { approvedHourRows, calculateHourTotals } from "@/lib/fieldwork/hourTotals";
import { RULE_SETS, selectRuleSet, QBA_2000_HOURS_FROM, QBA_1500_DEADLINE, type RuleSet } from "./ruleSets";

export type QabaCredential = "QASP-S" | "QBA";

export { RULE_SETS, QBA_2000_HOURS_FROM, QBA_1500_DEADLINE };
export type { RuleSet };

/**
 * QABA rules used across the platform. One source for every screen; the
 * numbers live in versioned rule sets (./ruleSets.ts).
 *
 * Decisions (2026-11-09, aligned with the official QABA forms):
 * - The 5% supervision rate and the 20–140 monthly band are taken of the
 *   independent hours (direct + indirect without the supervisor), as the
 *   official monthly supervision log computes them.
 * - The credential total counts direct + indirect + supervision, as line D of
 *   the Final Verification Form does.
 * - QBA 1500 vs 2000 hours is decided by the date fieldwork started; the
 *   1500-hour route closes for unfinished candidates on QBA_1500_DEADLINE.
 */
export type CredentialRules = ReturnType<typeof credentialRules>;

export function credentialRules(
  credential: QabaCredential | string | undefined,
  startDate?: string | null,
  options: { today?: string; completed?: boolean; startDateSource?: "fieldwork" | "contract" | null } = {},
) {
  const date = validDate(startDate);
  const { ruleSet, legacyExpired } = selectRuleSet(credential, date, options);
  const today = options.today || new Date().toISOString().slice(0, 10);
  const daysToLegacyDeadline = ruleSet.legacyDeadline
    ? Math.ceil((Date.parse(ruleSet.legacyDeadline) - Date.parse(today)) / 864e5)
    : null;
  return {
    ...ruleSet,
    credential: ruleSet.credential,
    ruleSetId: ruleSet.id,
    /** Kept for older screens: the id of the rule set in use. */
    version: ruleSet.id,
    startDate: date,
    startDateSource: date ? (options.startDateSource ?? "contract") : null,
    /** @deprecated read startDate; kept so existing screens keep working. */
    contractSignedAt: date,
    /** No start date recorded: the current 2000-hour rule applies until one is. */
    contractDateMissing: !date,
    legacyExpired,
    daysToLegacyDeadline,
  };
}

/** The contract date that decides the QBA requirement. */
export function contractDateFor(trainee: { contractSignedAt?: unknown } | null | undefined, agreement?: { signedAt?: unknown } | null) {
  return validDate(trainee?.contractSignedAt) || validDate(agreement?.signedAt) || null;
}

/** Rules for one trainee record (license + contract date). */
export function traineeRules(
  trainee: { license?: string; contractSignedAt?: unknown; fieldworkStartedAt?: unknown; status?: string } | null | undefined,
  agreement?: { signedAt?: unknown } | null,
  options: { today?: string } = {},
) {
  const fieldworkStart = validDate(trainee?.fieldworkStartedAt);
  const start = fieldworkStart || contractDateFor(trainee, agreement);
  return credentialRules(trainee?.license || "QASP-S", start, {
    today: options.today,
    completed: trainee?.status === "completed",
    startDateSource: fieldworkStart ? "fieldwork" : start ? "contract" : null,
  });
}

/** The date of the earliest approved activity: when fieldwork started for QABA. */
export function fieldworkStartDate(activities: FieldworkActivity[]) {
  const dates = approvedHourRows(activities).map((row) => validDate(row.date)).filter((d): d is string => Boolean(d));
  return dates.length ? dates.sort()[0] : null;
}

function validDate(value: unknown) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Splits approved hours the way the rules count them. Supervision hours are
 * part of the total and of direct/indirect according to their type.
 */
export function hourBreakdown(activities: FieldworkActivity[]) {
  const base = calculateHourTotals(activities);
  let supervisionDirect = 0;
  for (const row of approvedHourRows(activities)) if (row.activityType === "supervision_direct") supervisionDirect += row.duration;
  const supervisionIndirect = base.supervision - supervisionDirect;
  return {
    ...base,
    /** All approved hours: direct + indirect + supervision. */
    total: base.fieldwork,
    directTotal: round(base.direct + supervisionDirect),
    indirectTotal: round(base.indirect + supervisionIndirect),
  };
}

/**
 * One month (supervision period) checked against the rules.
 * `total` is all approved hours including supervision; `independent` defaults
 * to total − supervision (the hours worked without the supervisor present).
 */
export function evaluatePeriod(
  hours: { total: number; supervision: number; group: number; independent?: number },
  rules: Pick<CredentialRules, "monthlyMin" | "monthlyMax" | "supervisionRate" | "maxGroupRate"> &
    Partial<Pick<CredentialRules, "supervisionDenominator" | "monthlyBandBasis">>,
) {
  const independent = round(Math.max(0, hours.independent ?? hours.total - hours.supervision));
  const denominator = (rules.supervisionDenominator ?? "independent") === "independent" ? independent : hours.total;
  const bandHours = (rules.monthlyBandBasis ?? "independent") === "independent" ? independent : hours.total;
  const supervisionRate = denominator ? hours.supervision / denominator : 0;
  const groupRate = hours.supervision ? hours.group / hours.supervision : 0;
  const requiredSupervision = round(denominator * rules.supervisionRate);
  return {
    independent,
    bandHours,
    supervisionRate,
    groupRate,
    requiredSupervision,
    /** Supervision still needed this period to reach the rate. */
    supervisionShortfall: round(Math.max(0, requiredSupervision - hours.supervision)),
    validHoursBand: bandHours >= rules.monthlyMin && bandHours <= rules.monthlyMax,
    underMonthlyMin: bandHours < rules.monthlyMin,
    overMonthlyMax: bandHours > rules.monthlyMax,
    meetsSupervision: denominator > 0 && hours.supervision + 1e-9 >= requiredSupervision,
    meetsGroupLimit: hours.supervision === 0 || groupRate <= rules.maxGroupRate + 1e-9,
  };
}

/** Supervision a month needs for this many independent hours (the board's 5%). */
export function requiredSupervisionFor(independentHours: number, rules: Pick<CredentialRules, "supervisionRate"> = credentialRules("QBA")) {
  return round(Math.max(0, Number(independentHours) || 0) * rules.supervisionRate);
}

export function exceedsGroupSupervisionLimit(snapshot: { groupHours?: number; totalHours?: number; groupPercentage?: number }, credential: QabaCredential = "QASP-S") {
  const rate = Number(snapshot.totalHours) > 0
    ? Number(snapshot.groupHours || 0) / Number(snapshot.totalHours)
    : Number(snapshot.groupPercentage || 0) / 100;
  return rate > credentialRules(credential).maxGroupRate;
}

export function buildCompliance(
  activities: FieldworkActivity[],
  credential: QabaCredential | string,
  contractSignedAt?: string | null,
  options: { today?: string; completed?: boolean } = {},
) {
  const fieldworkStart = fieldworkStartDate(activities);
  const start = fieldworkStart || validDate(contractSignedAt);
  const rules = credentialRules(credential, start, {
    ...options,
    startDateSource: fieldworkStart ? "fieldwork" : start ? "contract" : null,
  });
  const approved = approvedHourRows(activities);
  const totals = hourBreakdown(approved);
  const fieldwork = totals.total;
  const directRate = fieldwork ? totals.directTotal / fieldwork : 0;
  const indirectRate = fieldwork ? totals.indirectTotal / fieldwork : 0;
  const meetsDirectLimit = directRate <= rules.maxDirectRate;
  const meetsIndirectMinimum = indirectRate >= rules.minIndirectRate;
  const byMonth = new Map<string, FieldworkActivity[]>();
  for (const row of approved) byMonth.set(row.month, [...(byMonth.get(row.month) || []), row]);
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, rows]) => {
      const v = hourBreakdown(rows);
      const period = evaluatePeriod(v, rules);
      return {
        month,
        fieldwork: v.total,
        direct: v.direct,
        indirect: v.indirect,
        directTotal: v.directTotal,
        indirectTotal: v.indirectTotal,
        supervision: v.supervision,
        group: v.group,
        ...period,
        directRate: v.total ? v.directTotal / v.total : 0,
        indirectRate: v.total ? v.indirectTotal / v.total : 0,
        // QABA applies the 40/60 distribution to the accumulated fieldwork.
        // Keep monthly ratios for coaching, but do not reject an otherwise valid
        // month because its local activity mix differs from the cumulative mix.
        meetsDirectLimit,
        meetsIndirectMinimum,
      };
    });
  const independent = round(Math.max(0, fieldwork - totals.supervision));
  return {
    rules,
    independent,
    /** Supervision needed across all approved hours so far (5% of the denominator in use). */
    requiredSupervision: round((rules.supervisionDenominator === "independent" ? independent : fieldwork) * rules.supervisionRate),
    direct: totals.direct,
    indirect: totals.indirect,
    directTotal: totals.directTotal,
    indirectTotal: totals.indirectTotal,
    supervision: totals.supervision,
    group: totals.group,
    fieldwork,
    directRate,
    indirectRate,
    meetsDirectLimit,
    meetsIndirectMinimum,
    months,
  };
}
