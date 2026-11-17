import { monthNumber, workbookDate } from "./workbookDates";

/**
 * Suggestions for session dates the supervisor workbook import could not
 * accept. Nothing here is applied on its own: the admin sees each suggestion
 * in the review step, can change it, and confirms with a new preview.
 *
 * The month group a session sits in is the anchor. A suggestion is offered
 * only when the typed text agrees with that month (or gives just a day), so
 * a session typed in the wrong group is left for the admin to decide.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const realDate = (year: number, month: number, day: number) => {
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : "";
};
const digits = (value: string) => value.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 15));

export function suggestSessionDate(raw: string, expectedMonth: string, today: string): string {
  if (!/^\d{4}-\d{2}$/.test(expectedMonth) || expectedMonth > today.slice(0, 7)) return "";
  const [year, month] = expectedMonth.split("-").map(Number);
  const text = digits(String(raw || "")).trim().replace(/\s+/g, " ");
  if (!text) return "";
  const accept = (day: number) => {
    const date = realDate(year, month, day);
    return date && date <= today ? date : "";
  };

  // A readable date in the right month but the wrong year: a typo in the year (2926, 2025).
  const parsed = workbookDate(text);
  if (parsed) return Number(parsed.slice(5, 7)) === month ? accept(Number(parsed.slice(8, 10))) : "";

  // Only a day: "22", "3".
  if (/^\d{1,2}$/.test(text)) return accept(Number(text));

  // Day and month without a year, as numbers: "23-9", "23/9".
  const dayMonth = /^(\d{1,2}) ?[/.\-\\] ?(\d{1,2})$/.exec(text);
  if (dayMonth) return Number(dayMonth[2]) === month ? accept(Number(dayMonth[1])) : "";

  // A day with a month name, with or without a (possibly mistyped) year: "3 Jan", "25dec", "4Oug2026".
  const words = text.match(/\p{L}+/gu) || [];
  const numbers = (text.match(/\d+/g) || []).map(Number);
  const days = numbers.filter((n) => n >= 1 && n <= 31);
  const years = numbers.filter((n) => n >= 1000);
  if (days.length !== 1 || words.length > 1 || numbers.length > 2) return "";
  if (years.length && years[0] !== year) return "";
  if (words.length) {
    const named = monthNumber(words[0] || "");
    // An unreadable month name is accepted only when the year confirms the group.
    if (named ? named !== month : !years.length) return "";
  }
  return accept(days[0]);
}

/** When the group's month is in the future but a session date in it is real, the group title is off by a year. */
export function suggestGroupMonth(parsedDate: string, expectedMonth: string, today: string): string {
  if (!parsedDate || !/^\d{4}-\d{2}$/.test(expectedMonth) || expectedMonth <= today.slice(0, 7)) return "";
  return parsedDate.slice(5, 7) === expectedMonth.slice(5, 7) && parsedDate <= today ? parsedDate.slice(0, 7) : "";
}
