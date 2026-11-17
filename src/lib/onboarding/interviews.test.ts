import { expect, it } from "vitest";
import { interviewAllowance, interviewsUsed, needsReschedule } from "./interviews";

it("counts held, pending and closed interviews; missed ones are rescheduled, cancelled ones and consultations never count", () => {
  expect(interviewsUsed([
    { status: "confirmed", meetingStatus: "pending" },
    { status: "closed", meetingStatus: "completed" },
    { status: "confirmed", meetingStatus: "missed" },
    { status: "cancelled" },
    { bookingType: "consultation", status: "confirmed" },
  ])).toBe(2);
});

it("flags a trainee whose latest interview was missed", () => {
  expect(needsReschedule([{ date: "2026-10-01", status: "closed", meetingStatus: "completed" }, { date: "2026-11-01", status: "confirmed", meetingStatus: "missed" }])).toBe(true);
  expect(needsReschedule([{ date: "2026-10-01", status: "confirmed", meetingStatus: "missed" }, { date: "2026-11-01", status: "confirmed", meetingStatus: "pending" }])).toBe(false);
});

it("includes two interviews and adds what the admin allows", () => {
  expect(interviewAllowance(undefined)).toBe(2);
  expect(interviewAllowance(1)).toBe(3);
  expect(interviewAllowance(-4)).toBe(2);
  expect(interviewAllowance("x")).toBe(2);
});
