import type { FieldworkActivity } from "@/types";
import { approvedHourRows, calculateHourTotals } from "@/lib/fieldwork/hourTotals";

export type QabaCredential = "QASP-S" | "QBA";

/**
 * QABA rules used across the platform. One source for every screen.
 *
 * Decisions confirmed by the program (2026-11-02):
 * - Supervision hours count toward the trainee's hours: the 20–140 monthly
 *   band, the 5% rate and the credential total all use direct + indirect +
 *   supervision. Supervision rows split into direct/indirect by their type.
 * - QBA candidates whose supervision contract was signed before 2026-01-01
 *   need 1500 hours (900 indirect min, 600 direct max); from that date, 2000
 *   (1200 / 800). Without a contract date the current 2000-hour rule applies
 *   and the screens flag the missing date.
 * - The 20–140 monthly band comes from the board.
 */
export const QBA_2000_HOURS_FROM = "2026-01-01";

export type CredentialRules = ReturnType<typeof credentialRules>;

export function credentialRules(credential: QabaCredential | string | undefined, contractSignedAt?: string | null) {
  const shared = {
    monthlyMin: 20,
    monthlyMax: 140,
    supervisionRate: 0.05,
    maxGroupRate: 0.5,
    maxDirectRate: 0.4,
    minIndirectRate: 0.6,
  };
  const date = validDate(contractSignedAt);
  if (credential === "QASP-S")
    return {
      ...shared,
      credential: "QASP-S" as const,
      label: "مساعد محلل سلوك",
      total: 1000,
      supervisionTarget: 50,
      minIndirect: 600,
      maxDirect: 400,
      contractSignedAt: date,
      contractDateMissing: !date,
      version: "QASP-S",
    };
  const legacy = Boolean(date && date < QBA_2000_HOURS_FROM);
  return {
    ...shared,
    credential: "QBA" as const,
    label: "محلل سلوك",
    total: legacy ? 1500 : 2000,
    supervisionTarget: legacy ? 75 : 100,
    minIndirect: legacy ? 900 : 1200,
    maxDirect: legacy ? 600 : 800,
    contractSignedAt: date,
    contractDateMissing: !date,
    version: legacy ? "QBA-1500" : "QBA-2000",
  };
}

/** The contract date that decides the QBA requirement. */
export function contractDateFor(trainee: { contractSignedAt?: unknown } | null | undefined, agreement?: { signedAt?: unknown } | null) {
  return validDate(trainee?.contractSignedAt) || validDate(agreement?.signedAt) || null;
}

/** Rules for one trainee record (license + contract date). */
export function traineeRules(trainee: { license?: string; contractSignedAt?: unknown } | null | undefined, agreement?: { signedAt?: unknown } | null) {
  return credentialRules(trainee?.license || "QASP-S", contractDateFor(trainee, agreement));
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

/** One month (supervision period) checked against the rules. */
export function evaluatePeriod(
  hours: { total: number; supervision: number; group: number },
  rules: Pick<CredentialRules, "monthlyMin" | "monthlyMax" | "supervisionRate" | "maxGroupRate">,
) {
  const supervisionRate = hours.total ? hours.supervision / hours.total : 0;
  const groupRate = hours.supervision ? hours.group / hours.supervision : 0;
  const requiredSupervision = round(hours.total * rules.supervisionRate);
  return {
    supervisionRate,
    groupRate,
    requiredSupervision,
    /** Supervision still needed this period to reach the rate. */
    supervisionShortfall: round(Math.max(0, requiredSupervision - hours.supervision)),
    validHoursBand: hours.total >= rules.monthlyMin && hours.total <= rules.monthlyMax,
    meetsSupervision: hours.total > 0 && supervisionRate >= rules.supervisionRate,
    meetsGroupLimit: hours.supervision === 0 || groupRate <= rules.maxGroupRate,
  };
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
) {
  const rules = credentialRules(credential, contractSignedAt);
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
  return {
    rules,
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
