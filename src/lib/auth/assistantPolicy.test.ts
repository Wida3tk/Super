import { expect, it } from "vitest";
import { assistantCanAccessSupervisor, assistantCanAccessTrainee, assistantProfile, validAssistantScope, validDocumentId, type AssistantAccess } from "./assistantPolicy";
const user: AssistantAccess = { id: "a", name: "Helper", email: "helper@test.org", active: true, scope: "supervisors", supervisorIds: ["s"] };
it("permits assigned files only, and an assistant's own unassigned intake", () => {
  expect(assistantCanAccessTrainee(user, { currentSupervisorId: "s" })).toBe(true);
  expect(assistantCanAccessTrainee(user, { currentSupervisorId: "other" })).toBe(false);
  expect(assistantCanAccessTrainee(user, { currentSupervisorId: null, createdByAssistant: "a" })).toBe(true);
  expect(assistantCanAccessTrainee(user, { currentSupervisorId: null, createdByAssistant: "other" })).toBe(false);
  expect(assistantCanAccessTrainee(user, { currentSupervisorId: "other", createdByAssistant: "a" })).toBe(false);
});
it("disabled accounts lose all access, even with all scope", () => {
  expect(assistantCanAccessTrainee({ ...user, active: false, scope: "all" }, {})).toBe(false);
  expect(assistantCanAccessSupervisor({ ...user, active: false, scope: "all" }, "s")).toBe(false);
});
it("scope rejects missing, empty, duplicated and forged supervisor IDs", () => {
  for (const value of [{}, { scope: "supervisors", supervisorIds: [] }, { scope: "supervisors", supervisorIds: ["s", "s"] }, { scope: "supervisors", supervisorIds: ["a/b"] }, { scope: "admin", supervisorIds: [] }, { scope: "all", supervisorIds: ["s"] }]) expect(validAssistantScope(value)).toBe(false);
  expect(validAssistantScope({ scope: "supervisors", supervisorIds: ["s"] })).toBe(true);
  expect(validAssistantScope({ scope: "all", supervisorIds: [] })).toBe(true);
});
it("does not expose balances, financial data, internal notes or password hashes", () => {
  const result = assistantProfile("t", { name: "T", email: "t@test.org", totalHours: 88, password: "secret", internalNote: "private", fees: 500, fileUrl: "private-file" });
  for (const key of ["totalHours", "password", "internalNote", "fees", "fileUrl"]) expect(result).not.toHaveProperty(key);
});
it("document IDs never allow path traversal", () => {
  for (const id of [null, {}, "", ".", "..", "a/b"]) expect(validDocumentId(id)).toBe(false);
});
