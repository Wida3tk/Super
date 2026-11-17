import { expect, it } from "vitest";
import { interviewAllowance, interviewsUsed } from "./interviews";

it("counts held, pending, closed and missed interviews but not cancelled ones or consultations", () => {
  expect(interviewsUsed([
    { status: "confirmed", meetingStatus: "pending" },
    { status: "closed", meetingStatus: "completed" },
    { status: "confirmed", meetingStatus: "missed" },
    { status: "cancelled" },
    { bookingType: "consultation", status: "confirmed" },
  ])).toBe(3);
});

it("includes two interviews and adds what the admin allows", () => {
  expect(interviewAllowance(undefined)).toBe(2);
  expect(interviewAllowance(1)).toBe(3);
  expect(interviewAllowance(-4)).toBe(2);
  expect(interviewAllowance("x")).toBe(2);
});
