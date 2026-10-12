export function validatePriorCredit(input: Record<string, unknown>, today: string) {
  const start = String(input.startDate || "");
  const end = String(input.endDate || "");
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(start) || !validDate(end) || start > end || end >= `${today.slice(0, 7)}-01` || start.slice(0, 7) !== end.slice(0, 7)) return false;
  if (!["new", "existing"].includes(String(input.mode))) return false;
  if (!String(input.supervisorName || "").trim() || String(input.supervisorName).length > 200 || !String(input.evidenceId || "").trim()) return false;
  const individual = input.individualHours;
  const group = input.groupHours;
  return typeof individual === "number" && typeof group === "number" && [individual, group].every(n => Number.isFinite(n) && n >= 0 && n <= 744 && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001) && individual + group > 0 && individual + group <= 744;
}
