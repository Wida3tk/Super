import { describe, expect, it } from 'vitest';
import { escapeCsvCell, rowsToCsv } from './csv';

describe('CSV export', () => {
  it('escapes quotes and preserves commas', () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
  });

  it.each(['=SUM(A1:A2)', '+cmd', '-10+20', '@formula'])(
    'neutralizes spreadsheet formulas: %s',
    value => {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    },
  );

  it('writes a UTF-8 BOM and stable columns', () => {
    expect(rowsToCsv([{ name: 'Maryam', count: 2 }])).toBe(
      '\uFEFF"name","count"\r\n"Maryam","2"',
    );
  });
});
