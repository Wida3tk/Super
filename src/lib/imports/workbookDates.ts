import { scalarCellValue } from "./cellValue";

function digits(value: string) {
  return value.trim().replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
}

export function workbookDate(value: unknown, date1904 = false): string {
  const raw = scalarCellValue(value);
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw.toISOString().slice(0, 10) : "";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < (date1904 ? 0 : 61) || raw > 2957000) return "";
    return new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + Math.floor(raw) * 86400000).toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return "";
  const text = digits(raw);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}.*)?$/.exec(text);
  const local = /^(\d{1,2})([/.\-])(\d{1,2})\2(\d{4})$/.exec(text);
  const date = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : local ? `${local[4]}-${local[3].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

const monthNames = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"];
export function workbookMonth(value: unknown, date1904 = false): string {
  const date = workbookDate(value, date1904);
  if (date) return date.slice(0, 7);
  const raw = scalarCellValue(value);
  if (typeof raw !== "string") return "";
  const text = digits(raw).normalize("NFKD").replace(/\p{M}|ـ/gu, "");
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text;
  const match = /^(?:شهر\s+)?(.+?)\s+(\d{4})$/.exec(text);
  const month = match ? monthNames.indexOf(match[1]) + 1 : 0;
  return match && month ? `${match[2]}-${String(month).padStart(2, "0")}` : "";
}
