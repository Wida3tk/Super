import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { scalarCellValue } from "./cellValue";

describe("tracker cell values", () => {
  it("reads plain and rich-text hyperlinks", () => {
    expect(scalarCellValue({ text: "student@example.com", hyperlink: "mailto:student@example.com" })).toBe("student@example.com");
    expect(scalarCellValue({ text: { richText: [{ text: "student" }, { text: "@example.com" }] }, hyperlink: "mailto:student@example.com" })).toBe("student@example.com");
  });
  it("preserves dates, zero and cached formula values", () => {
    const date = new Date("2026-02-02T00:00:00Z");
    expect(scalarCellValue(date)).toBe(date);
    expect(scalarCellValue(0)).toBe(0);
    expect(scalarCellValue({ formula: "1+1", result: 2 })).toBe(2);
    expect(scalarCellValue(null)).toBe(null);
  });
  it("reads the rich-text hyperlink shape returned by ExcelJS after loading XLSX", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Supervisee Information");
    sheet.getCell("C6").value = { text: { richText: [{ text: "student@example.com" }] }, hyperlink: "mailto:student@example.com" } as unknown as ExcelJS.CellValue;
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(scalarCellValue(loaded.getWorksheet("Supervisee Information")!.getCell("C6").value)).toBe("student@example.com");
  });
});
