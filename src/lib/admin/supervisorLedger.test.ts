import { describe, expect, it } from "vitest";
import { ledgerHistory, supervisorLedger } from "./supervisorLedger";

const row = (over: Record<string, unknown>) => ({ traineeId: "T1", supervisorId: "S1", date: "2026-10-05", duration: 1, format: "individual", status: "approved", activityType: "supervision_indirect", ...over });

describe("supervisorLedger", () => {
  it("pays a group session once however many trainees attended (imported rows)", () => {
    const rows = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"].map((traineeId) => row({ traineeId, format: "group" }));
    expect(supervisorLedger([], rows).get("S1")!.get("2026-10")).toMatchObject({ total: 1, group: 1, sessions: 1, payable: 1 });
  });

  it("keeps separate group sessions on different days or with different durations", () => {
    const rows = [row({ format: "group" }), row({ traineeId: "T2", format: "group" }), row({ format: "group", date: "2026-10-12" }), row({ format: "group", duration: 2 })];
    expect(supervisorLedger([], rows).get("S1")!.get("2026-10")!.group).toBe(4);
  });

  it("counts each individual hour", () => {
    expect(supervisorLedger([], [row({}), row({ traineeId: "T2" })]).get("S1")!.get("2026-10")!.individual).toBe(2);
  });

  it("counts platform sessions once and skips rows already covered by them", () => {
    const sessions = [{ id: "s1", supervisorId: "S1", type: "group", duration: 1.5, month: "2026-11", date: "2026-11-02", traineeIds: ["T1", "T2"] }];
    const rows = [
      row({ sessionId: "s1", date: "2026-11-02", traineeAcknowledgment: { status: "confirmed" } }),
      row({ sessionId: "s1", traineeId: "T2", date: "2026-11-02", traineeAcknowledgment: { status: "confirmed" } }),
      // The same meeting logged by the trainee as well.
      row({ date: "2026-11-02", format: "group" }),
    ];
    expect(supervisorLedger(sessions, rows).get("S1")!.get("2026-11")).toMatchObject({ total: 1.5, payable: 1.5, sessions: 1 });
  });

  it("holds unacknowledged and disputed sessions apart from payable ones", () => {
    const sessions = [
      { id: "a", supervisorId: "S1", type: "individual", duration: 1, month: "2026-11", date: "2026-11-01", traineeIds: ["T1"] },
      { id: "b", supervisorId: "S1", type: "individual", duration: 1, month: "2026-11", date: "2026-11-03", traineeIds: ["T1"] },
    ];
    const rows = [row({ sessionId: "a" }), row({ sessionId: "b", traineeAcknowledgment: { status: "disputed" } })];
    expect(supervisorLedger(sessions, rows).get("S1")!.get("2026-11")).toMatchObject({ pending: 1, disputed: 1, payable: 0 });
  });

  it("ignores prior credit, unapproved rows and non-supervision work", () => {
    const rows = [row({ priorCreditId: "p" }), row({ status: "submitted" }), row({ activityType: "direct" }), row({ duration: 0 })];
    expect(supervisorLedger([], rows).get("S1")).toBeUndefined();
  });
});

it("ledgerHistory adds a running total, newest month first", () => {
  const ledger = supervisorLedger([], [row({ date: "2026-09-01" }), row({ date: "2026-10-01", duration: 2 })]);
  const history = ledgerHistory(ledger.get("S1"));
  expect(history.months.map((m) => [m.month, m.total, m.cumulative])).toEqual([["2026-10", 2, 3], ["2026-09", 1, 1]]);
  expect(history.cumulative).toBe(3);
});
