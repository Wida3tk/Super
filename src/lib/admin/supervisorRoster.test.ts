import { describe, expect, it } from "vitest";
import { buildRoster, monthStart, sessionPay, supervisorHours, traineeStanding } from "./supervisorRoster";

const today = "2026-11-03";
const windowStart = "2026-09-01";
const t = (over: Record<string, unknown> = {}) => ({ id: "T1", name: "متدرب", license: "QASP-S", status: "active", currentSupervisorId: "S1", lifecycleStageChangedAt: "2026-01-01", approvedFieldworkHours: 300, ...over });
const log = (date: string, duration = 10, over: Record<string, unknown> = {}) => ({ traineeId: "T1", date, createdAt: `${date}T10:00:00Z`, duration, status: "submitted", ...over });

describe("traineeStanding", () => {
  it("flags 14 quiet days as inactive and 7 as watch", () => {
    expect(traineeStanding(t(), [log("2026-10-20")], today, windowStart).standing).toBe("inactive");
    expect(traineeStanding(t(), [log("2026-10-27")], today, windowStart).standing).toBe("watch");
    expect(traineeStanding(t(), [log("2026-11-01")], today, windowStart).standing).toBe("on_track");
  });

  it("ignores supervisor sessions, imports and rejected rows when judging activity", () => {
    const rows = [log("2026-11-02", 1, { sessionId: "s" }), log("2026-11-02", 5, { priorCreditId: "p" }), log("2026-11-02", 5, { status: "rejected" })];
    const standing = traineeStanding(t(), rows, today, windowStart);
    expect(standing.lastLogged).toBeNull();
    expect(standing.standing).toBe("inactive");
  });

  it("judges activity by the work date, so imported rows do not look recent", () => {
    expect(traineeStanding(t(), [log("2026-10-01", 5, { createdAt: "2026-11-02T08:00:00Z" })], today, windowStart).daysSinceLog).toBe(33);
  });

  it("marks near finish by remaining share or by pace", () => {
    // QASP-S needs 1000: 820 leaves 18%.
    expect(traineeStanding(t({ approvedFieldworkHours: 820 }), [log("2026-11-01")], today, windowStart).standing).toBe("near_finish");
    // 600 left at ~220 h/month finishes inside 3 months.
    const fast = [log("2026-09-10", 220), log("2026-10-10", 220), log("2026-11-01", 20)];
    const standing = traineeStanding(t({ approvedFieldworkHours: 400 }), fast, today, windowStart);
    expect(standing.standing).toBe("near_finish");
    expect(standing.projectedFinish).toBe("2027-01");
  });

  it("does not hide a stalled trainee who is near the end", () => {
    expect(traineeStanding(t({ approvedFieldworkHours: 900 }), [log("2026-10-01")], today, windowStart).standing).toBe("inactive");
  });

  it("never calls an approved pause inactive, and ignores trainees not in service", () => {
    expect(traineeStanding(t({ status: "paused" }), [], today, windowStart).standing).toBe("on_track");
    expect(traineeStanding(t({ status: "completed" }), [], today, windowStart)).toMatchObject({ standing: null, completed: true });
    expect(traineeStanding(t({ status: "onboarding" }), [], today, windowStart).standing).toBeNull();
  });

  it("gives a newly assigned trainee time before calling them inactive", () => {
    expect(traineeStanding(t({ lifecycleStageChangedAt: "2026-10-30", approvedFieldworkHours: 0 }), [], today, windowStart).standing).toBe("new");
    expect(traineeStanding(t({ lifecycleStageChangedAt: "2026-10-01", approvedFieldworkHours: 0 }), [], today, windowStart).standing).toBe("inactive");
  });

  it("uses the QBA requirement from the contract date", () => {
    expect(traineeStanding(t({ license: "QBA", contractSignedAt: "2025-06-01" }), [], today, windowStart).required).toBe(1500);
    expect(traineeStanding(t({ license: "QBA" }), [], today, windowStart).required).toBe(2000);
  });
});

describe("supervisor hours", () => {
  const sessions = [
    { id: "a", supervisorId: "S1", type: "group", duration: 1, month: "2026-11", traineeIds: ["T1", "T2", "T3", "T4"] },
    { id: "b", supervisorId: "S1", type: "individual", duration: 1.5, month: "2026-11", traineeIds: ["T1"] },
    { id: "c", supervisorId: "S1", type: "individual", duration: 1, month: "2026-11", traineeIds: ["T2"] },
    { id: "d", supervisorId: "S1", type: "absence", duration: null, month: "2026-11", traineeIds: ["T2"] },
    { id: "e", supervisorId: "S1", type: "individual", duration: 2, month: "2026-10", traineeIds: ["T2"] },
  ];
  const confirmed = { status: "confirmed" };
  const rows = [
    ...["T1", "T2", "T3", "T4"].map((traineeId) => ({ traineeId, sessionId: "a", traineeAcknowledgment: confirmed })),
    { traineeId: "T1", sessionId: "b" },
    { traineeId: "T2", sessionId: "c", traineeAcknowledgment: { status: "disputed" } },
  ];

  it("counts a group session once and pays only acknowledged sessions", () => {
    const hours = supervisorHours(sessions, rows, "2026-11").get("S1");
    expect(hours).toEqual({ payable: 1, pending: 1.5, disputed: 1, total: 3.5, sessions: 3, individual: 2.5, group: 1 });
  });

  it("treats sessions logged before acknowledgments as payable", () => {
    expect(sessionPay(sessions[4], [])).toBe("payable");
    expect(supervisorHours(sessions, rows, "2026-10").get("S1")?.payable).toBe(2);
  });

  it("builds supervisor cards with seats, graduates and attention counts", () => {
    const { cards } = buildRoster({
      supervisors: [{ id: "S1", name: "منى", availableSeats: 2 }, { id: "S2", name: "أحمد" }],
      trainees: [t(), t({ id: "T2", status: "completed" }), t({ id: "T3", status: "paused" }), t({ id: "T4", currentSupervisorId: "S2" })],
      rows: [log("2026-11-01"), { ...log("2026-11-01"), traineeId: "T4" }, ...rows],
      sessions,
      today,
      windowStart,
      currentMonth: "2026-11",
      previousMonth: "2026-10",
    });
    const mona = cards.find((card) => card.supervisorId === "S1")!;
    expect(mona).toMatchObject({ seats: 2, active: 1, paused: 1, graduates: 1 });
    expect(mona.hours.current.payable).toBe(1);
    expect(mona.hours.previous.total).toBe(2);
    expect(mona.counts.on_track).toBe(2);
  });
});

it("monthStart walks back across years", () => {
  expect(monthStart("2026-01", 2)).toBe("2025-11-01");
  expect(monthStart("2026-11")).toBe("2026-11-01");
});
