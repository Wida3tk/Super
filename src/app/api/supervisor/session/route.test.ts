import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSupervisor: vi.fn(),
  logActivity: vi.fn(),
  collection: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({
  getAuthenticatedSupervisor: mocks.getAuthenticatedSupervisor,
}));
vi.mock("@/lib/activityLog", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: mocks.collection,
    runTransaction: mocks.runTransaction,
  },
}));

import { DELETE, POST } from "./route";

type StoredDocument = { exists: boolean; data: () => Record<string, unknown> };

const request = (sessionId: unknown) =>
  new Request("http://localhost/api/supervisor/session", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }) as never;

function document(data?: Record<string, unknown>): StoredDocument {
  return { exists: Boolean(data), data: () => data || {} };
}

function setupDocuments(
  session: Record<string, unknown>,
  snapshot: Record<string, unknown> = {},
  trainee: Record<string, unknown> = {},
  approval: Record<string, unknown> = {},
) {
  const refs = new Map<string, { path: string; get: ReturnType<typeof vi.fn> }>();
  const values: Record<string, StoredDocument> = {
    "sessions/session-1": document(session),
    "monthlySnapshots/supervisor-1_trainee-1_2026-09": document(snapshot),
    "trainees/trainee-1": document(trainee),
    "monthlyApprovals/trainee-1_2026-09": document(approval),
  };

  mocks.collection.mockImplementation((collectionName: string) => ({
    doc: (id: string) => {
      const path = `${collectionName}/${id}`;
      if (!refs.has(path)) {
        refs.set(path, { path, get: vi.fn(async () => values[path] || document()) });
      }
      return refs.get(path)!;
    },
  }));

  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  mocks.runTransaction.mockImplementation(async (callback) =>
    callback({
      get: async (ref: { path: string }) => values[ref.path] || document(),
      update: (ref: { path: string }, data: Record<string, unknown>) =>
        updates.push({ path: ref.path, data }),
      set: (ref: { path: string }, data: Record<string, unknown>) =>
        updates.push({ path: ref.path, data }),
    }),
  );

  return { updates };
}

describe("DELETE /api/supervisor/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00.000Z"));
    mocks.getAuthenticatedSupervisor.mockResolvedValue({
      id: "supervisor-1",
      name: "Supervisor",
    });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getAuthenticatedSupervisor.mockResolvedValue(null);
    const response = await DELETE(request("session-1"));
    expect(response.status).toBe(401);
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("rejects a session owned by another supervisor", async () => {
    setupDocuments({
      supervisorId: "supervisor-2",
      month: "2026-09",
    });
    const response = await DELETE(request("session-1"));
    expect(response.status).toBe(403);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects deletion when the monthly snapshot is locked", async () => {
    setupDocuments(
      {
        supervisorId: "supervisor-1",
        traineeIds: ["trainee-1"],
        month: "2026-09",
        type: "individual",
        duration: 1,
      },
      { lockedAt: "2026-09-20T00:00:00.000Z" },
    );
    const response = await DELETE(request("session-1"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "الشهر مقفل" });
  });
  it("rejects a new session when only the administrative approval is locked", async () => {
    const { updates } = setupDocuments({}, {}, { currentSupervisorId: "supervisor-1" }, { locked: true });
    const response = await POST(new Request("http://localhost/api/supervisor/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "individual", date: "2026-09-20", duration: 1, traineeIds: ["trainee-1"] }),
    }) as never);
    expect(response.status).toBe(409);
    expect(updates).toEqual([]);
  });
  it("atomically saves the supervisor session and its activity ledger row", async () => {
    const { updates } = setupDocuments({}, {}, { currentSupervisorId: "supervisor-1" });
    const response = await POST(new Request("http://localhost/api/supervisor/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "individual", date: "2026-09-20", duration: 1.5, traineeIds: ["trainee-1"] }),
    }) as never);
    expect(response.status).toBe(200);
    expect(updates.filter((item) => item.path.startsWith("fieldworkActivities/")).map((item) => item.data))
      .toEqual([expect.objectContaining({ traineeId: "trainee-1", duration: 1.5, format: "individual", status: "approved", supervisionSource: "supervisor_session" })]);
    expect(updates.some((item) => item.path.startsWith("sessions/"))).toBe(true);
  });

  it.each(["individual", "group", "absence", "warning"])(
    "rejects creating %s records when any trainee month is locked",
    async (type) => {
      const { updates } = setupDocuments(
        {},
        { lockedAt: "2026-09-20T00:00:00.000Z" },
        { currentSupervisorId: "supervisor-1" },
      );
      // A group request includes another owned trainee; the first is locked.
      if (type === "group") {
        const original = mocks.collection.getMockImplementation()!;
        mocks.collection.mockImplementation((name: string) => {
          const collection = original(name);
          return { ...collection, doc: (id: string) => id === "trainee-2"
            ? { path: "trainees/trainee-2", get: async () => document({ currentSupervisorId: "supervisor-1" }) }
            : collection.doc(id) };
        });
      }
      const response = await POST(new Request("http://localhost/api/supervisor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, date: "2026-09-20", duration: 1,
          traineeIds: type === "group" ? ["trainee-1", "trainee-2"] : ["trainee-1"] }),
      }) as never);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "الشهر مقفل" });
      expect(updates).toEqual([]);
      expect(mocks.logActivity).not.toHaveBeenCalled();
    },
  );

  it("atomically reverses totals and soft-deletes an individual session", async () => {
    const { updates } = setupDocuments(
      {
        supervisorId: "supervisor-1",
        traineeIds: ["trainee-1"],
        month: "2026-09",
        type: "individual",
        duration: 1.5,
        date: "2026-09-20",
      },
      {
        individualHours: 4,
        groupHours: 2,
        absenceCount: 1,
        warningCount: 0,
      },
      { totalIndividualHours: 10, totalGroupHours: 5 },
    );

    const response = await DELETE(request("session-1"));
    expect(response.status).toBe(200);
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "monthlySnapshots/supervisor-1_trainee-1_2026-09",
          data: expect.objectContaining({
            individualHours: 2.5,
            groupHours: 2,
            totalHours: 4.5,
          }),
        }),
        expect.objectContaining({
          path: "trainees/trainee-1",
          data: expect.objectContaining({
            totalIndividualHours: 8.5,
            totalGroupHours: 5,
            totalSupervisionSessionHours: 13.5,
          }),
        }),
        expect.objectContaining({
          path: "sessions/session-1",
          data: expect.objectContaining({
            deleted: true,
            deletedBy: "supervisor-1",
          }),
        }),
      ]),
    );
    expect(mocks.logActivity).toHaveBeenCalledOnce();
  });
});
