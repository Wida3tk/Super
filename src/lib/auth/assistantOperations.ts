import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { assistantCanAccessTrainee, validAssistantScope, type AssistantAccess } from "./assistantPolicy";
export class AssistantError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
export async function liveAssistant(tx: FirebaseFirestore.Transaction, user: AssistantAccess) {
  const record = await tx.get(adminDb.collection("administrativeAssistants").doc(user.id));
  const data = record.data();
  if (!data || data.active !== true || data.role !== "administrative_assistant" || data.email !== user.email || !validAssistantScope(data)) throw new AssistantError("ACCESS_DISABLED");
  return { ...user, scope: data.scope, supervisorIds: data.supervisorIds } as AssistantAccess;
}
export async function scopedTrainee(tx: FirebaseFirestore.Transaction, user: AssistantAccess, id: string) {
  const current = await liveAssistant(tx, user);
  const record = await tx.get(adminDb.collection("trainees").doc(id));
  if (!record.exists || !assistantCanAccessTrainee(current, record.data()!)) throw new AssistantError("FORBIDDEN");
  return record;
}
export function assistantAudit(tx: FirebaseFirestore.Transaction, user: AssistantAccess, type: string, traineeId: string, meta: Record<string, unknown>) {
  tx.create(adminDb.collection("activityLog").doc(), { type, actorId: user.id, actorName: user.name, actorRole: "administrative_assistant",
    traineeId, message: "إجراء مساعد إداري", meta, createdAt: new Date().toISOString() });
  if (["assistant_request_created", "assistant_trainee_created"].includes(type)) tx.create(adminDb.collection("notifications").doc(), {
    targetType: "admin", type: "assistant_request", traineeId, message: `طلب متابعة إدارية من ${user.name}`,
    read: false, createdAt: new Date().toISOString(),
  });
}
