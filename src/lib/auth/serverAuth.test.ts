import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  verifySessionCookie: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifySessionCookie: mocks.verifySessionCookie },
  adminDb: {},
}));

import { requireAdmin } from "./serverAuth";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAIL = "admin@example.com";
  });

  it("rejects requests without a session cookie", async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined });
    expect(await requireAdmin()).toBeNull();
    expect(mocks.verifySessionCookie).not.toHaveBeenCalled();
  });

  it("rejects revoked or invalid sessions", async () => {
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session" }) });
    mocks.verifySessionCookie.mockRejectedValue(new Error("revoked"));
    expect(await requireAdmin()).toBeNull();
    expect(mocks.verifySessionCookie).toHaveBeenCalledWith("session", true);
  });

  it("rejects an authenticated non-admin account", async () => {
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session" }) });
    mocks.verifySessionCookie.mockResolvedValue({
      uid: "user-1",
      email: "user@example.com",
    });
    expect(await requireAdmin()).toBeNull();
  });

  it("accepts the configured admin email case-insensitively", async () => {
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session" }) });
    const admin = { uid: "admin-1", email: " ADMIN@example.com " };
    mocks.verifySessionCookie.mockResolvedValue(admin);
    expect(await requireAdmin()).toEqual(admin);
  });
});
