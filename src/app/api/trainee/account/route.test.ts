import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trainee: vi.fn(), session: vi.fn(), updateUser: vi.fn(), revokeRefreshTokens: vi.fn(),
}));
vi.mock("@/lib/auth/serverAuth", () => ({
  getAuthenticatedTrainee: mocks.trainee, getSessionUser: mocks.session,
}));
vi.mock("@/lib/firebase/admin", () => ({ adminAuth: {
  updateUser: mocks.updateUser, revokeRefreshTokens: mocks.revokeRefreshTokens,
} }));
import { PATCH } from "./route";

const request = (body: object) => new Request("http://localhost/api/trainee/account", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}) as never;

describe("trainee password-only account updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.trainee.mockResolvedValue({ id: "trainee-1", email: "existing@example.com" });
    mocks.session.mockResolvedValue({ uid: "user-1", auth_time: Math.floor(Date.now() / 1000) });
  });
  it.each([{ email: "changed@example.com" }, { phone: "+966555555555" }])(
    "rejects contact updates without changing authentication", async (contact) => {
      const response = await PATCH(request({ ...contact, password: "test-password" }));
      expect(response.status).toBe(403);
      expect(mocks.updateUser).not.toHaveBeenCalled();
      expect(mocks.revokeRefreshTokens).not.toHaveBeenCalled();
    },
  );
  it("changes only the password and expires the session", async () => {
    const response = await PATCH(request({ password: "test-password" }));
    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith("user-1", { password: "test-password" });
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledWith("user-1");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
