import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ authenticated: true, owner: "s", liveOwner: "", livePending: false, expired: false, pending: false, rows: [] as any[], reconciliation: false, saved: null as any, set: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({ getAuthenticatedSupervisor: async () => mock.authenticated ? { id: "s", name: "Supervisor", credentialExpiresAt: mock.expired ? "2020-01-01" : "" } : null }));
vi.mock("@/lib/supervision/activityLedger", () => ({ getTraineeActivityLedger: async () => mock.rows }));
vi.mock("@/lib/firebase/admin", () => {
  const ref = (name: string): any => ({ name, doc: () => ref(name), where: () => ref(name), set: mock.set,
    get: async () => name === "trainees" ? { exists: true, data: () => ({ currentSupervisorId: mock.owner, license: "QASP-S" }) }
      : name === "monthlyApprovals" ? { data: () => mock.saved }
      : { docs: mock.reconciliation ? [{ data: () => ({ candidate: { date: "2026-10-01" } }) }] : [] },
  });
  return { adminDb: { collection: ref, runTransaction: async (callback: any) => callback({
    get: (reference: any) => reference.name === "trainees" && mock.liveOwner
      ? { exists: true, data: () => ({ currentSupervisorId: mock.liveOwner }) }
      : reference.name === "supervisionReconciliations" && mock.livePending
        ? { docs: [{ data: () => ({ candidate: { date: "2026-10-01" } }) }] } : reference.get(),
    set: (_reference: any, data: any, options: any) => { mock.set(data, options); mock.saved = data; },
  }) } };
});
import { POST } from "./route";
const row = (activityType: string, duration: number, extra = {}) => ({ id: activityType, activityType, duration, status: "approved", month: "2026-10", format: "individual", ...extra });
const request = (extra = {}) => new Request("https://test/api/supervisor/monthly-approval", { method: "POST", body: JSON.stringify({ traineeId: "t", month: "2026-10", attestation: true, ...extra }) }) as never;
beforeEach(() => {
  vi.clearAllMocks(); mock.authenticated = true; mock.owner = "s"; mock.expired = false; mock.reconciliation = false;
  mock.saved = null;
  mock.liveOwner = ""; mock.livePending = false;
  mock.rows = [row("indirect", 9), row("supervision_indirect", 1)];
});
it("preserves an existing locked approval and its exception on retries", async () => {
  mock.saved = { locked: true, supervisorApprovedAt: "old", traineeAcknowledgedAt: "consent", hoursShortfallException: { confirmedAt: "old" } };
  const response = await POST(request({ allowIncompleteHours: true }));
  expect(response.status).toBe(200);
  expect((await response.json()).approval).toEqual(mock.saved);
  expect(mock.set).not.toHaveBeenCalled();
});
it("a repeated approval writes only once", async () => {
  await POST(request({ allowIncompleteHours: true })); await POST(request({ allowIncompleteHours: true }));
  expect(mock.set).toHaveBeenCalledTimes(1);
});
it("blocks a reassignment occurring before the transaction commits", async () => {
  mock.liveOwner = "other";
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(403);
  expect(mock.set).not.toHaveBeenCalled();
});
it("blocks a matching request added before the transaction commits", async () => {
  mock.livePending = true;
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(409);
  expect(mock.set).not.toHaveBeenCalled();
});
it("rejects invalid document identifiers and month values before writing", async () => {
  for (const body of [{ traineeId: "a/b" }, { month: "2026-13" }, { month: "2099-01" }])
    expect((await POST(request(body))).status).toBe(400);
  expect(mock.set).not.toHaveBeenCalled();
});
it("requests explicit confirmation for a month below the minimum", async () => {
  const result = await POST(request());
  expect(result.status).toBe(409);
  expect(await result.json()).toMatchObject({ error: "MONTH_HOURS_INCOMPLETE", actualHours: 10, minimumHours: 20 });
  expect(mock.set).not.toHaveBeenCalled();
});
it("allows actual hours with supervisor confirmation and preserves the compliance exception", async () => {
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(200);
  expect(mock.set.mock.calls[0][0]).toMatchObject({ summary: { fieldwork: 10, supervision: 1 }, monthlyMinimumException: { confirmedBy: "s", actualHours: 10, minimumHours: 20 }, locked: false });
});
it("does not treat a string as explicit confirmation", async () => {
  expect((await POST(request({ allowIncompleteHours: "true" }))).status).toBe(409);
  expect(mock.set).not.toHaveBeenCalled();
});
it("keeps standard approval unchanged for a complete month", async () => {
  mock.rows = [row("indirect", 19), row("supervision_indirect", 1)];
  expect((await POST(request())).status).toBe(200);
  expect(mock.set.mock.calls[0][0].monthlyMinimumException).toBeNull();
});
it("cannot bypass pending matching requests", async () => {
  mock.reconciliation = true;
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(409);
  expect(mock.set).not.toHaveBeenCalled();
});
it("cannot bypass outstanding activity reviews", async () => {
  mock.rows.push(row("direct", 2, { status: "submitted" }));
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(409);
  expect(mock.set).not.toHaveBeenCalled();
});
it("cannot bypass upper limit or empty hours", async () => {
  for (const rows of [[], [row("indirect", 150), row("supervision_indirect", 10)]]) {
    mock.rows = rows;
    expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(409);
  }
  expect(mock.set).not.toHaveBeenCalled();
});
it("allows short supervision hours only after an explicit warning and confirmation", async () => {
  mock.rows = [row("indirect", 30), row("supervision_indirect", 0.5)];
  const preview = await POST(request());
  expect(preview.status).toBe(409);
  expect((await preview.json()).warnings).toHaveLength(2);
  expect(mock.set).not.toHaveBeenCalled();
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(200);
  expect(mock.set.mock.calls[0][0].hoursShortfallException).toMatchObject({ meetsSupervision: false, hasRequiredIndividualContact: false });
});
it("retains ownership and credential checks", async () => {
  mock.owner = "other";
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(403);
  mock.owner = "s"; mock.expired = true;
  expect((await POST(request({ allowIncompleteHours: true }))).status).toBe(409);
  mock.authenticated = false;
  expect((await POST(request())).status).toBe(401);
  expect(mock.set).not.toHaveBeenCalled();
});
