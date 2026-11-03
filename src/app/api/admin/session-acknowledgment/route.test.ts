import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ admin: { email: "admin@x.test" } as any, rows: {} as Record<string, any>, locked: false, updates: [] as any[], added: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({ requireAdmin: async () => mock.admin }));
vi.mock("@/lib/firebase/admin", () => {
  const ref = (name: string, id = ""): any => ({ name, id, doc: (d: string) => ref(name, d), add: async (data: any) => mock.added.push({ name, data }) });
  return { adminDb: { collection: ref, runTransaction: async (cb: any) => cb({
    get: async (r: any) => r.name === "fieldworkActivities"
      ? { exists: Boolean(mock.rows[r.id]), id: r.id, data: () => mock.rows[r.id] }
      : { data: () => ({ locked: mock.locked }) },
    update: (r: any, data: any) => mock.updates.push({ id: r.id, ...data }),
  }) } };
});
import { POST } from "./route";
const request = (body: any) => new Request("https://test/api/admin/session-acknowledgment", { method: "POST", body: JSON.stringify(body) }) as never;
const session = (over: any = {}) => ({ traineeId: "t", supervisorId: "s", sessionId: "x", activityType: "supervision_indirect", status: "approved", month: "2026-11", date: "2026-11-01", duration: 1, format: "individual", ...over });
beforeEach(() => {
  mock.admin = { email: "admin@x.test" }; mock.locked = false; mock.updates = []; mock.added = [];
  mock.rows = { a: session(), b: session({ traineeAcknowledgment: { status: "disputed", at: "2026-11-02", note: "كانت نصف ساعة" } }), c: session({ sessionId: undefined }) };
});
it("is for the administration only", async () => {
  mock.admin = null;
  expect((await POST(request({ activityIds: ["a"] }))).status).toBe(401);
});
it("confirms pending sessions quietly and keeps a resolved dispute on record", async () => {
  const response = await POST(request({ activityIds: ["a", "b", "c", "missing"] }));
  const data = await response.json();
  expect(data.confirmed).toEqual(["a", "b"]);
  expect(data.skipped.map((s: any) => s.reason)).toEqual(["NOT_ACKNOWLEDGEABLE", "NOT_FOUND"]);
  expect(mock.updates[0].traineeAcknowledgment).toMatchObject({ status: "confirmed", via: "admin", by: "admin@x.test", resolvedDispute: null });
  expect(mock.updates[1].traineeAcknowledgment.resolvedDispute).toMatchObject({ note: "كانت نصف ساعة" });
  const notes = mock.added.filter((a) => a.name === "notifications").map((a) => a.data.targetType);
  expect(notes).toEqual(["supervisor", "trainee"]);
});
it("leaves locked months alone and rejects bad input", async () => {
  mock.locked = true;
  expect((await (await POST(request({ activityIds: ["a"] }))).json()).skipped[0].reason).toBe("MONTH_LOCKED");
  expect((await POST(request({ activityIds: [] }))).status).toBe(400);
  expect((await POST(request({ activityIds: ["a/b"] }))).status).toBe(400);
});
