import { describe, expect, it } from "vitest";
import { boardColumn, monthlyMovement, previousStage } from "./onboarding";

describe("boardColumn", () => {
  it("places applicants by stage and keeps declined ones apart", () => {
    expect(boardColumn({ lifecycleStage: "registered" })).toBe("registered");
    expect(boardColumn({ status: "onboarding", onboardingStage: "initial_interview" })).toBe("initial_interview");
    expect(boardColumn({ status: "onboarding", onboardingStage: "awaiting_decisions" })).toBe("post_interview");
    expect(boardColumn({ status: "onboarding", onboardingStage: "ready_assignment" })).toBe("contracting");
    expect(boardColumn({ lifecycleStage: "post_interview", onboardingStage: "interview_declined" })).toBe("declined");
  });

  it("leaves trainees in service, paused or completed out of the pipeline", () => {
    expect(boardColumn({ status: "active" })).toBeNull();
    expect(boardColumn({ lifecycleStage: "approved_pause" })).toBeNull();
    expect(boardColumn({ status: "completed" })).toBeNull();
    expect(boardColumn({ lifecycleStage: "registered", isDemo: true })).toBeNull();
  });

  it("knows the step before", () => {
    expect(previousStage("contracting")).toBe("post_interview");
    expect(previousStage("registered")).toBeNull();
  });
});

it("counts each step once per trainee per month", () => {
  const moves = [
    { traineeId: "a", toStage: "initial_interview", changedMonth: "2026-11" },
    { traineeId: "a", toStage: "post_interview", changedMonth: "2026-11" },
    { traineeId: "a", toStage: "initial_interview", changedMonth: "2026-11" },
    { traineeId: "b", toStage: "contracting", changedMonth: "2026-10" },
    { traineeId: "b", fromStage: "contracting", toStage: "active_service", changedMonth: "2026-11" },
    // A return from a pause is not a new assignment.
    { traineeId: "c", fromStage: "approved_pause", toStage: "active_service", changedMonth: "2026-11" },
    { traineeId: "d", toStage: "interview_declined", changedMonth: "2026-11" },
  ];
  const result = monthlyMovement(["2026-10", "2026-11"], moves, [{ createdAt: "2026-11-03T00:00:00Z" }, { createdAt: "2026-09-01" }]);
  expect(result.get("2026-11")).toEqual({ applications: 1, interviews: 1, decisions: 1, contracting: 0, assigned: 1, declined: 1 });
  expect(result.get("2026-10")!.contracting).toBe(1);
});
