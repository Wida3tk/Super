import { expect, it } from "vitest";
import { approvalMonths, workspaceSections } from "./workspaceNavigation";
it("retains all nine workspace features exactly once in three sections", () => {
  const tabs = workspaceSections.flatMap(section => section.tabs.map(([key]) => key));
  expect(workspaceSections).toHaveLength(3);
  expect(new Set(tabs).size).toBe(9);
  expect(tabs.sort()).toEqual(["overview", "hours", "agreement", "documents", "meetings", "assessment", "plan", "improvement", "reports"].sort());
});
it("offers past months and the current month without duplicates or future dates", () => {
  expect(approvalMonths([{ month: "2026-09" }, { month: "2026-09" }, { month: "2026-12" }, { month: "2026-00" }], "2026-10"))
    .toEqual(["2026-10", "2026-09"]);
});
