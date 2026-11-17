import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor, getAuthenticatedTrainee, requireAdmin } from "@/lib/auth/serverAuth";
import { sendNewMessageEmail } from "@/lib/email/emailService";
import {
  ROLE_LABEL, accessFor, cleanMessage, conversationId, parseConversationId, participants,
  type Access, type ChatMessage, type ChatRole, type ConversationSummary, type ParsedConversation,
} from "./model";

export interface Actor { role: ChatRole; id: string; name: string }

const conversations = () => adminDb.collection("conversations");

/** The signed-in user acting in the portal they are on (an admin may also be a supervisor). */
export async function resolveActor(as: unknown): Promise<Actor | null> {
  if (as === "admin") {
    const admin = await requireAdmin();
    return admin ? { role: "admin", id: "admin", name: "الإدارة" } : null;
  }
  if (as === "supervisor") {
    const supervisor = await getAuthenticatedSupervisor();
    return supervisor ? { role: "supervisor", id: supervisor.id, name: supervisor.name || "المشرف" } : null;
  }
  if (as === "trainee") {
    const trainee = await getAuthenticatedTrainee();
    return trainee ? { role: "trainee", id: trainee.id, name: trainee.name || "المتدرب" } : null;
  }
  return null;
}

async function people(parsed: ParsedConversation) {
  const [trainee, supervisor] = await Promise.all([
    parsed.traineeId ? adminDb.collection("trainees").doc(parsed.traineeId).get() : null,
    parsed.supervisorId ? adminDb.collection("supervisors").doc(parsed.supervisorId).get() : null,
  ]);
  return {
    trainee: trainee?.exists ? ({ id: trainee.id, ...trainee.data() } as Record<string, any>) : null,
    supervisor: supervisor?.exists ? ({ id: supervisor.id, ...supervisor.data() } as Record<string, any>) : null,
  };
}

export async function openConversation(id: unknown, actor: Actor) {
  const parsed = parseConversationId(id);
  if (!parsed) return null;
  const found = await people(parsed);
  if ((parsed.traineeId && !found.trainee) || (parsed.supervisorId && !found.supervisor)) return null;
  const access = accessFor(parsed, actor, found.trainee);
  if (!access) return null;
  return { id: String(id), parsed, access, ...found };
}

function titleFor(parsed: ParsedConversation, viewer: ChatRole, names: { trainee?: string; supervisor?: string }) {
  if (parsed.kind === "st") {
    if (viewer === "admin") return { title: `${names.supervisor || "المشرف"} · ${names.trainee || "المتدرب"}`, subtitle: "مشرف ومتدرب" };
    return viewer === "supervisor"
      ? { title: names.trainee || "المتدرب", subtitle: "متدرب" }
      : { title: names.supervisor || "المشرف", subtitle: "مشرفك" };
  }
  if (viewer === "admin") return parsed.kind === "at"
    ? { title: names.trainee || "متدرب", subtitle: "متدرب" }
    : { title: names.supervisor || "مشرف", subtitle: "مشرف" };
  return { title: "الإدارة", subtitle: "فريق الإدارة" };
}

function summary(id: string, data: Record<string, any> | undefined, parsed: ParsedConversation, viewer: ChatRole, access: Exclude<Access, null>, names: { trainee?: string; supervisor?: string }): ConversationSummary {
  return {
    id,
    kind: parsed.kind,
    ...titleFor(parsed, viewer, { trainee: data?.traineeName || names.trainee, supervisor: data?.supervisorName || names.supervisor }),
    supervisorId: parsed.supervisorId,
    traineeId: parsed.traineeId,
    lastMessage: data?.lastMessage || null,
    unread: access === "write" ? Number(data?.unread?.[viewer] || 0) : 0,
    access,
    empty: !data?.lastMessage,
  };
}

const byRecent = (a: ConversationSummary, b: ConversationSummary) =>
  b.unread - a.unread || String(b.lastMessage?.at || "").localeCompare(String(a.lastMessage?.at || "")) || a.title.localeCompare(b.title, "ar");

/** Every thread the actor can open, including the ones not started yet. */
export async function listConversations(actor: Actor): Promise<ConversationSummary[]> {
  if (actor.role === "admin") {
    const snap = await conversations().orderBy("updatedAt", "desc").limit(300).get();
    return snap.docs.flatMap((doc) => {
      const parsed = parseConversationId(doc.id);
      return parsed ? [summary(doc.id, doc.data(), parsed, "admin", parsed.kind === "st" ? "read" : "write", {})] : [];
    }).sort(byRecent);
  }
  if (actor.role === "supervisor") {
    const [traineesSnap, convSnap, me] = await Promise.all([
      adminDb.collection("trainees").where("currentSupervisorId", "==", actor.id).get(),
      conversations().where("supervisorId", "==", actor.id).get(),
      adminDb.collection("supervisors").doc(actor.id).get(),
    ]);
    const existing = new Map(convSnap.docs.map((doc) => [doc.id, doc.data()]));
    const adminId = conversationId("as", { supervisorId: actor.id });
    const list: ConversationSummary[] = [summary(adminId, existing.get(adminId), parseConversationId(adminId)!, "supervisor", "write", {})];
    for (const doc of traineesSnap.docs) {
      const trainee = doc.data();
      if (trainee.isDemo) continue;
      const id = conversationId("st", { supervisorId: actor.id, traineeId: doc.id });
      list.push(summary(id, existing.get(id), parseConversationId(id)!, "supervisor", "write", { trainee: trainee.name, supervisor: me.data()?.name }));
    }
    return list.sort(byRecent);
  }
  const trainee = await adminDb.collection("trainees").doc(actor.id).get();
  const supervisorId = trainee.data()?.currentSupervisorId || null;
  const ids = [conversationId("at", { traineeId: actor.id }), ...(supervisorId ? [conversationId("st", { supervisorId, traineeId: actor.id })] : [])];
  const [docs, supervisor] = await Promise.all([
    Promise.all(ids.map((id) => conversations().doc(id).get())),
    supervisorId ? adminDb.collection("supervisors").doc(supervisorId).get() : null,
  ]);
  return docs.map((doc) => summary(doc.id, doc.data(), parseConversationId(doc.id)!, "trainee", "write", { supervisor: supervisor?.data()?.name })).sort(byRecent);
}

