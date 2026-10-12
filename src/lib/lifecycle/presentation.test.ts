import { describe, expect, it } from "vitest";
import { mainStageIndex, MAIN_STAGES } from "./presentation";

describe("supervision progress presentation", () => {
  it("shows exactly the requested five milestones", () => {
    expect(MAIN_STAGES.map((item) => item.label)).toEqual([
      "تقديم الطلب", "المقابلة", "اعتماد الاتفاقية", "البدء بالإشراف", "انتهاء الإشراف",
    ]);
  });
  it("keeps post-interview within the interview milestone", () => {
    expect(mainStageIndex({ lifecycleStage: "post_interview" })).toBe(1);
  });
  it.each(["approved_pause", "supervisor_transfer", "platform_suspension", "financial_clearance"])(
    "preserves the last evidenced milestone during %s", (stage) => {
      const trainee = { id: "t1", lifecycleStage: stage, currentSupervisorId: "s1" };
      const transitions = [{ traineeId: "t1", fromStage: "contracting", toStage: stage, changedAt: "2026-10-12" }];
      expect(mainStageIndex(trainee, transitions)).toBe(2);
      expect(trainee.lifecycleStage).toBe(stage);
    },
  );
  it("ignores another trainee's history", () => {
    expect(mainStageIndex({ id: "t1", lifecycleStage: "approved_pause" }, [
      { traineeId: "t2", toStage: "completed" },
    ])).toBe(0);
  });
  it("shows completion only for a completed basic stage", () => {
    expect(mainStageIndex({ lifecycleStage: "completed" })).toBe(4);
  });
});
