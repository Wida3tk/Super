import { describe, expect, it } from "vitest";
import { buildCompliance, contractDateFor, credentialRules, evaluatePeriod, exceedsGroupSupervisionLimit, traineeRules } from "./compliance";

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
    expect(result.months[0].meetsSupervision).toBe(false);
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

  it("counts supervision inside the month total for the 5% rate and the 20–140 band", () => {
    // 100 own hours + 5 supervision = 105; 5% of 105 = 5.25, so 5 hours is short.
    const short = evaluatePeriod({ total: 105, supervision: 5, group: 0 }, credentialRules("QBA"));
    expect(short.requiredSupervision).toBe(5.25);
    expect(short.meetsSupervision).toBe(false);
    expect(short.supervisionShortfall).toBe(0.25);
    const ok = evaluatePeriod({ total: 20, supervision: 1, group: 0 }, credentialRules("QBA"));
    expect(ok.meetsSupervision).toBe(true);
    expect(ok.validHoursBand).toBe(true);
    expect(evaluatePeriod({ total: 141, supervision: 8, group: 4 }, credentialRules("QBA")).validHoursBand).toBe(false);
    expect(evaluatePeriod({ total: 100, supervision: 6, group: 3.1 }, credentialRules("QBA")).meetsGroupLimit).toBe(false);
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
    expect(result.months[0].requiredSupervision).toBe(5);
    expect(result.months[0].meetsSupervision).toBe(true);
  });
});
