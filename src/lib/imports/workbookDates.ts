import { scalarCellValue } from "./cellValue";

function digits(value: string) {
  // Arabic keyboards add invisible direction marks around typed dates.
  return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff\u00a0]/g, " ").trim()
    .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
}

export function workbookDate(value: unknown, date1904 = false): string {
  const raw = scalarCellValue(value);
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw.toISOString().slice(0, 10) : "";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < (date1904 ? 0 : 61) || raw > 2957000) return "";
    return new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + Math.floor(raw) * 86400000).toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return "";
  const text = digits(raw).replace(/\s+/g, " ");
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}.*)?$/.exec(text);
  // Day first, as the workbooks are filled in Saudi Arabia: 3/5/2026, 3\5\2026, 3 / 5 / 2026.
  const local = /^(\d{1,2}) ?([/.\-\\]) ?(\d{1,2}) ?\2 ?(\d{4})$/.exec(text);
  // Typed month names: "4 Jan 2026", "7 Feb2026", "4 يناير 2026".
  const named = /^(\d{1,2})[ \-]?(\p{L}+)\.?[ \-,]*(\d{4})$/u.exec(text);
  // Month first: "Feb 15 2026".
  const monthFirst = named ? null : /^(\p{L}+)\.? ?(\d{1,2}),? ?(\d{4})$/u.exec(text);
  const namedMonth = named ? monthNumber(named[2]) : 0;
  const firstMonth = monthFirst ? monthNumber(monthFirst[1]) : 0;
  const date = iso ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : local ? `${local[4]}-${local[3].padStart(2, "0")}-${local[1].padStart(2, "0")}`
      : named && namedMonth ? `${named[3]}-${String(namedMonth).padStart(2, "0")}-${named[1].padStart(2, "0")}`
        : monthFirst && firstMonth ? `${monthFirst[3]}-${String(firstMonth).padStart(2, "0")}-${monthFirst[2].padStart(2, "0")}` : "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

const englishMonths = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const arabicMonth = (value: string) => value.normalize("NFKD").replace(/\p{M}|ـ/gu, "").replace(/[أإآ]/g, "ا");
export function monthNumber(name: string) {
  const english = englishMonths.indexOf(name.slice(0, 3).toLowerCase()) + 1;
  if (english && /^[a-z]+$/i.test(name) && (name.length === 3 || name.toLowerCase() === "sept" || "january february march april may june july august september october november december".split(" ").includes(name.toLowerCase()))) return english;
  return monthNames.indexOf(arabicMonth(name)) + 1;
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
