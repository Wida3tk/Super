import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readPreviousSupervisorWorkbook, hourFingerprint, reconcilePreviousHours } from "./previousSupervisorWorkbook";
function workbook() {
  const w = new ExcelJS.Workbook(), main = w.addWorksheet("لوحة المعلومات الرئيسية"), s = w.addWorksheet("Student");
  main.getCell("F2").value = "Previous supervisor"; s.getCell("K3").value = "Student";
  s.getCell("K4").value = { text: "student@example.com", hyperlink: "mailto:student@example.com" };
  s.getCell("B20").value = 1; s.getCell("L22").value = "فردي"; s.getCell("Q22").value = "جماعي";
  s.getCell("B23").value = new Date("2026-02-15T00:00:00Z"); s.getCell("L23").value = 1.5;
  s.getCell("B24").value = new Date("2026-02-20T00:00:00Z"); s.getCell("Q24").value = 2;
  return { w, s };
}
describe("previous supervisor workbook", () => {
  it("reads dated individual/group sessions but ignores work-hour totals and targets", () => {
    const { w, s } = workbook(); s.getCell("G12").value = 140; s.getCell("AL6").value = 75;
    const p = readPreviousSupervisorWorkbook(w, "2026-10-12"); expect(p.supervisorName).toBe("Previous supervisor"); expect(p.trainees[0].hours).toHaveLength(2); expect(p.trainees[0].hours.map(h => h.duration)).toEqual([1.5, 2]); expect(p.trainees[0].issues).toEqual([]);
  });
  it("blocks a sheet whose summary disagrees with session rows", () => {
    const { w, s } = workbook(); s.getCell("BP5").value = 12;
    expect(readPreviousSupervisorWorkbook(w, "2026-10-12").trainees[0].issues).toContain("الإجمالي في BP5 لا يطابق الجلسات");
  });
  it("reports invalid and future hours instead of silently importing partial records", () => {
    const { w, s } = workbook(); s.getCell("B23").value = new Date("2028-02-15T00:00:00Z"); s.getCell("Q24").value = -1;
    expect(readPreviousSupervisorWorkbook(w, "2026-10-12").trainees[0].issues.length).toBeGreaterThan(0);
  });
  it("uses stable fingerprints including type, date and duration", () => {
    expect(hourFingerprint({ date: "2026-02-15", format: "individual", duration: 1.5 })).toBe(hourFingerprint({ date: "2026-02-15", format: "individual", duration: 1.5000 }));
  });
  it("prevents reimport, preserves occurrence counts, and ignores locked months with no new hours", () => {
    const h = { date: "2026-02-15", duration: 1.5, format: "individual" as const, sourceRow: 23, sourceColumn: 12 };
    const existing = [{ ...h, status: "approved" }];
    const state = reconcilePreviousHours([h], existing, ["2026-02"], ["2026-02"]);
    expect(state.duplicates).toBe(1); expect(state.fresh).toEqual([]); expect(state.issues).toEqual([]);
    expect(reconcilePreviousHours([h, h], existing, [], []).fresh).toHaveLength(1);
  });
  it("blocks new hours in locked or previously credited months and pending matches", () => {
    const h = { date: "2026-02-15", duration: 1.5, format: "individual" as const, sourceRow: 23, sourceColumn: 12 };
    expect(reconcilePreviousHours([h], [], ["2026-02"], []).issues).toHaveLength(1);
    expect(reconcilePreviousHours([h], [], [], ["2026-02"]).issues).toHaveLength(1);
    expect(reconcilePreviousHours([h], [{ ...h, status: "submitted" }], [], []).issues).toHaveLength(1);
  });
});
