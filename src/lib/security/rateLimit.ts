import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export type RateLimitPolicy = {
  action: string;
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count?: number;
  windowStartedAt?: number;
};

export function evaluateRateLimit(
  state: RateLimitState,
  policy: RateLimitPolicy,
  now = Date.now(),
) {
  const windowStartedAt = Number(state.windowStartedAt || 0);
  const expired = !windowStartedAt || now - windowStartedAt >= policy.windowMs;
  const count = expired ? 1 : Number(state.count || 0) + 1;
  const nextWindowStartedAt = expired ? now : windowStartedAt;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((nextWindowStartedAt + policy.windowMs - now) / 1000),
  );

  return {
    allowed: count <= policy.limit,
    count,
    windowStartedAt: nextWindowStartedAt,
    retryAfterSeconds,
  };
}

function hashIdentifier(action: string, identifier: string) {
  const salt =
    process.env.RATE_LIMIT_SALT ||
    process.env.FIREBASE_PROJECT_ID ||
    "sulukera-rate-limit";
  return createHash("sha256")
    .update(`${salt}:${action}:${identifier}`)
    .digest("hex");
}

export function getRequestIdentifier(request: NextRequest | Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("x-vercel-forwarded-for")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwarded ||
    "unknown"
  );
}

export async function enforceRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
) {
  const ref = adminDb
    .collection("rateLimits")
    .doc(hashIdentifier(policy.action, identifier));

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = Date.now();
    const result = evaluateRateLimit(
      snapshot.exists ? (snapshot.data() as RateLimitState) : {},
      policy,
      now,
    );
    transaction.set(
      ref,
      {
        action: policy.action,
        count: result.count,
        windowStartedAt: result.windowStartedAt,
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true },
    );
    return result;
  });
}
