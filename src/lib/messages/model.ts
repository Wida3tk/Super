/**
 * In-platform messaging. Three kinds of conversation, one per pair:
 * - "st": a supervisor and their current trainee
 * - "at": the administration and a trainee
 * - "as": the administration and a supervisor
 * Messages cannot be edited or deleted: the thread is part of the supervision
 * record. The administration can open any thread; it writes only in its own.
 */

export type ChatRole = "admin" | "supervisor" | "trainee";
export type ConversationKind = "st" | "at" | "as";

export const MESSAGE_MAX = 2000;
const SEP = "__";
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const validId = (value: unknown): value is string => typeof value === "string" && ID.test(value) && !value.includes(SEP);

export interface ParsedConversation {
  kind: ConversationKind;
  supervisorId: string | null;
  traineeId: string | null;
}

export function conversationId(kind: ConversationKind, ids: { supervisorId?: string | null; traineeId?: string | null }) {
  if (kind === "st") return `st${SEP}${ids.supervisorId}${SEP}${ids.traineeId}`;
  if (kind === "at") return `at${SEP}${ids.traineeId}`;
  return `as${SEP}${ids.supervisorId}`;
}

export function parseConversationId(id: unknown): ParsedConversation | null {
  if (typeof id !== "string" || id.length > 300) return null;
  const [kind, a, b, ...rest] = id.split(SEP);
  if (rest.length) return null;
  if (kind === "st" && validId(a) && validId(b)) return { kind, supervisorId: a, traineeId: b };
  if (kind === "at" && validId(a) && b === undefined) return { kind, supervisorId: null, traineeId: a };
  if (kind === "as" && validId(a) && b === undefined) return { kind, supervisorId: a, traineeId: null };
  return null;
}

/** The roles that take part in (and get unread counts for) a conversation. */
export function participants(kind: ConversationKind): ChatRole[] {
  if (kind === "st") return ["supervisor", "trainee"];
  if (kind === "at") return ["admin", "trainee"];
  return ["admin", "supervisor"];
}

export type Access = "write" | "read" | null;

/**
 * @param trainee the trainee in the conversation, for supervisor threads: only
 * their current supervisor may take part, so a transfer hands the thread over.
 */
export function accessFor(conversation: ParsedConversation, actor: { role: ChatRole; id: string }, trainee?: { currentSupervisorId?: string | null } | null): Access {
  const { kind, supervisorId, traineeId } = conversation;
  if (actor.role === "admin") return kind === "st" ? "read" : "write";
  if (kind === "st") {
    if (!trainee || trainee.currentSupervisorId !== supervisorId) return null;
    if (actor.role === "supervisor" && actor.id === supervisorId) return "write";
    if (actor.role === "trainee" && actor.id === traineeId) return "write";
    return null;
  }
  if (kind === "at") return actor.role === "trainee" && actor.id === traineeId ? "write" : null;
  return actor.role === "supervisor" && actor.id === supervisorId ? "write" : null;
}

export function cleanMessage(text: unknown) {
  const value = String(text ?? "").replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!value) return { error: "EMPTY" as const };
  if (value.length > MESSAGE_MAX) return { error: "TOO_LONG" as const };
  return { text: value };
}

export const ROLE_LABEL: Record<ChatRole, string> = { admin: "الإدارة", supervisor: "المشرف", trainee: "المتدرب" };

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  /** The other side, as the viewer sees it. */
  title: string;
  subtitle: string;
  supervisorId: string | null;
  traineeId: string | null;
  lastMessage: { text: string; at: string; senderRole: ChatRole } | null;
  unread: number;
  access: Exclude<Access, null>;
  /** No message yet: the thread is created by the first one. */
  empty: boolean;
}

export interface ChatMessage {
  id: string;
  senderRole: ChatRole;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}
