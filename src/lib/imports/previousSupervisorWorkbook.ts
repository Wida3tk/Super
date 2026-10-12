import ExcelJS from "exceljs";
import { scalarCellValue } from "./cellValue";
import { isHistoricalImportDate } from "./dateValidation";
export type PreviousHour = { date: string; duration: number; format: "individual" | "group"; sourceRow: number; sourceColumn: number };
export const hourFingerprint = (row: { date: string; duration: number; format: string }) => `${row.date}|${row.format}|${Number(row.duration).toFixed(4)}`;
export function reconcilePreviousHours(hours: PreviousHour[], existing: Array<{ date: string; duration: number; format: string; status: string }>, lockedMonths: string[], protectedMonths: string[]) {
  const issues: string[] = [], counts = new Map<string, number>();
  for (const row of existing) {
    if (row.status !== "approved" && hours.some(h => h.date.slice(0, 7) === String(row.date).slice(0, 7))) issues.push("ساعات إشراف غير معتمدة تحتاج مراجعة");
    const fp = hourFingerprint(row); counts.set(fp, (counts.get(fp) || 0) + 1);
  }
  let duplicates = 0;
  const fresh = hours.filter(h => { const fp = hourFingerprint(h), count = counts.get(fp) || 0; if (count) { counts.set(fp, count - 1); duplicates++; return false; } return true; });
  for (const h of fresh) {
    const month = h.date.slice(0, 7);
    if (lockedMonths.includes(month)) issues.push(`الشهر ${month} مقفل`);
    if (protectedMonths.includes(month)) issues.push(`رصيد سابق معتمد في ${month} يحتاج مطابقة قبل الإضافة`);
  }
  return { issues: [...new Set(issues)], duplicates, fresh };
}
const text = (value: unknown) => String(scalarCellValue(value) ?? "").trim();
function dateOf(value: unknown) {
  const v = scalarCellValue(value);
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 100000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  return text(v).slice(0, 10);
}
export function readPreviousSupervisorWorkbook(workbook: ExcelJS.Workbook, today: string) {
  const main = workbook.getWorksheet("لوحة المعلومات الرئيسية");
  const supervisorName = main ? text(main.getCell("F2").value) : "";
  const trainees: Array<{ sheet: string; name: string; email: string; hours: PreviousHour[]; issues: string[] }> = [];
  for (const sheet of workbook.worksheets) {
    const email = text(sheet.getCell("K4").value).toLowerCase();
    const name = text(sheet.getCell("K3").value);
    if (!email.includes("@") || !name) continue;
    const hours: PreviousHour[] = [], issues: string[] = [];
    for (const blockRow of [20, 33, 46, 59, 72]) {
      const starts: Array<{ column: number }> = [];
      sheet.getRow(blockRow).eachCell((cell, column) => {
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const month = Number(text(cell.value));
        if (Number.isInteger(month) && month >= 1 && month <= 20) starts.push({ column });
      });
      starts.sort((a, b) => a.column - b.column);
      for (let i = 0; i < starts.length; i++) {
        const start = starts[i].column, end = (starts[i + 1]?.column || Math.min(sheet.columnCount, 100) + 1) - 1;
        const cols: Array<{ column: number; format: "individual" | "group" }> = [];
        for (let col = start; col <= end; col++) {
          const cell = sheet.getCell(blockRow + 2, col);
          if (cell.isMerged && cell.master.address !== cell.address) continue;
          const label = text(cell.value).replace(/\s/g, "");
          if (label.includes("فردي")) cols.push({ column: col, format: "individual" });
          if (label.includes("جماعي")) cols.push({ column: col, format: "group" });
        }
        for (let row = blockRow + 3; row < blockRow + 10; row++) for (const col of cols) {
          const raw = scalarCellValue(sheet.getCell(row, col.column).value);
          if (raw == null || raw === "" || Number(raw) === 0) continue;
          const duration = Number(raw), date = dateOf(sheet.getCell(row, start).value);
          if (!Number.isFinite(duration) || duration <= 0 || duration > 16 || !isHistoricalImportDate(date, today)) { issues.push(`سجل غير صالح أو مستقبلي: ${sheet.getCell(row, col.column).address}`); continue; }
          hours.push({ date, duration, format: col.format, sourceRow: row, sourceColumn: col.column });
        }
      }
    }
    const individual = hours.filter(h => h.format === "individual").reduce((n, h) => n + h.duration, 0);
    const group = hours.filter(h => h.format === "group").reduce((n, h) => n + h.duration, 0);
    for (const [address, calculated] of [["BP3", individual], ["BP4", group], ["BP5", individual + group]] as const) {
      const cached = scalarCellValue(sheet.getCell(address).value);
      if (cached != null && cached !== "" && (!Number.isFinite(Number(cached)) || Math.abs(Number(cached) - calculated) > 0.001)) issues.push(`الإجمالي في ${address} لا يطابق الجلسات`);
    }
    if (!hours.length) issues.push("لا توجد جلسات صالحة");
    trainees.push({ sheet: sheet.name, name, email, hours, issues });
  }
  const emails = new Set<string>();
  for (const trainee of trainees) { if (emails.has(trainee.email)) { trainee.issues.push("البريد مكرر في أكثر من تبويبة"); trainees.filter(t => t.email === trainee.email).forEach(t => { if (!t.issues.includes("البريد مكرر في أكثر من تبويبة")) t.issues.push("البريد مكرر في أكثر من تبويبة"); }); } emails.add(trainee.email); }
  return { supervisorName, trainees };
}
