import type { FieldworkActivity } from "@/types";

/**
 * Trainee acknowledgment of supervision sessions logged by the supervisor.
 * The supervisor records the session (it counts immediately, as before); the
 * trainee then confirms they attended, or disputes it with a note. A disputed
 * session blocks the monthly approval and the monthly acknowledgment until it
 * is resolved — by the trainee confirming it, or the supervisor deleting it.
 */
export type AckState = "pending" | "confirmed" | "disputed";

/** Only rows the supervisor created from a session need the trainee's word. */
export function needsAcknowledgment(row: Pick<FieldworkActivity, "sessionId" | "activityType" | "status">) {
  return Boolean(row.sessionId) && String(row.activityType || "").startsWith("supervision_") && row.status === "approved";
}

export function ackState(row: Pick<FieldworkActivity, "sessionId" | "activityType" | "status" | "traineeAcknowledgment">): AckState | null {
  if (!needsAcknowledgment(row)) return null;
  return row.traineeAcknowledgment?.status || "pending";
}

export function ackSummary(rows: FieldworkActivity[]) {
  let pending = 0, confirmed = 0, disputed = 0;
  for (const row of rows) {
    const state = ackState(row);
    if (state === "pending") pending++;
    else if (state === "confirmed") confirmed++;
    else if (state === "disputed") disputed++;
  }
  return { pending, confirmed, disputed };
}

export const DISPUTE_NOTE_MIN = 5;
