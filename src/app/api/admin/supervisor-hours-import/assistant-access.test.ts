import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as any, read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({ requireAdmin: async () => null }));
vi.mock("@/lib/auth/assistantAuth", () => ({ getAuthenticatedAssistant: async () => state.user }));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: { collection: state.read }, adminAuth: {} }));
import { POST } from "./route";
const request = (commit: boolean, id = "s") => {
  const form = new FormData(); form.set("file", new File(["not an actual workbook"], "test.xlsx")); form.set("commit", String(commit)); form.set("supervisorId", id);
  return new Request("https://test/api/admin/supervisor-hours-import", { method: "POST", body: form }) as never;
};
beforeEach(() => { vi.clearAllMocks(); state.user = { id: "a", active: true, scope: "supervisors", supervisorIds: ["s"] }; });
it("blocks assistant commits before parsing the file or reading trainee data", async () => {
  expect((await POST(request(true))).status).toBe(403); expect(state.read).not.toHaveBeenCalled();
});
it("blocks previewing another supervisor's workbook", async () => {
  expect((await POST(request(false, "outside"))).status).toBe(403); expect(state.read).not.toHaveBeenCalled();
});
it("requires authentication for previews", async () => {
  state.user = null; expect((await POST(request(false))).status).toBe(401); expect(state.read).not.toHaveBeenCalled();
});
