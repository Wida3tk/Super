// Excel hyperlinks can wrap rich text; formulas can wrap cached values.
// Unwrap display values only: never follow links or evaluate formulas.
export function scalarCellValue(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== "object" || value instanceof Date || depth >= 10) return value;
  if ("result" in value) return scalarCellValue(value.result, depth + 1);
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map(part => String(part?.text ?? "")).join("");
  }
  if ("text" in value) return scalarCellValue(value.text, depth + 1);
  return value;
}
