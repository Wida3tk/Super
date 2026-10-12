import { describe, expect, it } from "vitest";
import { validatePriorCredit } from "./priorCredit";
const valid = { supervisorName: "مشرف سابق", startDate: "2026-02-01", endDate: "2026-02-28", individualHours: 4, groupHours: 2, evidenceId: "evidence", mode: "new" };
describe("prior supervision credit validation", () => {
  it("accepts documented historical monthly balances and existing-hour references", () => {
    expect(validatePriorCredit(valid, "2026-10-12")).toBe(true);
    expect(validatePriorCredit({ ...valid, mode: "existing" }, "2026-10-12")).toBe(true);
  });
  it("rejects future, current, impossible, reversed and cross-month periods", () => {
    for (const patch of [{ startDate: "2026-02-30" }, { endDate: "2026-01-01" }, { endDate: "2026-03-01" }, { startDate: "2026-10-01", endDate: "2026-10-12" }, { startDate: "2027-01-01", endDate: "2027-01-02" }]) expect(validatePriorCredit({ ...valid, ...patch }, "2026-10-12")).toBe(false);
  });
  it("requires evidence, supervisor identity and numeric nonzero bounded hours", () => {
    for (const patch of [{ evidenceId: "" }, { supervisorName: " " }, { individualHours: -1 }, { groupHours: NaN }, { individualHours: "4" }, { individualHours: 0, groupHours: 0 }, { individualHours: 745 }, { individualHours: 1.001 }, { mode: "invalid" }]) expect(validatePriorCredit({ ...valid, ...patch }, "2026-10-12")).toBe(false);
  });
});
