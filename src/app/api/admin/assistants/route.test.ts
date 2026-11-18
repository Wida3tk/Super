import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ admin: true, duplicates: false, accountExists: false, storedActive: true, authFailure: false,
  created: vi.fn(), claims: vi.fn(), update: vi.fn(), revoke: vi.fn(), writes: [] as any[] }));
vi.mock("@/lib/auth/serverAuth", () => ({ requireAdmin: async () => state.admin ? { uid: "root" } : null }));
vi.mock("@/lib/firebase/admin", () => {
  const ref = (path: string): any => ({ path, doc: (id = "audit") => ref(`${path}/${id}`), where: () => ref(path), limit: () => ref(path),
    update: async (data: any) => { state.storedActive = data.active; state.writes.push({ path, data }); },
    get: async () => path.startsWith("administrativeAssistants/") ? { exists: state.accountExists, data: () => ({ active: state.storedActive }) } : { empty: !state.duplicates, docs: [] },
  });
  return {
    adminAuth: { createUser: state.created, setCustomUserClaims: state.claims,
      updateUser: async (...args: any[]) => { state.update(...args); if (state.authFailure) throw new Error("offline"); }, revokeRefreshTokens: state.revoke },
    adminDb: { collection: ref, batch: () => ({
      create: (r: any, data: any) => state.writes.push({ path: r.path, data }),
      update: (r: any, data: any) => { state.storedActive = data.active; state.writes.push({ path: r.path, data }); }, commit: async () => {},
    }) },
  };
});
import { GET, POST, PATCH } from "./route";
const request = (data: any) => new Request("https://test/api/admin/assistants", { method: "POST", body: JSON.stringify(data) }) as never;
beforeEach(() => {
  vi.clearAllMocks(); process.env.ADMIN_EMAIL = "root@test.org"; state.admin = true; state.duplicates = false; state.accountExists = false; state.storedActive = true; state.authFailure = false; state.writes = [];
  state.created.mockResolvedValue({ uid: "new-assistant" });
});
it("only the primary administrator can list, create or alter staff access", async () => {
  state.admin = false;
  expect((await GET()).status).toBe(401); expect((await POST(request({}))).status).toBe(401); expect((await PATCH(request({}))).status).toBe(401);
  expect(state.created).not.toHaveBeenCalled(); expect(state.writes).toEqual([]);
});
it("creates only the assistant role and never supplies or returns a password", async () => {
  const response = await POST(request({ name: "Helper", email: "helper@test.org", scope: "all", supervisorIds: [], role: "admin" }));
  expect(response.status).toBe(200);
  expect(state.created).toHaveBeenCalledWith({ email: "helper@test.org", displayName: "Helper" });
  expect(state.claims).toHaveBeenCalledWith("new-assistant", { role: "administrative_assistant" });
  expect((await response.json()).password).toBeUndefined();
  expect(state.writes.some(w => w.path.startsWith("activityLog/") && w.data.actorId === "root")).toBe(true);
});
it("does not repurpose an existing trainee or provider account", async () => {
  state.duplicates = true;
  expect((await POST(request({ name: "Helper", email: "helper@test.org", scope: "all", supervisorIds: [] }))).status).toBe(409);
  expect(state.created).not.toHaveBeenCalled();
});
it("rejects an empty restricted scope and the administrator's email", async () => {
  expect((await POST(request({ name: "Helper", email: "helper@test.org", scope: "supervisors", supervisorIds: [] }))).status).toBe(400);
  expect((await POST(request({ name: "Helper", email: "root@test.org", scope: "all", supervisorIds: [] }))).status).toBe(400);
  expect(state.created).not.toHaveBeenCalled();
});
it("disables access before contacting Auth and leaves it disabled if Auth fails", async () => {
  state.accountExists = true; state.authFailure = true;
  const response = await PATCH(request({ id: "staff", active: true, scope: "all", supervisorIds: [] }));
  expect(response.status).toBe(503); expect(state.storedActive).toBe(false);
});
it("disabling an account revokes existing sessions", async () => {
  state.accountExists = true;
  expect((await PATCH(request({ id: "staff", active: false, scope: "all", supervisorIds: [] }))).status).toBe(200);
  expect(state.storedActive).toBe(false); expect(state.revoke).toHaveBeenCalledWith("staff");
});
