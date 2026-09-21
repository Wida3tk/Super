import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: {} }));

import { evaluateRateLimit } from "./rateLimit";

const policy = { action: "test", limit: 3, windowMs: 60_000 };

describe("rate-limit evaluation", () => {
  it("allows requests through the configured limit", () => {
    expect(evaluateRateLimit({}, policy, 1_000)).toMatchObject({
      allowed: true,
      count: 1,
      windowStartedAt: 1_000,
    });
    expect(
      evaluateRateLimit({ count: 2, windowStartedAt: 1_000 }, policy, 2_000),
    ).toMatchObject({ allowed: true, count: 3 });
  });

  it("blocks requests above the configured limit", () => {
    expect(
      evaluateRateLimit({ count: 3, windowStartedAt: 1_000 }, policy, 2_000),
    ).toMatchObject({
      allowed: false,
      count: 4,
      retryAfterSeconds: 59,
    });
  });

  it("starts a fresh counter after the window expires", () => {
    expect(
      evaluateRateLimit({ count: 99, windowStartedAt: 1_000 }, policy, 61_000),
    ).toMatchObject({
      allowed: true,
      count: 1,
      windowStartedAt: 61_000,
    });
  });
});
