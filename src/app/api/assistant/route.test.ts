import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ user: null as any, live: {} as any, trainee: {} as any, writes: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/assistantAuth", () => ({ getAuthenticatedAssistant: async () => state.user }));
vi.mock("@/lib/firebase/admin", () => {
  const ref = (path: string): any => ({ path, doc: (id = "auto") => ref(`${path}/${id}`), where: () => ref(path), limit: () => ref(path),
    get: async () => path.startsWith("administrativeAssistants/") ? { exists: true, data: () => state.live }
      : path.startsWith("trainees/") ? { id: "t", ref: ref(path), exists: true, data: () => state.trainee }
      : { exists: false, data: () => undefined, docs: [], empty: true } });
  return { adminDb: { collection: ref, runTransaction: async (callback: any) => callback({ get: (reference: any) => reference.get(),
    set: (r: any, data: any) => state.writes.push({ path: r.path, data }), update: (r: any, data: any) => state.writes.push({ path: r.path, data }),
    create: (r: any, data: any) => state.writes.push({ path: r.path, data }), delete: (r: any) => state.writes.push({ path: r.path, deleted: true }),
  }) }, adminAuth: {} };
});
import { GET, POST } from "./route";
const request = (body: any) => new NextRequest("https://test/api/assistant", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  state.user = { id: "a", name: "Helper", email: "a@test.org", active: true, scope: "supervisors", supervisorIds: ["s"] };
  state.live = { ...state.user, role: "administrative_assistant" }; state.trainee = { currentSupervisorId: "s", phone: "" }; state.writes = [];
});
it("rejects unauthenticated requests", async () => { state.user = null; expect((await POST(request({}))).status).toBe(401); expect((await GET(new NextRequest("https://test/api/assistant"))).status).toBe(401); });
it("does not accept financial, hours, password, status or role mutation actions", async () => {
  for (const action of ["approve", "delete", "password", "role", "export", "assign", "syncTotals", "status", "__proto__", "constructor", "toString"]) expect((await POST(request({ action, traineeId: "t" }))).status).toBe(403);
  expect(state.writes).toEqual([]);
});
it("rejects mass-assignment fields on an otherwise allowed phone edit", async () => {
  expect((await POST(request({ action: "phone", traineeId: "t", phone: "0501234567", totalHours: 999 }))).status).toBe(403); expect(state.writes).toEqual([]);
});
it("does not expose or update an out-of-scope trainee", async () => {
  state.trainee.currentSupervisorId = "other";
  expect((await GET(new NextRequest("https://test/api/assistant?traineeId=t"))).status).toBe(403);
  expect((await POST(request({ action: "phone", traineeId: "t", phone: "0501234567" }))).status).toBe(403); expect(state.writes).toEqual([]);
});
it("checks live revocation and scope changes inside the write transaction", async () => {
  state.live.active = false;
  expect((await POST(request({ action: "phone", traineeId: "t", phone: "0501234567" }))).status).toBe(403);
  state.live.active = true; state.live.supervisorIds = ["other"];
  expect((await POST(request({ action: "phone", traineeId: "t", phone: "0501234567" }))).status).toBe(403); expect(state.writes).toEqual([]);
});
it("updates only phone data and logs the assistant, without touching any hours", async () => {
  expect((await POST(request({ action: "phone", traineeId: "t", phone: "0501234567" }))).status).toBe(200);
  const updates = state.writes.filter(w => w.path.startsWith("trainees/"));
  expect(updates).toHaveLength(1); expect(Object.keys(updates[0].data).sort()).toEqual(["phone", "updatedAt"]);
  expect(state.writes.some(w => w.path.startsWith("activityLog/") && w.data.actorId === "a")).toBe(true);
});
it("creates a pending request instead of changing the supervisor", async () => {
  expect((await POST(request({ action: "request", traineeId: "t", requestType: "assign_supervisor", proposal: "s", note: "Review assignment" }))).status).toBe(200);
  expect(state.writes.some(w => w.path.startsWith("assistantRequests/") && w.data.status === "pending")).toBe(true);
  expect(state.writes.some(w => w.path.startsWith("trainees/"))).toBe(false);
});
