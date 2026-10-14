import { expect, it } from "vitest";
import { resolveReconciliation, type ReconciliationApproval } from "./reconciliation";
const approval = (decision: ReconciliationApproval["decision"]): ReconciliationApproval => ({ actorId: "a", decision, note: "Checked source", at: "now" });
it("never counts a record based on one approval", () => {
  expect(resolveReconciliation()).toBe("pending");
  expect(resolveReconciliation(approval("add_separate"))).toBe("pending");
  expect(resolveReconciliation(null, approval("add_separate"))).toBe("pending");
});
it("requires both reviewers to agree on the same decision", () => {
  expect(resolveReconciliation(approval("keep_existing"), approval("add_separate"))).toBe("disagreement");
  expect(resolveReconciliation(approval("add_separate"), approval("add_separate"))).toBe("add_separate");
  expect(resolveReconciliation(approval("keep_existing"), approval("keep_existing"))).toBe("keep_existing");
});
