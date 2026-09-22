import { describe, expect, it } from "vitest";
import { normalizeIdentityEmail, normalizeIdentityPhone } from "./normalize";

describe("identity normalization", () => {
  it("normalizes email casing and mailto prefixes", () => {
    expect(normalizeIdentityEmail(" MAILTO:User@Example.COM ")).toBe("user@example.com");
  });

  it("treats Saudi local and international mobile formats as the same number", () => {
    expect(normalizeIdentityPhone("055 123 4567")).toBe("+966551234567");
    expect(normalizeIdentityPhone("00966 55 123 4567")).toBe("+966551234567");
    expect(normalizeIdentityPhone("966551234567")).toBe("+966551234567");
  });

  it("normalizes Arabic digits and rejects invalid numbers", () => {
    expect(normalizeIdentityPhone("٠٥٥١٢٣٤٥٦٧")).toBe("+966551234567");
    expect(normalizeIdentityPhone("123")).toBe("");
  });
});
