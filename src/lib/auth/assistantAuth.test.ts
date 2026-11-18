import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as any, data: null as any, doc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./serverAuth", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: { collection: () => ({ doc: (id: string) => { state.doc(id); return { get: async () => ({ data: () => state.data }) }; } }) } }));
import { getAuthenticatedAssistant } from "./assistantAuth";
beforeEach(() => { vi.clearAllMocks(); state.user = { uid: "a", email: "a@test.org", role: "administrative_assistant" }; state.data = { name: "A", email: "a@test.org", role: "administrative_assistant", active: true, scope: "supervisors", supervisorIds: ["s"] }; });
it("uses the signed UID and validates the live permission record", async () => {
  expect((await getAuthenticatedAssistant())?.id).toBe("a"); expect(state.doc).toHaveBeenCalledWith("a");
});
it("does not spend a permission read on ordinary or anonymous accounts", async () => {
  state.user = null; expect(await getAuthenticatedAssistant()).toBeNull();
  state.user = { role: "trainee" }; expect(await getAuthenticatedAssistant()).toBeNull(); expect(state.doc).not.toHaveBeenCalled();
});
it("revokes immediately when the live record is disabled or removed", async () => {
  state.data.active = false; expect(await getAuthenticatedAssistant()).toBeNull();
  state.data = null; expect(await getAuthenticatedAssistant()).toBeNull();
});
it("rejects email changes, malformed scope and incorrect role records", async () => {
  state.data.email = "other@test.org"; expect(await getAuthenticatedAssistant()).toBeNull();
  state.data.email = "a@test.org"; state.data.supervisorIds = []; expect(await getAuthenticatedAssistant()).toBeNull();
  state.data.supervisorIds = ["s"]; state.data.role = "admin"; expect(await getAuthenticatedAssistant()).toBeNull();
});
