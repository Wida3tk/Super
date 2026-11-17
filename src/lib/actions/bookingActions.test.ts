import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ bookings: [] as any[], trainee: null as any, writes: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.1.1.1"]]) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/validation/booking", () => ({ validateBookingPayload: () => null, isManagementToken: () => true }));
vi.mock("@/lib/operations/monitoring", () => ({ recordOperationalFailure: async () => undefined }));
vi.mock("@/lib/calendar/googleCalendar", () => ({ createCalendarEvent: async () => ({ meetLink: "", googleEventId: "" }), cancelCalendarEvent: async () => undefined }));
vi.mock("@/lib/email/emailService", () => ({ sendBookingConfirmationEmail: async () => undefined, sendSupervisorBookingNotification: async () => undefined, sendCancellationEmail: async () => undefined }));
vi.mock("@/lib/auth/serverAuth", () => ({ getSessionUser: async () => ({ email: "t@example.test" }) }));
vi.mock("@/lib/firebase/admin", () => {
  const query = (name: string, filters: [string, unknown][] = []): any => ({
    name, filters,
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]]),
    limit: () => query(name, filters),
  });
  const collection = (name: string) => ({ ...query(name), doc: (id = "new") => ({ name, id, update: async () => undefined }) });
  const snap = (docs: any[]) => ({ docs: docs.map((d, i) => ({ id: String(i), data: () => d })) });
  return {
    adminAuth: { getUserByEmail: async () => ({ uid: "u" }) },
    adminDb: {
      collection,
      runTransaction: async (cb: any) => cb({
        get: async (ref: any) => {
          if (ref.name === "supervisors") return { exists: true, data: () => ({ name: "S", availableSeats: 3, isActive: true }) };
          if (ref.name === "availability") return { exists: true, data: () => ({ supervisorId: "S1", date: "2099-01-01", time: "10:00", isBooked: false }) };
          if (ref.name === "trainees") return snap(mock.trainee ? [mock.trainee] : []);
          if (ref.name === "bookings") return snap(mock.bookings.filter((b) => ref.filters.every(([f, v]: [string, unknown]) => b[f] === v)));
          return snap([]);
        },
        set: (ref: any) => mock.writes.push(ref.name),
        update: () => undefined,
      }),
    },
  };
});

import { createBooking } from "./bookingActions";
const payload = { studentName: "متدرب", studentEmail: "t@example.test", studentPhone: "0550000000", supervisorId: "S1", availabilitySlotId: "slot", date: "2099-01-01", time: "10:00", password: "x", bookingType: "initial_interview" } as any;
const held = (over = {}) => ({ studentEmail: "t@example.test", bookingType: "initial_interview", status: "closed", meetingStatus: "completed", ...over });

beforeEach(() => { mock.bookings = []; mock.trainee = null; mock.writes = []; });

it("allows a second initial interview after the first one", async () => {
  mock.bookings = [held()];
  expect((await createBooking(payload)).success).toBe(true);
});

it("refuses a third initial interview unless the administration allowed one more", async () => {
  mock.bookings = [held(), held()];
  expect(await createBooking(payload)).toMatchObject({ success: false, error: "INTERVIEW_LIMIT_REACHED" });
  mock.trainee = { extraInterviewsAllowed: 1 };
  expect((await createBooking(payload)).success).toBe(true);
});

it("gives back a cancelled or missed interview and never limits consultations", async () => {
  mock.bookings = [held(), held({ status: "cancelled" })];
  expect((await createBooking(payload)).success).toBe(true);
  mock.bookings = [held(), held({ status: "confirmed", meetingStatus: "missed" })];
  expect((await createBooking(payload)).success).toBe(true);
  mock.bookings = [held(), held()];
  expect((await createBooking({ ...payload, bookingType: "consultation", consultationType: "x" })).success).toBe(true);
});
