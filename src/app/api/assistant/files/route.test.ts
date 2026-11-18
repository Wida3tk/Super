import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ user: null as any, trainee: {} as any, document: {} as any, storage: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/assistantAuth", () => ({ getAuthenticatedAssistant: async () => state.user }));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: { collection: (name: string) => ({ doc: () => ({ get: async () => ({ exists: true, data: () => name === "trainees" ? state.trainee : state.document }) }) }) }, adminStorage: { bucket: () => ({ file: state.storage }) } }));
import { GET, POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks(); state.user = { id: "a", active: true, scope: "supervisors", supervisorIds: ["s"] };
  state.trainee = { currentSupervisorId: "s" }; state.document = { traineeId: "t", uploadedByAssistant: "a", fileUrl: "supervision-documents/t/assistant-test" };
});
it("requires authentication for uploads and downloads", async () => {
  state.user = null;
  expect((await GET(new NextRequest("https://test/api/assistant/files?traineeId=t&documentId=d"))).status).toBe(401);
  expect((await POST(new NextRequest("https://test/api/assistant/files", { method: "POST" }))).status).toBe(401);
  expect(state.storage).not.toHaveBeenCalled();
});
it("cannot download files after the trainee leaves the assigned scope", async () => {
  state.trainee.currentSupervisorId = "other";
  expect((await GET(new NextRequest("https://test/api/assistant/files?traineeId=t&documentId=d"))).status).toBe(403);
  expect(state.storage).not.toHaveBeenCalled();
});
it("cannot use another document ID to download a different trainee's file", async () => {
  state.document.traineeId = "another";
  expect((await GET(new NextRequest("https://test/api/assistant/files?traineeId=t&documentId=d"))).status).toBe(403);
  expect(state.storage).not.toHaveBeenCalled();
});
it("does not turn arbitrary stored file paths into a download endpoint", async () => {
  state.document.fileUrl = "other-private-files/payments.xlsx";
  expect((await GET(new NextRequest("https://test/api/assistant/files?traineeId=t&documentId=d"))).status).toBe(403);
  expect(state.storage).not.toHaveBeenCalled();
});