export async function unreadCount(actor: Actor) {
  if (actor.role === "admin") {
    const snap = await conversations().where("unread.admin", ">", 0).get();
    return snap.docs.reduce((sum, doc) => sum + Number(doc.data().unread?.admin || 0), 0);
  }
  const list = await listConversations(actor);
  return list.reduce((sum, item) => sum + item.unread, 0);
}

type Opened = NonNullable<Awaited<ReturnType<typeof openConversation>>>;

/** Messages of a thread, oldest first; reading clears the viewer's unread count. */
export async function readThread(opened: Opened, actor: Actor) {
  const ref = conversations().doc(opened.id);
  const [doc, messagesSnap] = await Promise.all([
    ref.get(),
    ref.collection("messages").orderBy("createdAt", "desc").limit(300).get(),
  ]);
  const messages: ChatMessage[] = messagesSnap.docs.reverse().map((m) => {
    const data = m.data();
    return { id: m.id, senderRole: data.senderRole, senderId: data.senderId, senderName: data.senderName, text: data.text, createdAt: data.createdAt };
  });
  if (doc.exists && opened.access === "write" && Number(doc.data()?.unread?.[actor.role] || 0) > 0)
    await ref.update({ [`unread.${actor.role}`]: 0, [`lastReadAt.${actor.role}`]: new Date().toISOString() });
  const conversation = summary(opened.id, doc.data(), opened.parsed, actor.role, opened.access, { trainee: opened.trainee?.name, supervisor: opened.supervisor?.name });
  return { conversation: { ...conversation, unread: 0 }, messages };
}

export async function sendMessage(opened: Opened, actor: Actor, rawText: unknown) {
  if (opened.access !== "write") return { error: "READ_ONLY" as const };
  const cleaned = cleanMessage(rawText);
  if ("error" in cleaned) return { error: cleaned.error };
  const now = new Date().toISOString();
  const ref = conversations().doc(opened.id);
  const messageRef = ref.collection("messages").doc();
  const recipients = participants(opened.parsed.kind).filter((role) => role !== actor.role);
  const message: ChatMessage = { id: messageRef.id, senderRole: actor.role, senderId: actor.id, senderName: actor.name, text: cleaned.text, createdAt: now };

  const firstUnread = await adminDb.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const unread = current.data()?.unread || {};
    tx.set(ref, {
      kind: opened.parsed.kind,
      supervisorId: opened.parsed.supervisorId,
      traineeId: opened.parsed.traineeId,
      traineeName: opened.trainee?.name || null,
      supervisorName: opened.supervisor?.name || null,
      lastMessage: { text: cleaned.text.slice(0, 160), at: now, senderRole: actor.role },
      updatedAt: now,
      ...(current.exists ? {} : { createdAt: now }),
      unread: Object.fromEntries([
        ...participants(opened.parsed.kind).map((role) => [role, role === actor.role ? 0 : FieldValue.increment(1)]),
      ]),
    }, { merge: true });
    tx.set(messageRef, { senderRole: message.senderRole, senderId: message.senderId, senderName: message.senderName, text: message.text, createdAt: now });
    return recipients.filter((role) => !Number(unread[role] || 0));
  });

  // One email per unread streak: only when the recipient had nothing unread here.
  await Promise.all(firstUnread.map(async (role) => {
    const email = role === "admin" ? process.env.ADMIN_EMAIL : role === "trainee" ? opened.trainee?.email : opened.supervisor?.email;
    if (!email) return;
    const chat = encodeURIComponent(opened.id);
    const portal = role === "admin" ? `admin/messages?chat=${chat}` : role === "supervisor" ? `supervisor-dashboard?section=messages&chat=${chat}` : `trainee-dashboard?tab=messages&chat=${chat}`;
    try {
      await sendNewMessageEmail({ to: String(email), fromName: actor.role === "admin" ? ROLE_LABEL.admin : actor.name, preview: cleaned.text, path: `/ar/${portal}` });
    } catch (error) {
      console.error("[messages] email failed", error);
    }
  }));
  return { message };
}

