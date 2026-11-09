import { expect, it } from "vitest";
import { traineeSupervisionHours } from "./traineeSupervision";

it("reads the ledger totals once they were rebuilt", () => {
  expect(traineeSupervisionHours({ fieldworkTotalsUpdatedAt: "2026-11-01", approvedSupervisionHours: 12, approvedGroupSupervisionHours: 2, approvedIndividualSupervisionHours: 10, totalIndividualHours: 12, totalGroupHours: 0 }))
    .toEqual({ individual: 10, group: 2, total: 12, source: "ledger" });
});
it("falls back to the legacy counters for trainees never rebuilt", () => {
  expect(traineeSupervisionHours({ totalIndividualHours: 15.5, totalGroupHours: 10 })).toEqual({ individual: 15.5, group: 10, total: 25.5, source: "legacy" });
  expect(traineeSupervisionHours(null).total).toBe(0);
});
