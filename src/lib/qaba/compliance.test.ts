import { describe, expect, it } from "vitest";
import { buildCompliance, credentialRules } from "./compliance";

describe("QABA compliance", () => {
  it("uses the configured analyst and assistant pathways", () => {
    expect(credentialRules("QASP-S").total).toBe(1000);
    expect(credentialRules("QASP-S").supervisionTarget).toBe(50);
    expect(credentialRules("QBA").total).toBe(2000);
    expect(credentialRules("QBA").supervisionTarget).toBe(100);
  });
  it("separates fieldwork from supervision and evaluates the month", () => {
    const rows = [
      {
        id: "1",
        traineeId: "t",
        supervisorId: "s",
        date: "2026-08-01",
        month: "2026-08",
        startTime: "08:00",
        endTime: "18:00",
        duration: 20,
        activityType: "direct",
        description: "x",
        status: "approved",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        traineeId: "t",
        supervisorId: "s",
        date: "2026-08-02",
        month: "2026-08",
        startTime: "08:00",
        endTime: "09:00",
        duration: 1,
        activityType: "supervision_direct",
        format: "individual",
        description: "x",
        status: "approved",
        createdAt: "",
        updatedAt: "",
      },
    ] as any;
    const result = buildCompliance(rows, "QASP-S");
    expect(result.fieldwork).toBe(20);
    expect(result.supervision).toBe(1);
    expect(result.months[0].meetsSupervision).toBe(true);
  });
});
