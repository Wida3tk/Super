import { describe, expect, it } from "vitest";
import { buildCompliance, contractDateFor, credentialRules, evaluatePeriod, exceedsGroupSupervisionLimit, RULE_SETS, traineeRules } from "./compliance";

describe("QABA compliance", () => {
  it("uses the configured group limit, including exact boundary values", () => {
    expect(exceedsGroupSupervisionLimit({ groupHours: 25, totalHours: 100 })).toBe(false);
    expect(exceedsGroupSupervisionLimit({ groupHours: 50, totalHours: 100 })).toBe(false);
    expect(exceedsGroupSupervisionLimit({ groupHours: 50.01, totalHours: 100, groupPercentage: 50 })).toBe(true);
    expect(exceedsGroupSupervisionLimit({ groupPercentage: 51 })).toBe(true);
  });
  it("uses the configured analyst and assistant pathways", () => {
    expect(credentialRules("QASP-S").total).toBe(1000);
    expect(credentialRules("QASP-S").supervisionTarget).toBe(50);
    expect(credentialRules("QBA").total).toBe(2000);
    expect(credentialRules("QBA").supervisionTarget).toBe(100);
  });
  it("separates fieldwork from supervision and evaluates the month", () => {
    const rows = [
      {
        id: "1",
        traineeId: "t",
        supervisorId: "s",
        date: "2026-08-01",
        month: "2026-08",
        startTime: "08:00",
        endTime: "18:00",
        duration: 20,
        activityType: "direct",
        description: "x",
        status: "approved",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        traineeId: "t",
        supervisorId: "s",
        date: "2026-08-02",
        month: "2026-08",
        startTime: "08:00",
        endTime: "09:00",
        duration: 1,
        activityType: "supervision_direct",
        format: "individual",
        description: "x",
        status: "approved",
        createdAt: "",
        updatedAt: "",
      },
    ] as any;
    const result = buildCompliance(rows, "QASP-S");
    expect(result.fieldwork).toBe(21);
    expect(result.supervision).toBe(1);
    // 20 independent hours: 5% = 1, so 1 hour of supervision meets the rate.
    expect(result.months[0].independent).toBe(20);
    expect(result.months[0].meetsSupervision).toBe(true);
  });

  it("applies the 40/60 activity distribution cumulatively, not per month", () => {
    const activity = (id: string, month: string, activityType: "direct" | "indirect", duration: number) => ({
      id, traineeId: "t", supervisorId: "s", date: `${month}-01`, month,
      startTime: "08:00", endTime: "09:00", duration, activityType,
      description: "x", status: "approved", createdAt: "", updatedAt: "",
    });
    const result = buildCompliance([
      activity("1", "2026-07", "indirect", 60),
      activity("2", "2026-08", "direct", 40),
    ] as any, "QASP-S");
    expect(result.directRate).toBe(0.4);
    expect(result.indirectRate).toBe(0.6);
    expect(result.meetsDirectLimit).toBe(true);
    expect(result.meetsIndirectMinimum).toBe(true);
    expect(result.months.every((month) => month.meetsDirectLimit && month.meetsIndirectMinimum)).toBe(true);
  });

  it("picks the QBA requirement from the contract date", () => {
    expect(credentialRules("QBA", "2025-12-31")).toMatchObject({ total: 1500, minIndirect: 900, maxDirect: 600, supervisionTarget: 75, contractDateMissing: false });
    expect(credentialRules("QBA", "2026-01-01")).toMatchObject({ total: 2000, minIndirect: 1200, maxDirect: 800, supervisionTarget: 100 });
    expect(credentialRules("QBA")).toMatchObject({ total: 2000, contractDateMissing: true });
    expect(credentialRules("QBA", "not a date").contractDateMissing).toBe(true);
    expect(credentialRules("QASP-S", "2020-01-01")).toMatchObject({ total: 1000, minIndirect: 600, maxDirect: 400 });
  });

  it("reads the contract date from the trainee first, then the agreement", () => {
    expect(contractDateFor({ contractSignedAt: "2025-05-01" }, { signedAt: "2026-02-01" })).toBe("2025-05-01");
    expect(contractDateFor({}, { signedAt: "2026-02-01T10:00:00.000Z" })).toBe("2026-02-01");
    expect(contractDateFor({}, null)).toBeNull();
    expect(traineeRules({ license: "QBA" }, { signedAt: "2025-06-01" }).total).toBe(1500);
  });

  it("takes the 5% and the 20–140 band from the independent hours, as the official monthly log does", () => {
    // 100 independent hours + 5 supervision: 5% of 100 = 5, so the month meets the rate.
    const ok = evaluatePeriod({ total: 105, supervision: 5, group: 0 }, credentialRules("QBA"));
    expect(ok.independent).toBe(100);
    expect(ok.requiredSupervision).toBe(5);
    expect(ok.meetsSupervision).toBe(true);
    expect(ok.supervisionShortfall).toBe(0);
    // 100 independent + 4 supervision is short by one hour.
    const short = evaluatePeriod({ total: 104, supervision: 4, group: 0 }, credentialRules("QBA"));
    expect(short.meetsSupervision).toBe(false);
    expect(short.supervisionShortfall).toBe(1);
    // 140 independent + 7 supervision stays inside the band; 141 independent does not.
    expect(evaluatePeriod({ total: 147, supervision: 7, group: 0 }, credentialRules("QBA")).validHoursBand).toBe(true);
    const over = evaluatePeriod({ total: 149, supervision: 8, group: 4 }, credentialRules("QBA"));
    expect(over.validHoursBand).toBe(false);
    expect(over.overMonthlyMax).toBe(true);
    // 19 independent + 1 supervision is under the minimum.
    expect(evaluatePeriod({ total: 20, supervision: 1, group: 0 }, credentialRules("QBA")).underMonthlyMin).toBe(true);
    expect(evaluatePeriod({ total: 100, supervision: 6, group: 3.1 }, credentialRules("QBA")).meetsGroupLimit).toBe(false);
    expect(evaluatePeriod({ total: 100, supervision: 6, group: 3 }, credentialRules("QBA")).meetsGroupLimit).toBe(true);
  });

  it("keeps the older denominator available as an explicit option", () => {
    const rules = { ...credentialRules("QBA"), supervisionDenominator: "independentPlusSupervision" as const };
    expect(evaluatePeriod({ total: 105, supervision: 5, group: 0 }, rules).meetsSupervision).toBe(false);
  });

  it("decides QBA 1500 vs 2000 by when fieldwork started and closes the 1500 route in 2029", () => {
    expect(credentialRules("QBA", "2025-06-01", { today: "2026-11-09" })).toMatchObject({ total: 1500, ruleSetId: "QABA-QBA-1500", legacyExpired: false });
    expect(credentialRules("QBA", "2025-06-01", { today: "2026-11-09" }).daysToLegacyDeadline).toBe(784);
    expect(credentialRules("QBA", "2025-06-01", { today: "2029-01-01" })).toMatchObject({ total: 2000, ruleSetId: "QABA-QBA-2000", legacyExpired: true });
    expect(credentialRules("QBA", "2025-06-01", { today: "2029-03-01", completed: true }).total).toBe(1500);
    // The first approved activity wins over a later contract date.
    const rules = traineeRules({ license: "QBA", fieldworkStartedAt: "2025-12-20", contractSignedAt: "2026-01-05" }, null, { today: "2026-11-09" });
    expect(rules).toMatchObject({ total: 1500, startDate: "2025-12-20", startDateSource: "fieldwork" });
    const activity = (date: string, status = "approved") => ({ id: date, traineeId: "t", supervisorId: "s", date, month: date.slice(0, 7), startTime: "", endTime: "", duration: 2, activityType: "indirect", description: "x", status, createdAt: "", updatedAt: "" });
    const compliance = buildCompliance([activity("2026-02-01"), activity("2025-11-15"), activity("2025-10-01", "rejected")] as any, "QBA", "2026-01-10", { today: "2026-11-09" });
    expect(compliance.rules).toMatchObject({ total: 1500, startDate: "2025-11-15", startDateSource: "fieldwork" });
  });

  it("keeps every rule set traceable to a board source", () => {
    for (const set of Object.values(RULE_SETS)) expect(set.sources.length).toBeGreaterThan(0);
  });

  it("splits supervision into direct and indirect by its type for the 40/60 rule", () => {
    const row = (id: string, activityType: string, duration: number) => ({
      id, traineeId: "t", supervisorId: "s", date: "2026-08-01", month: "2026-08",
      startTime: "", endTime: "", duration, activityType, format: "individual",
      description: "x", status: "approved", createdAt: "", updatedAt: "",
    });
    const result = buildCompliance([row("1", "direct", 38), row("2", "indirect", 57), row("3", "supervision_direct", 2), row("4", "supervision_indirect", 3)] as any, "QBA", "2026-03-01");
    expect(result.fieldwork).toBe(100);
    expect(result.directTotal).toBe(40);
    expect(result.indirectTotal).toBe(60);
    expect(result.meetsDirectLimit).toBe(true);
    expect(result.meetsIndirectMinimum).toBe(true);
    // 95 independent hours (38 + 57): 5% = 4.75, met by 5 hours of supervision.
    expect(result.months[0].requiredSupervision).toBe(4.75);
    expect(result.months[0].meetsSupervision).toBe(true);
  });
});
