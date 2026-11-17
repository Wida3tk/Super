import { describe, expect, it } from "vitest";
import { MESSAGE_MAX, accessFor, cleanMessage, conversationId, parseConversationId, participants } from "./model";

describe("conversation ids", () => {
  it("round-trips each kind", () => {
    for (const [kind, ids] of [["st", { supervisorId: "SUP-1", traineeId: "TR-001" }], ["at", { traineeId: "abc123" }], ["as", { supervisorId: "uid_9" }]] as const) {
      const id = conversationId(kind, ids);
      expect(parseConversationId(id)).toMatchObject({ kind, ...ids });
    }
  });

  it("rejects anything that could reach another document", () => {
    for (const bad of ["", "st__a", "at__a__b", "xx__a", "st__a/b__c", "at__../x", "st__a__b__c", "at__a b", null, 5])
      expect(parseConversationId(bad), String(bad)).toBeNull();
  });
});

describe("access", () => {
  const st = parseConversationId("st__S1__T1")!;
  const at = parseConversationId("at__T1")!;
  const as = parseConversationId("as__S1")!;
  const assigned = { currentSupervisorId: "S1" };

  it("lets a supervisor and their current trainee write to their thread", () => {
    expect(accessFor(st, { role: "supervisor", id: "S1" }, assigned)).toBe("write");
    expect(accessFor(st, { role: "trainee", id: "T1" }, assigned)).toBe("write");
  });

  it("hands the thread over when the trainee moves to another supervisor", () => {
    expect(accessFor(st, { role: "supervisor", id: "S1" }, { currentSupervisorId: "S2" })).toBeNull();
    expect(accessFor(st, { role: "trainee", id: "T1" }, { currentSupervisorId: "S2" })).toBeNull();
  });

  it("keeps other supervisors and trainees out", () => {
    expect(accessFor(st, { role: "supervisor", id: "S2" }, assigned)).toBeNull();
    expect(accessFor(st, { role: "trainee", id: "T2" }, assigned)).toBeNull();
    expect(accessFor(at, { role: "trainee", id: "T2" })).toBeNull();
    expect(accessFor(at, { role: "supervisor", id: "S1" })).toBeNull();
    expect(accessFor(as, { role: "supervisor", id: "S2" })).toBeNull();
    expect(accessFor(as, { role: "trainee", id: "T1" })).toBeNull();
  });

  it("lets the administration read supervisor threads and write its own", () => {
    expect(accessFor(st, { role: "admin", id: "admin" }, assigned)).toBe("read");
    expect(accessFor(at, { role: "admin", id: "admin" })).toBe("write");
    expect(accessFor(as, { role: "admin", id: "admin" })).toBe("write");
    expect(accessFor(at, { role: "trainee", id: "T1" })).toBe("write");
    expect(accessFor(as, { role: "supervisor", id: "S1" })).toBe("write");
  });

  it("counts unread for the two sides only", () => {
    expect(participants("st")).toEqual(["supervisor", "trainee"]);
    expect(participants("at")).toEqual(["admin", "trainee"]);
    expect(participants("as")).toEqual(["admin", "supervisor"]);
  });
});

describe("cleanMessage", () => {
  it("trims, keeps line breaks and refuses empty or long text", () => {
    expect(cleanMessage("  مرحبا\r\nكيف الحال  ")).toEqual({ text: "مرحبا\nكيف الحال" });
    expect(cleanMessage("   ")).toEqual({ error: "EMPTY" });
    expect(cleanMessage("a".repeat(MESSAGE_MAX + 1))).toEqual({ error: "TOO_LONG" });
    expect(cleanMessage("a\u0000b")).toEqual({ text: "ab" });
  });
});
