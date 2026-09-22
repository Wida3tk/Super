export function isHistoricalImportDate(date: string, today: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
}
