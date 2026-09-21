export type ContinuationDecision = "continue" | "decline";

export function continuationOutcome(
  decision: ContinuationDecision,
  otherDecision: string,
) {
  const bothContinue = decision === "continue" && otherDecision === "continue";
  const declined = decision === "decline" || otherDecision === "decline";

  return {
    bothContinue,
    declined,
    stage: declined
      ? "interview_declined"
      : bothContinue
        ? "admin_review"
        : "awaiting_decisions",
  } as const;
}

export function shouldReleaseInterviewSeat(
  declined: boolean,
  bookingStatus: string,
  seatReleased: boolean,
) {
  return declined && bookingStatus !== "closed" && !seatReleased;
}
