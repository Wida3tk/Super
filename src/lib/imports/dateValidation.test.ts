import { describe, expect, it } from "vitest";
import { isHistoricalImportDate } from "./dateValidation";

describe("historical import dates", () => {
  it("accepts past dates and today", () => {
    expect(isHistoricalImportDate("2026-09-21", "2026-09-22")).toBe(true);
    expect(isHistoricalImportDate("2026-09-22", "2026-09-22")).toBe(true);
  });

  it("rejects future and malformed dates", () => {
    expect(isHistoricalImportDate("2028-12-31", "2026-09-22")).toBe(false);
    expect(isHistoricalImportDate("31-12-2025", "2026-09-22")).toBe(false);
  });
});
