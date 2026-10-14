import { createHash } from "crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ role: "admin", supervisorId: "s1", currentSupervisorId: "s1", record: {} as any,
  ledger: [] as any[], locked: false, writes: [] as Array<{ kind: string; path: string; data: any }> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({
  requireAdmin: async () => state.role === "admin" ? { uid: "admin" } : null,
  getAuthenticatedSupervisor: async () => state.role === "supervisor" ? { id: state.supervisorId } : null,
}));
vi.mock("@/lib/supervision/activityLedger", () => ({ getTraineeActivityLedger: async () => state.ledger }));
vi.mock("@/lib/firebase/admin", () => {
  const snapshot = (path: string) => {
    if (path.startsWith("trainees/")) return { exists: true, data: () => ({ currentSupervisorId: state.currentSupervisorId }) };
    if (path.startsWith("supervisionReconciliations/")) return { exists: true, data: () => state.record };
    if (path.startsWith("monthlyApprovals/")) return { data: () => ({ locked: state.locked }) };
    return { docs: path === "supervisionReconciliations" ? [{ id: "a".repeat(64), data: () => state.record }] : [] };
  };
  const ref = (path: string): any => ({ path, doc: (id = "auto") => ref(`${path}/${id}`),
    where: () => ref(path), limit: () => ref(path), get: async () => snapshot(path) });
  const write = (kind: string, reference: any, data: any) => {
    state.writes.push({ kind, path: reference.path, data });
    if (kind === "update" && reference.path.startsWith("supervisionReconciliations/")) state.record = { ...state.record, ...data };
  };
  return { adminDb: { collection: ref, runTransaction: async (callback: any) => callback({
    get: async (reference: any) => snapshot(reference.path),
    update: (reference: any, data: any) => write("update", reference, data),
    create: (reference: any, data: any) => write("create", reference, data),
  }) } };
});
import { GET, PATCH } from "./route";
const reviewKey = createHash("sha256").update("[]").digest("hex");
const request = (decision = "add_separate", overrides = {}) => new NextRequest("https://test/api/supervision-reconciliation", {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "a".repeat(64), decision, note: "Verified separate meeting against the source", reviewKey, ...overrides }),
});
const hourWrites = () => state.writes.filter(w => w.path.startsWith("fieldworkActivities/") || w.path.startsWith("trainees/"));
beforeEach(() => {
  state.role = "admin"; state.supervisorId = "s1"; state.currentSupervisorId = "s1"; state.locked = false; state.ledger = []; state.writes = [];
  state.record = { traineeId: "t1", traineeName: "Student", assignedSupervisorId: "s1", status: "pending",
    candidate: { date: "2026-02-01", duration: 1.5, format: "individual", sourceRow: 23, sourceColumn: 12 },
    supervisorName: "Previous supervisor", sourceFileHash: "b".repeat(64), sourceSheet: "Student", createdBy: "admin", matches: [] };
});
it("requires authentication and does not allow trainees to review", async () => {
  state.role = "trainee";
  expect((await PATCH(request())).status).toBe(401); expect(state.writes).toEqual([]);
});
it("one administrative approval never writes hours", async () => {
  expect((await PATCH(request())).status).toBe(200);
  expect(state.record.status).toBe("pending"); expect(hourWrites()).toEqual([]);
});
it("adds hours exactly once after both roles agree, even with retries", async () => {
  await PATCH(request()); state.role = "supervisor";
  expect((await PATCH(request())).status).toBe(200);
  expect(state.record.status).toBe("resolved"); expect(hourWrites()).toHaveLength(2);
  expect(hourWrites()[0].data).toMatchObject({ duration: 1.5, status: "approved", activityType: "supervision_indirect" });
  await PATCH(request()); expect(hourWrites()).toHaveLength(2);
});
it("also supports supervisor-first approval", async () => {
  state.role = "supervisor"; await PATCH(request()); expect(hourWrites()).toEqual([]);
  state.role = "admin"; await PATCH(request()); expect(hourWrites()).toHaveLength(2);
});
it("keeps a disagreement pending and does not count hours", async () => {
  await PATCH(request("keep_existing")); state.role = "supervisor"; await PATCH(request());
  expect(state.record.outcome).toBe("disagreement"); expect(state.record.status).toBe("pending"); expect(hourWrites()).toEqual([]);
});
it("resolves duplicate exclusion without changing existing hours", async () => {
  await PATCH(request("keep_existing")); state.role = "supervisor"; await PATCH(request("keep_existing"));
  expect(state.record.status).toBe("resolved"); expect(hourWrites()).toEqual([]);
});
it("blocks other supervisors and the previous supervisor after reassignment", async () => {
  state.role = "supervisor"; state.currentSupervisorId = "s2";
  expect((await PATCH(request())).status).toBe(403); expect(state.writes).toEqual([]);
});
it("invalidates the previous supervisor's approval on reassignment", async () => {
  state.role = "supervisor"; await PATCH(request());
  state.currentSupervisorId = "s2"; state.role = "admin"; await PATCH(request());
  expect(state.record.supervisorApproval).toBeNull(); expect(hourWrites()).toEqual([]);
});
it("requires a reason and rejects stale evidence without writes", async () => {
  expect((await PATCH(request("add_separate", { note: "" }))).status).toBe(400);
  expect((await PATCH(request("add_separate", { reviewKey: "f".repeat(64) }))).status).toBe(409);
  expect(state.writes).toEqual([]);
});
it("invalidates prior consent if the ledger changed before the other approval", async () => {
  state.record.adminApproval = { actorId: "admin", decision: "add_separate", note: "checked", evidenceKey: "f".repeat(64) };
  state.role = "supervisor"; await PATCH(request());
  expect(state.record.adminApproval).toBeNull(); expect(hourWrites()).toEqual([]);
});
it("does not override locked months for an additional session", async () => {
  state.locked = true;
  expect((await PATCH(request())).status).toBe(409); expect(hourWrites()).toEqual([]);
});
it("allows duplicate exclusion in a locked month without changing hours", async () => {
  state.locked = true; await PATCH(request("keep_existing")); state.role = "supervisor"; await PATCH(request("keep_existing"));
  expect(state.record.status).toBe("resolved"); expect(hourWrites()).toEqual([]);
});
it("does not expose reassigned trainees to their former supervisor", async () => {
  state.role = "supervisor"; state.currentSupervisorId = "s2";
  const result = await GET(new NextRequest("https://test/api/supervision-reconciliation"));
  expect((await result.json()).records).toEqual([]);
});
