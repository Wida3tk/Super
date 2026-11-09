/**
 * A trainee's cumulative supervision hours for display.
 *
 * The approved* fields are rebuilt from the activity ledger by
 * syncTraineeFieldworkTotals and are the source of truth. The legacy
 * totalIndividualHours / totalGroupHours counters are used only for trainees
 * whose totals were never rebuilt (no fieldworkTotalsUpdatedAt), so their
 * screens do not drop to zero before the migration runs.
 */
export function traineeSupervisionHours(t: {
  approvedSupervisionHours?: number | null;
  approvedGroupSupervisionHours?: number | null;
  approvedIndividualSupervisionHours?: number | null;
  fieldworkTotalsUpdatedAt?: string | null;
  totalIndividualHours?: number | null;
  totalGroupHours?: number | null;
} | null | undefined) {
  const n = (v: unknown) => Number(v) || 0;
  const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  if (t?.fieldworkTotalsUpdatedAt && t.approvedSupervisionHours != null) {
    const total = n(t.approvedSupervisionHours);
    const group = n(t.approvedGroupSupervisionHours);
    const individual = t.approvedIndividualSupervisionHours != null ? n(t.approvedIndividualSupervisionHours) : Math.max(0, total - group);
    return { individual: round(individual), group: round(group), total: round(total), source: "ledger" as const };
  }
  const individual = n(t?.totalIndividualHours), group = n(t?.totalGroupHours);
  return { individual: round(individual), group: round(group), total: round(individual + group), source: "legacy" as const };
}
