import { describe, expect, it } from "vitest";
import { calculateHourTotals } from "./hourTotals";
import { buildCompliance } from "@/lib/qaba/compliance";
const row = (activityType: string, duration: unknown, extra = {}) => ({
  activityType, duration, status: "approved", month: "2026-10", ...extra,
} as any);
describe("canonical hour totals", () => {
  it("counts supervisor hours once and separates individual/group", () => {
    expect(calculateHourTotals([row("direct", 20), row("indirect", 60),
      row("supervision_indirect", 15.5, { format: "individual" }),
      row("supervision_direct", 10, { format: "group", priorCreditId: "old-supervisor" })]))
      .toEqual({ direct: 20, indirect: 60, individual: 15.5, group: 10, supervision: 25.5, fieldwork: 105.5 });
  });
  it("excludes unapproved, invalid and unrecognized records", () => {
    expect(calculateHourTotals([row("direct", NaN), row("indirect", Infinity),
      row("direct", -1), row("direct", 0), row("unknown", 999),
      row("direct", 5, { status: "submitted" }), row("direct", 8, { status: "rejected" }),
      row("direct", "2.5")]).fieldwork).toBe(2.5);
  });
  it("avoids floating point artifacts and matches compliance totals", () => {
    const rows = [row("direct", 0.1), row("direct", 0.2), row("indirect", "0.6"), row("unknown", 99)];
    const totals = calculateHourTotals(rows);
    const compliance = buildCompliance(rows, "QASP-S");
    expect(totals.direct).toBe(0.3);
    expect(totals.fieldwork).toBe(0.9);
    expect(compliance.fieldwork).toBe(totals.fieldwork);
    expect(compliance.direct).toBe(totals.direct);
    expect(compliance.months[0].fieldwork).toBeCloseTo(0.9);
  });
});
