import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSupervisor: vi.fn(),
  collection: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({
  getAuthenticatedSupervisor: mocks.getAuthenticatedSupervisor,
}));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: mocks.collection,
    runTransaction: mocks.runTransaction,
  },
}));

import { PATCH } from "./route";

const request = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/supervisor/booking", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

const snapshot = (data?: Record<string, unknown>) => ({
  exists: Boolean(data),
  data: () => data || {},
});

describe("PATCH /api/supervisor/booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSupervisor.mockResolvedValue({ id: "supervisor-1" });
  });

  it("requires an authenticated supervisor", async () => {
    mocks.getAuthenticatedSupervisor.mockResolvedValue(null);
    const response = await PATCH(
      request({ bookingId: "booking-1", meetingStatus: "completed" }),
    );
    expect(response.status).toBe(401);
  });

  it("does not allow a supervisor to modify another supervisor's booking", async () => {
    mocks.collection.mockReturnValue({
      doc: () => ({ get: vi.fn(async () => snapshot({ supervisorId: "other" })) }),
    });
    const response = await PATCH(
      request({ bookingId: "booking-1", meetingStatus: "completed" }),
    );
    expect(response.status).toBe(403);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("returns a seat when missed and consumes it again if corrected", async () => {
    const bookingRef = {
      path: "bookings/booking-1",
      get: vi.fn(async () => snapshot({ supervisorId: "supervisor-1" })),
    };
    const supervisorRef = { path: "supervisors/supervisor-1" };
    mocks.collection.mockImplementation((name: string) => ({
      doc: () => (name === "bookings" ? bookingRef : supervisorRef),
    }));
    const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
    mocks.runTransaction.mockImplementation(async (callback) =>
      callback({
        get: async (ref: { path: string }) =>
          ref.path.startsWith("bookings/")
            ? snapshot({
                supervisorId: "supervisor-1",
                meetingStatus: "missed",
                bookingType: "initial_interview",
              })
            : snapshot({ availableSeats: 3 }),
        update: (ref: { path: string }, data: Record<string, unknown>) =>
          updates.push({ path: ref.path, data }),
      }),
    );

    const response = await PATCH(
      request({ bookingId: "booking-1", meetingStatus: "completed" }),
    );
    expect(response.status).toBe(200);
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "bookings/booking-1",
          data: expect.objectContaining({ meetingStatus: "completed" }),
        }),
        {
          path: "supervisors/supervisor-1",
          data: { availableSeats: 2 },
        },
      ]),
    );
  });
});
