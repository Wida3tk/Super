import { describe, expect, it } from "vitest";
import { workbookDate, workbookMonth } from "./workbookDates";

describe("workbookDate", () => {
  it("reads Excel dates, serials and ISO text", () => {
    expect(workbookDate(new Date("2026-01-04T00:00:00Z"))).toBe("2026-01-04");
    expect(workbookDate(46026)).toBe("2026-01-04");
    expect(workbookDate("2026-01-04")).toBe("2026-01-04");
  });

  it("reads day-first text with the separators supervisors type", () => {
    expect(workbookDate("3/5/2026")).toBe("2026-05-03");
    expect(workbookDate("3\\5\\2026")).toBe("2026-05-03");
    expect(workbookDate("10.6.2026")).toBe("2026-06-10");
    expect(workbookDate("3 / 5 / 2026")).toBe("2026-05-03");
    expect(workbookDate("٣/٥/٢٠٢٦")).toBe("2026-05-03");
  });

  it("reads typed month names in English and Arabic", () => {
    expect(workbookDate("4 Jan 2026")).toBe("2026-01-04");
    expect(workbookDate("7 Feb2026")).toBe("2026-02-07");
    expect(workbookDate("13 January 2026")).toBe("2026-01-13");
    expect(workbookDate("1 Sept 2025")).toBe("2025-09-01");
    expect(workbookDate("4 يناير 2026")).toBe("2026-01-04");
    expect(workbookDate("4 أبريل 2026")).toBe("2026-04-04");
  });

  it("refuses what it cannot read for certain", () => {
    expect(workbookDate("31/2/2026")).toBe("");
    expect(workbookDate("4 Janx 2026")).toBe("");
    expect(workbookDate("الأحد")).toBe("");
    expect(workbookDate("5/2026")).toBe("");
  });
});

it("workbookMonth still reads month titles", () => {
  expect(workbookMonth("يناير 2026")).toBe("2026-01");
  expect(workbookMonth(new Date("2026-02-01T00:00:00Z"))).toBe("2026-02");
});
