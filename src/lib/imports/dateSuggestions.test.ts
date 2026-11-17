import { describe, expect, it } from "vitest";
import { suggestGroupMonth, suggestSessionDate } from "./dateSuggestions";

const today = "2026-11-17";

describe("suggestSessionDate", () => {
  it.each([
    ["3 Jan", "2026-01", "2026-01-03"],
    ["31 jan ", "2026-01", "2026-01-31"],
    ["22Jan ", "2026-01", "2026-01-22"],
    ["25dec", "2025-12", "2025-12-25"],
    ["14 march ", "2026-03", "2026-03-14"],
    ["22", "2026-04", "2026-04-22"],
    ["30", "2026-03", "2026-03-30"],
    ["23-9", "2025-09", "2025-09-23"],
    ["24oct2926", "2026-10", "2026-10-24"],
    ["16 aug2926", "2026-08", "2026-08-16"],
    ["4Oug2026", "2026-08", "2026-08-04"],
    ["5\\5\\2025", "2026-05", "2026-05-05"],
    ["21/4/2024", "2026-04", "2026-04-21"],
  ])("%s in %s → %s", (raw, month, expected) => {
    expect(suggestSessionDate(raw, month, today)).toBe(expected);
  });

  it("leaves sessions typed in another month's group for the admin", () => {
    expect(suggestSessionDate("2026-04-03", "2026-03", today)).toBe("");
    expect(suggestSessionDate("2025-06-12", "2025-12", today)).toBe("");
    expect(suggestSessionDate("2026-07-10", "2026-10", today)).toBe("");
    expect(suggestSessionDate("3 Feb", "2026-01", today)).toBe("");
    expect(suggestSessionDate("23-10", "2025-09", today)).toBe("");
  });

  it("refuses impossible, future or unclear text", () => {
    expect(suggestSessionDate("31", "2026-02", today)).toBe("");
    expect(suggestSessionDate("25", "2026-11", today)).toBe("");
    expect(suggestSessionDate("4Oug", "2026-08", today)).toBe("");
    expect(suggestSessionDate("Jan2026 20", "2026-01", today)).toBe("2026-01-20");
    expect(suggestSessionDate("الأحد", "2026-01", today)).toBe("");
    expect(suggestSessionDate("", "2026-01", today)).toBe("");
    expect(suggestSessionDate("3 Jan", "2027-01", today)).toBe("");
  });
});

it("suggests fixing a group month that is a year ahead", () => {
  expect(suggestGroupMonth("2026-08-29", "2027-08", today)).toBe("2026-08");
  expect(suggestGroupMonth("2026-07-29", "2027-08", today)).toBe("");
  expect(suggestGroupMonth("2026-08-29", "2026-08", today)).toBe("");
});
