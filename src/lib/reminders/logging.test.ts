import { describe, expect, it } from "vitest";
import { lastDayOfMonth, loggingReminders } from "./logging";

const serving = { serving: true, paused: false };

describe("loggingReminders", () => {
  it("reminds the trainee after a week, then trainee and supervisor after two", () => {
    expect(loggingReminders(serving, 6, "2026-11-04", 30, "2026-11-10")).toEqual([]);
    expect(loggingReminders(serving, 7, "2026-11-03", 30, "2026-11-10")).toEqual([{ kind: "week", toSupervisor: false, key: "2026-11-03" }]);
    expect(loggingReminders(serving, 14, "2026-10-27", 30, "2026-11-10")).toEqual([{ kind: "fortnight", toSupervisor: true, key: "2026-10-27" }]);
  });

  it("sends each reminder once per silence, and again after a new silence", () => {
    expect(loggingReminders(serving, 9, "2026-11-01", 30, "2026-11-10", { week: "2026-11-01" })).toEqual([]);
    expect(loggingReminders(serving, 20, "2026-10-21", 30, "2026-11-10", { week: "2026-10-21", fortnight: "2026-10-21" })).toEqual([]);
    expect(loggingReminders(serving, 7, "2026-11-03", 30, "2026-11-10", { week: "2026-10-21" })).toHaveLength(1);
  });

  it("warns in the last three days of a month under 20 hours, once", () => {
    expect(loggingReminders(serving, 1, "2026-11-26", 12, "2026-11-27")).toEqual([{ kind: "monthEnd", toSupervisor: false, key: "2026-11" }]);
    expect(loggingReminders(serving, 1, "2026-11-26", 12, "2026-11-26")).toEqual([]);
    expect(loggingReminders(serving, 1, "2026-11-26", 25, "2026-11-30")).toEqual([]);
    expect(loggingReminders(serving, 1, "2026-11-26", 12, "2026-11-30", { monthEnd: "2026-11" })).toEqual([]);
  });

  it("leaves paused trainees and those not in service alone", () => {
    expect(loggingReminders({ ...serving, paused: true }, 30, "2026-10-01", 0, "2026-11-30")).toEqual([]);
    expect(loggingReminders({ ...serving, serving: false }, 30, "2026-10-01", 0, "2026-11-30")).toEqual([]);
  });
});

it("finds the last day of the month, including February", () => {
  expect(lastDayOfMonth("2026-11-17")).toBe("2026-11-30");
  expect(lastDayOfMonth("2028-02-03")).toBe("2028-02-29");
});
