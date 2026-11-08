import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ get: vi.fn(), getAll: vi.fn(), create: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: { collection: () => ({ where: () => ({}) }), runTransaction: (fn: any) => fn(mock) } }));
import { priorSafeImportBatch } from "./priorSafeBatch";
it("does not move an existing session out of a locked month during date correction", async () => {
  mock.get.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] })
    .mockResolvedValueOnce({ docs: [{ data: () => ({ month: "2020-02", locked: true }) }] }).mockResolvedValueOnce({ docs: [] });
  mock.getAll.mockResolvedValueOnce([{ data: () => ({ date: "2020-02-10", activityType: "supervision_indirect" }) }]);
  const batch = priorSafeImportBatch("trainee", { protectLockedMonths: true });
  batch.set({} as any, { date: "2020-03-10", activityType: "supervision_indirect" }, { merge: true });
  await expect(batch.commit()).rejects.toThrow("IMPORT_MONTH_LOCKED");
  expect(mock.set).not.toHaveBeenCalled();
});
beforeEach(() => { vi.clearAllMocks(); mock.get.mockResolvedValue({ docs: [{ data: () => ({ status: "approved", month: "2020-02" }) }] }); });
it("blocks both added supervision and deletion of protected historical rows", async () => {
  const batch = priorSafeImportBatch("trainee");
  batch.create({} as any, { activityType: "supervision_indirect", date: "2020-02-10" });
  await expect(batch.commit()).rejects.toThrow("PRIOR_SUPERVISION_RECONCILIATION_REQUIRED");
  const cleanup = priorSafeImportBatch("trainee");
  cleanup.delete({} as any, { activityType: "supervision_direct", date: "2020-02-10" });
  await expect(cleanup.commit()).rejects.toThrow("PRIOR_SUPERVISION_RECONCILIATION_REQUIRED");
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.delete).not.toHaveBeenCalled();
});
it("preserves unrelated fieldwork imports", async () => {
  const batch = priorSafeImportBatch("trainee");
  batch.create({} as any, { activityType: "direct", date: "2020-02-10" });
  await batch.commit(); expect(mock.create).toHaveBeenCalledTimes(1);
});
it("does not count draft credits as approved balances", async () => {
  mock.get.mockResolvedValue({ docs: [{ data: () => ({ status: "draft", month: "2020-02" }) }] });
  const batch = priorSafeImportBatch("trainee");
  batch.create({} as any, { activityType: "supervision_indirect", date: "2020-02-10" });
  await batch.commit(); expect(mock.create).toHaveBeenCalledTimes(1);
});
it("blocks a second supervision import from bypassing pending dual approvals", async () => {
  mock.get.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [{ data: () => ({ status: "pending", candidate: { date: "2020-02-05" } }) }] });
  const batch = priorSafeImportBatch("trainee");
  batch.create({} as any, { activityType: "supervision_indirect", date: "2020-02-10" });
  await expect(batch.commit()).rejects.toThrow("PRIOR_SUPERVISION_RECONCILIATION_REQUIRED");
  expect(mock.create).not.toHaveBeenCalled();
});
