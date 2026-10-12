import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), increment: vi.fn(n => ({ increment: n })) }));
vi.mock("@/lib/auth/serverAuth", () => ({ requireAdmin: mocks.auth }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { increment: mocks.increment } }));
vi.mock("@/lib/firebase/admin", () => {
  const collection = (name: string): any => ({ doc: (id = "generated") => ({ path: `${name}/${id}`, id }), where: () => collection(name) });
  return { adminDb: { collection, runTransaction: (fn: any) => fn({ get: mocks.get, create: mocks.create, update: mocks.update }) } };
});
import { POST } from "./route";
const credit = { traineeId: "trainee", supervisorName: "Previous", startDate: "2020-02-01", endDate: "2020-02-28", month: "2020-02", individualHours: 4, groupHours: 2, evidenceId: "evidence", mode: "new", status: "draft" };
const snap = (data: any) => ({ exists: !!data, data: () => data });
const request = () => new NextRequest("https://example.test/api/admin/prior-supervision", { method: "POST", body: JSON.stringify({ traineeId: "trainee", action: "approve", creditId: "credit" }) });
function reads(overrides: any = {}) {
  mocks.get.mockResolvedValueOnce(snap({ ...credit, ...overrides.credit }))
    .mockResolvedValueOnce(snap({ name: "Trainee" }))
    .mockResolvedValueOnce(snap({ traineeId: "trainee", driveFileId: "proof" }))
    .mockResolvedValueOnce({ docs: overrides.rows || [] })
    .mockResolvedValueOnce({ docs: overrides.sessions || [] })
    .mockResolvedValueOnce(snap(overrides.lock ? { locked: true } : null))
    .mockResolvedValueOnce({ docs: [] });
}
describe("administrative prior credit approval", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.get.mockReset(); mocks.auth.mockResolvedValue({ uid: "admin" }); });
  it("denies unauthorized access without reading or writing data", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("makes repeated approvals idempotent", async () => {
    mocks.get.mockResolvedValueOnce(snap({ ...credit, status: "approved" }));
    expect((await POST(request())).status).toBe(200);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("creates only two ledger balances and an audit entry atomically", async () => {
    reads(); expect((await POST(request())).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.create.mock.calls[0][1]).toMatchObject({ priorCreditId: "credit", duration: 4, format: "individual", status: "approved" });
    expect(mocks.create.mock.calls[1][1]).toMatchObject({ duration: 2, format: "group" });
    expect(mocks.create.mock.calls.some(([ref]) => ref.path.startsWith("sessions/"))).toBe(false);
  });
  it("rejects overlapping imported supervision without writing", async () => {
    reads({ rows: [{ data: () => ({ date: "2020-02-05", activityType: "supervision_direct", status: "approved" }) }] });
    const response = await POST(request()); expect((await response.json()).error).toBe("EXISTING_HOURS");
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects old sessions without linked activity rows", async () => {
    reads({ sessions: [{ data: () => ({ date: "2020-02-05", type: "individual" }) }] });
    expect((await POST(request())).status).toBe(409); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("honors historical month locks", async () => {
    reads({ lock: true }); expect((await (await POST(request())).json()).error).toBe("MONTH_LOCKED");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("annotates exact imported hours without adding balances or changing totals", async () => {
    reads({ credit: { mode: "existing" }, rows: [
      { id: "a", ref: { path: "fieldworkActivities/a" }, data: () => ({ date: "2020-02-05", activityType: "supervision_indirect", status: "approved", format: "individual", duration: 4, legacyImport: {} }) },
      { id: "b", ref: { path: "fieldworkActivities/b" }, data: () => ({ date: "2020-02-10", activityType: "supervision_indirect", status: "approved", format: "group", duration: 2, legacyImport: {} }) },
    ] });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1); // Audit only.
    expect(mocks.update.mock.calls.some(([ref]) => ref.path.startsWith("trainees/"))).toBe(false);
    expect(mocks.increment).not.toHaveBeenCalled();
  });
});
