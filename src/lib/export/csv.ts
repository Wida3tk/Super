export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvCell>;

export function escapeCsvCell(value: CsvCell): string {
  const raw = value == null ? '' : String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return '\uFEFF';

  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => headers.map(header => escapeCsvCell(row[header])).join(',')),
  ];

  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename: string, rows: CsvRow[]): void {
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
