import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ trainee: { id: "t", name: "متدرب" } as any, row: null as any, locked: false, updates: [] as any[], added: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({
  getAuthenticatedTrainee: async () => mock.trainee,
  hasActiveTraineeService: () => true,
}));
vi.mock("@/lib/firebase/admin", () => {
  const ref = (name: string, id = ""): any => ({ name, id, doc: (d: string) => ref(name, d), add: async (data: any) => mock.added.push({ name, data }) });
  return { adminDb: { collection: ref, runTransaction: async (cb: any) => cb({
    get: async (r: any) => r.name === "fieldworkActivities"
      ? { exists: Boolean(mock.row), id: r.id, data: () => mock.row }
      : { data: () => ({ locked: mock.locked }) },
    update: (_r: any, data: any) => mock.updates.push(data),
  }) } };
});
import { POST } from "./route";
const request = (body: any) => new Request("https://test/api/trainee/session-acknowledgment", { method: "POST", body: JSON.stringify(body) }) as never;
beforeEach(() => {
  mock.trainee = { id: "t", name: "متدرب" }; mock.locked = false; mock.updates = []; mock.added = [];
  mock.row = { traineeId: "t", supervisorId: "s", sessionId: "x", activityType: "supervision_indirect", status: "approved", month: "2026-11", date: "2026-11-01", duration: 1, format: "individual" };
});
it("confirms a supervisor-logged session without notifying anyone", async () => {
  const response = await POST(request({ activityId: "session_x_t", action: "confirm" }));
  expect(response.status).toBe(200);
  expect(mock.updates[0].traineeAcknowledgment).toMatchObject({ status: "confirmed", via: "session" });
  expect(mock.added.map((a) => a.name)).toEqual(["activityLog"]);
});
it("requires a note to dispute and notifies the supervisor and the administration", async () => {
  expect((await POST(request({ activityId: "session_x_t", action: "dispute", note: "" }))).status).toBe(400);
  const response = await POST(request({ activityId: "session_x_t", action: "dispute", note: "الجلسة كانت نصف ساعة" }));
  expect(response.status).toBe(200);
  expect(mock.updates[0].traineeAcknowledgment).toMatchObject({ status: "disputed", note: "الجلسة كانت نصف ساعة" });
  const targets = mock.added.filter((a) => a.name === "notifications").map((a) => a.data.targetType);
  expect(targets).toEqual(["supervisor", "admin"]);
});
it("refuses another trainee's session, trainee-logged rows and locked months", async () => {
  mock.row.traineeId = "other";
  expect((await POST(request({ activityId: "a", action: "confirm" }))).status).toBe(404);
  mock.row.traineeId = "t"; delete mock.row.sessionId;
  expect((await POST(request({ activityId: "a", action: "confirm" }))).status).toBe(409);
  mock.row.sessionId = "x"; mock.locked = true;
  expect((await POST(request({ activityId: "a", action: "confirm" }))).status).toBe(409);
  expect(mock.updates).toEqual([]);
});
it("rejects bad input", async () => {
  expect((await POST(request({ activityId: "a/b", action: "confirm" }))).status).toBe(400);
  expect((await POST(request({ activityId: "a", action: "delete" }))).status).toBe(400);
});
