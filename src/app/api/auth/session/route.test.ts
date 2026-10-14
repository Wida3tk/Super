import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ limit: vi.fn(), verify: vi.fn(), cookie: vi.fn(), reads: [] as string[], exists: {} as Record<string, boolean> }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: mocks.limit, getRequestIdentifier: () => "test-ip" }));
vi.mock("@/lib/firebase/admin", () => ({ adminAuth: { verifyIdToken: mocks.verify, createSessionCookie: mocks.cookie }, adminDb: { collection: (name: string) => {
  const q: any = { where: () => q, limit: () => q, doc: () => q, get: async () => { mocks.reads.push(name); return { empty: !mocks.exists[name], exists: !!mocks.exists[name] }; } }; return q;
} } }));
import { POST } from "./route";
const request = (data: any = { token: "token" }) => new NextRequest("https://example.test/api/auth/session", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => { vi.clearAllMocks(); mocks.reads = []; mocks.exists = {}; process.env.ADMIN_EMAIL = "admin@example.com"; mocks.limit.mockResolvedValue({ allowed: true }); mocks.verify.mockResolvedValue({ uid: "u", email: "user@example.com" }); mocks.cookie.mockResolvedValue("secure-session"); });
it("rejects missing credentials without spending a Firestore rate-limit read", async () => { expect((await POST(request({}))).status).toBe(400); expect(mocks.limit).not.toHaveBeenCalled(); });
it("preserves rate limiting and never creates a session when blocked", async () => { mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 }); const res = await POST(request()); expect(res.status).toBe(429); expect(mocks.verify).not.toHaveBeenCalled(); expect(res.headers.get("set-cookie")).toBeNull(); });
it("fails closed on exhausted database quota", async () => { mocks.limit.mockRejectedValue(Object.assign(new Error("quota"), { code: 8 })); const res = await POST(request()); expect(res.status).toBe(503); expect((await res.json()).error).toBe("SERVICE_BUSY"); expect(mocks.cookie).not.toHaveBeenCalled(); expect(res.headers.get("set-cookie")).toBeNull(); });
it("does no role queries for configured administrators and keeps secure cookie flags", async () => { mocks.verify.mockResolvedValue({ uid: "admin", email: "ADMIN@example.com" }); const res = await POST(request({ token: "token", portal: "admin" })); expect((await res.json()).role).toBe("admin"); expect(mocks.reads).toEqual([]); expect(res.headers.get("set-cookie")).toContain("HttpOnly"); expect(res.headers.get("set-cookie")).toContain("SameSite=lax"); });
it("stops after identifying a supervisor, preserving priority over trainee records", async () => { mocks.exists = { supervisors: true, trainees: true }; const res = await POST(request()); expect((await res.json()).role).toBe("supervisor"); expect(mocks.reads).toEqual(["supervisors"]); });
it("skips client reads when the account is a trainee", async () => { mocks.exists = { trainees: true }; const res = await POST(request()); expect((await res.json()).role).toBe("trainee"); expect(mocks.reads).toEqual(["supervisors", "trainees"]); });
it("does not allow non-admin accounts into the administrator portal", async () => { mocks.exists = { supervisors: true }; const res = await POST(request({ token: "token", portal: "admin" })); expect(res.status).toBe(403); expect(res.headers.get("set-cookie")).toBeNull(); });
