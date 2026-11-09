import { describe, expect, it } from "vitest";
import { deliveredHoursBySupervisor, supervisorDeliveredHours } from "./supervisorHours";

const row = (over: Record<string, unknown>) => ({
  supervisorId: "S1", activityType: "supervision_indirect", status: "approved",
  date: "2026-10-05", month: "2026-10", startTime: "10:00", duration: 1, format: "individual", ...over,
});

describe("supervisor delivered hours", () => {
  it("counts a group session once for the supervisor, however many trainees attended", () => {
    const rows = [
      row({ traineeId: "a", format: "group", sessionId: "g1" }),
      row({ traineeId: "b", format: "group", sessionId: "g1" }),
      row({ traineeId: "c", format: "group", sessionId: "g1" }),
      row({ traineeId: "a", format: "individual", duration: 0.5, sessionId: "i1" }),
    ];
    expect(supervisorDeliveredHours(rows)).toEqual({ individual: 0.5, group: 1, total: 1.5, groupSessions: 1, individualSessions: 1 });
  });

  it("groups imported group rows without a session by supervisor, date, time and duration", () => {
    const rows = [
      row({ traineeId: "a", format: "group", duration: 1.5 }),
      row({ traineeId: "b", format: "group", duration: 1.5 }),
      row({ traineeId: "c", format: "group", duration: 1.5, date: "2026-10-12" }),
    ];
    expect(supervisorDeliveredHours(rows).group).toBe(3);
  });

  it("ignores rows that are not approved supervision, belong to another supervisor or month", () => {
    const rows = [
      row({ status: "submitted" }),
      row({ activityType: "indirect", duration: 10 }),
      row({ supervisorId: "S2" }),
      row({ month: "2026-09", date: "2026-09-30" }),
      row({}),
    ];
    expect(supervisorDeliveredHours(rows, { supervisorId: "S1", month: "2026-10" }).total).toBe(1);
  });

  it("splits by supervisor", () => {
    const result = deliveredHoursBySupervisor([row({ traineeId: "a" }), row({ supervisorId: "S2", traineeId: "b", format: "group", sessionId: "g" }), row({ supervisorId: "S2", traineeId: "c", format: "group", sessionId: "g" })], "2026-10");
    expect(result.S1.total).toBe(1);
    expect(result.S2).toMatchObject({ group: 1, total: 1 });
  });
});
