import { describe, expect, it } from "vitest";
import { hourDateProblem, isDuplicateSession } from "./hourEligibility";

describe("hour eligibility (QABA)", () => {
  const base = { today: "2026-11-09", courseworkStartDate: "2025-01-10", fieldworkStartDate: "2025-02-01" };
  it("accepts a date inside the contract, after coursework, with an active supervisor", () => {
    expect(hourDateProblem({ ...base, date: "2026-10-05", supervisorCredentialExpiresAt: "2028-01-07" })).toBeNull();
  });
  it("rejects dates the board does not count", () => {
    expect(hourDateProblem({ ...base, date: "2026-13-01" })).toBe("INVALID_DATE");
    expect(hourDateProblem({ ...base, date: "2026-11-10" })).toBe("FUTURE_DATE");
    expect(hourDateProblem({ ...base, date: "2025-01-05" })).toBe("BEFORE_COURSEWORK_START");
    expect(hourDateProblem({ ...base, date: "2025-01-20" })).toBe("BEFORE_FIELDWORK_START");
    expect(hourDateProblem({ today: "2026-11-09", date: "2019-11-08" })).toBe("OUTSIDE_ACCRUAL_WINDOW");
    expect(hourDateProblem({ ...base, date: "2026-10-05", supervisorCredentialExpiresAt: "2026-09-30" })).toBe("SUPERVISOR_CREDENTIAL_EXPIRED");
  });
  it("finds a session logged twice regardless of trainee order", () => {
    const existing = [{ type: "group", duration: 1, traineeIds: ["a", "b"] }, { type: "individual", duration: 1, traineeIds: ["c"], deletedAt: "x" }];
    expect(isDuplicateSession({ type: "group", duration: 1, traineeIds: ["b", "a"] }, existing)).toBe(true);
    expect(isDuplicateSession({ type: "group", duration: 1.5, traineeIds: ["a", "b"] }, existing)).toBe(false);
    expect(isDuplicateSession({ type: "individual", duration: 1, traineeIds: ["c"] }, existing)).toBe(false);
  });
});
