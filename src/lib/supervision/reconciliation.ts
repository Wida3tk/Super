export type ReconciliationDecision = "keep_existing" | "add_separate";
export type ReconciliationApproval = { actorId: string; decision: ReconciliationDecision; note: string; at: string };
export function resolveReconciliation(admin?: ReconciliationApproval | null, supervisor?: ReconciliationApproval | null) {
  if (!admin || !supervisor) return "pending";
  if (admin.decision !== supervisor.decision) return "disagreement";
  return admin.decision;
}
