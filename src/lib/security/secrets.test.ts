import { describe, expect, it } from "vitest";
import { verifyBearerSecret } from "./secrets";

describe("bearer secret verification", () => {
  const secret = "a-secure-cron-secret-123";

  it("accepts the exact configured bearer secret", () => {
    expect(verifyBearerSecret(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("rejects missing configuration and the literal undefined bypass", () => {
    expect(verifyBearerSecret("Bearer undefined", undefined)).toBe(false);
    expect(verifyBearerSecret(`Bearer ${secret}`, "")).toBe(false);
  });

  it("rejects malformed, short, and incorrect secrets", () => {
    expect(verifyBearerSecret(secret, secret)).toBe(false);
    expect(verifyBearerSecret("Bearer short", "short")).toBe(false);
    expect(verifyBearerSecret("Bearer incorrect-secret-value", secret)).toBe(false);
  });
});
