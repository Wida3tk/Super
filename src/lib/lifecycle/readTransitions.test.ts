import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ queries: [] as any[][], monthly: [] as any[], history: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: { collection: () => {
 const filters: any[] = []; const query: any = { where: (...args: any[]) => { filters.push(args); return query; }, get: async () => { mocks.queries.push(filters); return { docs: (filters.some(f => f[0] === "traineeId") ? mocks.history : mocks.monthly).map(r => ({ id: r.id, data: () => r })) }; } }; return query;
} } }));
import { monthBounds, readDirectoryTransitions, readMonthTransitions } from "./readTransitions";
beforeEach(() => { mocks.queries = []; mocks.monthly = []; mocks.history = []; });
it("does no history reads for ordinary accounts", async () => { await readDirectoryTransitions([{ id: "t", lifecycleStage: "active_service" }], "2026-10"); expect(mocks.queries).toEqual([]); });
it("reads only the selected month when the report is requested", async () => { await readMonthTransitions("2026-10"); expect(mocks.queries).toEqual([[["changedAt", ">=", "2026-10-01T00:00:00.000Z"], ["changedAt", "<", "2026-11-01T00:00:00.000Z"]]]); });
it("retains exceptional history without reading unrelated trainee histories", async () => { mocks.history = [{ id: "a", traineeId: "t" }, { id: "b", traineeId: "t", fromStage: "contracting", toStage: "approved_pause" }]; const rows = await readDirectoryTransitions([{ id: "t", lifecycleStage: "approved_pause" }], "2026-10"); expect(rows).toHaveLength(2); expect(mocks.queries[0]).toEqual([["traineeId", "in", ["t"]]]); });
it("validates month boundaries and rolls over December correctly", () => { expect(monthBounds("2026-12").end).toBe("2027-01-01T00:00:00.000Z"); expect(() => monthBounds("2026-13")).toThrow("INVALID_MONTH"); });
