import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ activities: [] as any[], sessions: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: {
  collection: (name: string) => ({ where: () => ({ get: async () => ({
    docs: (name === "sessions" ? mocks.sessions : mocks.activities).map((row) => ({ id: row.id, data: () => row })),
  }) }) }),
} }));
import { getTraineeActivityLedger } from "./activityLedger";
describe("read-only supervisor activity ledger", () => {
  beforeEach(() => {
    mocks.activities = [];
    mocks.sessions = [{ id: "s1", supervisorId: "supervisor", type: "individual", date: "2026-10-12", month: "2026-10", duration: 1 }];
  });
  it("includes a historical session without writing a new document", async () => {
    expect(await getTraineeActivityLedger("t1")).toEqual([expect.objectContaining({ duration: 1, status: "approved", format: "individual" })]);
  });
  it("counts a session only once when a linked activity already exists", async () => {
    mocks.activities = [{ id: "a1", sessionId: "s1", duration: 1, status: "approved" }];
    expect(await getTraineeActivityLedger("t1")).toHaveLength(1);
  });
  it("does not count a deleted historical session", async () => {
    mocks.sessions[0].deleted = true;
    expect(await getTraineeActivityLedger("t1")).toHaveLength(0);
  });
  it("preserves imported rows and flags ambiguous historical matches for review", async () => {
    mocks.activities = [{ id: "old", supervisorId: "supervisor", activityType: "supervision_indirect", format: "individual", date: "2026-10-12", duration: 1, status: "approved" }];
    const rows = await getTraineeActivityLedger("t1");
    expect(rows[0]).toMatchObject({ id: "old", duration: 1, status: "approved" });
    expect(rows[1].status).toBe("revision_requested");
    expect(rows.filter((row) => row.status === "approved").reduce((sum, row) => sum + row.duration, 0)).toBe(1);
  });
});
