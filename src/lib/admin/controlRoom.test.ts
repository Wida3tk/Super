import { describe, expect, it } from "vitest";
import type { FieldworkActivity } from "@/types";
import { buildMonthCycle, buildMonthRow, stageFor, supervisorBacklog } from "./controlRoom";

const row = (over: Partial<FieldworkActivity>): FieldworkActivity => ({
  id: Math.random().toString(36).slice(2), traineeId: "T1", supervisorId: "S1", date: "2026-11-02", month: "2026-11",
  startTime: "", endTime: "", duration: 1, activityType: "direct", description: "", status: "approved",
  createdAt: "", updatedAt: "", ...over,
} as FieldworkActivity);
const trainee = { id: "T1", name: "متدرب", license: "QASP-S", currentSupervisorId: "S1" };

describe("stageFor", () => {
  it("follows the monthly cycle in order", () => {
    expect(stageFor([])).toBe("no_hours");
    expect(stageFor([row({ status: "rejected" })])).toBe("no_hours");
    expect(stageFor([row({ status: "draft" })])).toBe("trainee_drafting");
    expect(stageFor([row({ status: "draft" }), row({ status: "submitted" })])).toBe("awaiting_supervisor");
    expect(stageFor([row({})])).toBe("ready_to_approve");
    expect(stageFor([row({})], { traineeId: "T1", supervisorApprovedAt: "x" })).toBe("awaiting_trainee");
    expect(stageFor([row({})], { traineeId: "T1", supervisorApprovedAt: "x", traineeAcknowledgedAt: "y", locked: true })).toBe("locked");
  });
});

describe("buildMonthRow", () => {
  it("counts supervision inside the total and warns before the month closes", () => {
    const rows = [
      row({ activityType: "direct", duration: 40, status: "submitted" }),
      row({ activityType: "indirect", duration: 59 }),
      row({ activityType: "supervision_indirect", format: "group", duration: 1 }),
    ];
    const r = buildMonthRow(trainee, rows, null, false);
    expect(r.logged.total).toBe(100);
    expect(r.approved.total).toBe(60);
    expect(r.logged.required).toBe(5);
    expect(r.logged.shortfall).toBe(4);
    expect(r.pendingReview).toBe(1);
    expect(r.alerts).toEqual(["supervision_below_rate", "no_individual_contact", "group_over_limit"]);
  });

  it("is clean when the rules are met and only flags low hours once the month closes", () => {
    const rows = [row({ activityType: "indirect", duration: 18 }), row({ activityType: "supervision_direct", format: "individual", duration: 1 })];
    expect(buildMonthRow(trainee, rows, null, false).alerts).toEqual([]);
    expect(buildMonthRow(trainee, rows, null, true).alerts).toEqual(["under_monthly_min"]);
  });

  it("ignores rejected rows", () => {
    const r = buildMonthRow(trainee, [row({ duration: 200, status: "rejected" })], null, false);
    expect(r.logged.total).toBe(0);
    expect(r.alerts).toEqual([]);
  });
});

describe("buildMonthCycle", () => {
  it("projects legacy supervisor sessions like the trainee ledger", () => {
    const cycle = buildMonthCycle({
      trainees: [trainee, { id: "T2", name: "ب" }],
      activities: [row({ activityType: "indirect", duration: 19 })],
      sessions: [{ id: "S-1", data: { traineeIds: ["T1"], type: "individual", duration: 1, date: "2026-11-01", month: "2026-11", supervisorId: "S1" } }],
      approvals: [],
      monthClosed: false,
    });
    expect(cycle.rows[0].approved.total).toBe(20);
    expect(cycle.rows[0].hasIndividualContact).toBe(true);
    expect(cycle.rows[1].stage).toBe("no_hours");
    expect(cycle.stageCounts.ready_to_approve).toBe(1);
    expect(cycle.stageCounts.no_hours).toBe(1);
  });
});

describe("supervisorBacklog", () => {
  it("groups pending rows and reports the oldest age", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    const backlog = supervisorBacklog([
      { supervisorId: "S1", traineeId: "T1", createdAt: "2026-11-08T00:00:00Z" },
      { supervisorId: "S1", traineeId: "T2", createdAt: "2026-11-01T00:00:00Z" },
      { supervisorId: "S2", traineeId: "T3", createdAt: "2026-11-09T00:00:00Z" },
    ], now);
    expect(backlog[0]).toEqual({ supervisorId: "S1", count: 2, trainees: 2, oldestDays: 9 });
    expect(backlog[1].supervisorId).toBe("S2");
  });
});
