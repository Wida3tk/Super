export function normalizeIdentityEmail(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/^mailto:/, "");
}

export function normalizeIdentityPhone(value: unknown) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const normalized = String(value || "")
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");
  const canonical = /^05\d{8}$/.test(normalized)
    ? `+966${normalized.slice(1)}`
    : /^9665\d{8}$/.test(normalized)
      ? `+${normalized}`
      : normalized;
  return /^\+?\d{8,15}$/.test(canonical) ? canonical : "";
}
