import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ update: vi.fn(), reads: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: {
  collection: (name: string) => ({ doc: () => ({ name }), where: () => ({ name }) }),
  runTransaction: async (callback: any) => callback({
    get: async (ref: any) => {
      mocks.reads.push(ref.name);
      if (ref.name === "trainees") return { exists: true };
      return { docs: ref.name === "sessions" ? [{ id: "s1", data: () => ({
        type: "individual", duration: 1.5, date: "2026-10-01", month: "2026-10", supervisorId: "s",
      }) }] : [] };
    }, update: mocks.update,
  }),
} }));
import { syncTraineeFieldworkTotals } from "./syncTotals";
it("reads and updates totals in one transaction without touching historical balances", async () => {
  const totals = await syncTraineeFieldworkTotals("t");
  expect(mocks.reads).toEqual(["trainees", "fieldworkActivities", "sessions"]);
  expect(totals.approvedSupervisionHours).toBe(1.5);
  expect(totals.approvedIndividualSupervisionHours).toBe(1.5);
  expect(totals.totalHours).toBe(1.5);
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(totals).not.toHaveProperty("totalIndividualHours");
  expect(totals).not.toHaveProperty("status");
});
it("reconciles supervisor import counters atomically when explicitly requested", async () => {
  const totals = await syncTraineeFieldworkTotals("t", { reconcileSupervisionCounters: true });
  expect(totals.totalIndividualHours).toBe(1.5);
  expect(totals.totalGroupHours).toBe(0);
  expect(mocks.update).toHaveBeenLastCalledWith({ name: "trainees" }, totals);
});
