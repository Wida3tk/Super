/**
 * QABA rule sets, versioned. One record per credential requirement.
 *
 * A board change is a new record with its own id and effective date; existing
 * records are never edited, so a trainee's numbers never move under them.
 * Every number here comes from the pages listed in `sources` (checked
 * 2026-11-09). Open questions are listed in docs/blueprint/OPEN-QUESTIONS.md.
 */

export type RuleBoard = "QABA";
export type RuleCredential = "QBA" | "QASP-S";
export type RuleSetId = "QABA-QBA-1500" | "QABA-QBA-2000" | "QABA-QASP-S-1000";

export interface RuleSet {
  id: RuleSetId;
  board: RuleBoard;
  credential: RuleCredential;
  label: string;
  effectiveFrom: string;
  /** Total experience hours: direct + indirect + supervision (Final Verification line D). */
  total: number;
  minIndirect: number;
  maxDirect: number;
  supervisionTarget: number;
  monthlyMin: number;
  monthlyMax: number;
  supervisionRate: number;
  /**
   * What the 5% is taken of. The official monthly log computes
   * supervised ÷ independent (direct + indirect without the supervisor).
   */
  supervisionDenominator: "independent" | "independentPlusSupervision";
  /** Which hours the 20–140 monthly band applies to. */
  monthlyBandBasis: "independent" | "independentPlusSupervision";
  maxGroupRate: number;
  maxDirectRate: number;
  minIndirectRate: number;
  /** At least one live (in person or synchronous video) contact of this length each month. */
  minMonthlyLiveContactHours: number;
  /** Hours older than this window before certification do not count. */
  accrualWindowYears: number;
  /** Candidates on this set must finish by this date, otherwise the successor applies. */
  legacyDeadline?: string;
  successor?: RuleSetId;
  sources: string[];
}

const QBA_SOURCES = [
  "https://qababoard.com/?p=1576",
  "https://qababoard.com/wp-content/uploads/Pre-QBA-Certification-Monthly-Supervision-Log-2025-1-1.pdf",
];
const QASP_SOURCES = [
  "https://qababoard.com/?p=2095",
  "https://qababoard.com/pages/?p=9185",
];

const SHARED = {
  board: "QABA" as const,
  monthlyMin: 20,
  monthlyMax: 140,
  supervisionRate: 0.05,
  supervisionDenominator: "independent" as const,
  monthlyBandBasis: "independent" as const,
  maxGroupRate: 0.5,
  maxDirectRate: 0.4,
  minIndirectRate: 0.6,
  minMonthlyLiveContactHours: 1,
  accrualWindowYears: 7,
};

/** Fieldwork started on or after this date needs 2000 QBA hours. */
export const QBA_2000_HOURS_FROM = "2026-01-01";
/** Candidates who started earlier keep 1500 hours only if they finish before this date. */
export const QBA_1500_DEADLINE = "2029-01-01";

export const RULE_SETS: Record<RuleSetId, RuleSet> = {
  "QABA-QBA-1500": {
    ...SHARED,
    id: "QABA-QBA-1500",
    credential: "QBA",
    label: "محلل سلوك",
    effectiveFrom: "2022-01-01",
    total: 1500,
    minIndirect: 900,
    maxDirect: 600,
    supervisionTarget: 75,
    legacyDeadline: QBA_1500_DEADLINE,
    successor: "QABA-QBA-2000",
    sources: QBA_SOURCES,
  },
  "QABA-QBA-2000": {
    ...SHARED,
    id: "QABA-QBA-2000",
    credential: "QBA",
    label: "محلل سلوك",
    effectiveFrom: QBA_2000_HOURS_FROM,
    total: 2000,
    minIndirect: 1200,
    maxDirect: 800,
    supervisionTarget: 100,
    sources: QBA_SOURCES,
  },
  "QABA-QASP-S-1000": {
    ...SHARED,
    id: "QABA-QASP-S-1000",
    credential: "QASP-S",
    label: "مساعد محلل سلوك",
    effectiveFrom: "2022-01-01",
    total: 1000,
    minIndirect: 600,
    maxDirect: 400,
    supervisionTarget: 50,
    sources: QASP_SOURCES,
  },
};

export interface RuleSelection {
  ruleSet: RuleSet;
  /** True when a pre-2026 QBA candidate missed the 1500-hour deadline and moved to 2000. */
  legacyExpired: boolean;
}

/**
 * Picks the rule set for a credential from the date fieldwork started.
 * QABA decides 1500 vs 2000 by the fieldwork start date, not the contract
 * date, and the 1500-hour route closes on QBA_1500_DEADLINE for anyone who
 * has not finished.
 */
export function selectRuleSet(
  credential: string | undefined,
  startDate: string | null,
  options: { today?: string; completed?: boolean } = {},
): RuleSelection {
  if (credential === "QASP-S") return { ruleSet: RULE_SETS["QABA-QASP-S-1000"], legacyExpired: false };
  if (!startDate || startDate >= QBA_2000_HOURS_FROM) return { ruleSet: RULE_SETS["QABA-QBA-2000"], legacyExpired: false };
  const legacy = RULE_SETS["QABA-QBA-1500"];
  const today = options.today || new Date().toISOString().slice(0, 10);
  if (!options.completed && legacy.legacyDeadline && today >= legacy.legacyDeadline)
    return { ruleSet: RULE_SETS["QABA-QBA-2000"], legacyExpired: true };
  return { ruleSet: legacy, legacyExpired: false };
}
