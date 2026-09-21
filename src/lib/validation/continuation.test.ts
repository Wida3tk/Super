import { describe, expect, it } from "vitest";
import {
  continuationOutcome,
  shouldReleaseInterviewSeat,
} from "./continuation";

describe("continuation decisions", () => {
  it("moves to admin review only after both parties continue", () => {
    expect(continuationOutcome("continue", "pending")).toMatchObject({
      stage: "awaiting_decisions",
      bothContinue: false,
    });
    expect(continuationOutcome("continue", "continue")).toMatchObject({
      stage: "admin_review",
      bothContinue: true,
    });
  });

  it("closes the interview when either party declines", () => {
    expect(continuationOutcome("decline", "pending")).toMatchObject({
      stage: "interview_declined",
      declined: true,
    });
    expect(continuationOutcome("continue", "decline")).toMatchObject({
      stage: "interview_declined",
      declined: true,
    });
  });

  it("releases a seat exactly once", () => {
    expect(shouldReleaseInterviewSeat(true, "confirmed", false)).toBe(true);
    expect(shouldReleaseInterviewSeat(true, "closed", false)).toBe(false);
    expect(shouldReleaseInterviewSeat(true, "confirmed", true)).toBe(false);
    expect(shouldReleaseInterviewSeat(false, "confirmed", false)).toBe(false);
  });
});
