import "server-only";
import { getSessionUser } from "./serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { ASSISTANT_ROLE, validAssistantScope, type AssistantAccess } from "./assistantPolicy";

export async function getAuthenticatedAssistant(): Promise<AssistantAccess | null> {
  const user = await getSessionUser();
  if (!user || user.role !== ASSISTANT_ROLE) return null;
  const record = await adminDb.collection("administrativeAssistants").doc(user.uid).get();
  const data = record.data();
  if (!data || data.active !== true || data.role !== ASSISTANT_ROLE || !validAssistantScope(data) ||
      !user.email || String(data.email).toLowerCase() !== user.email.trim().toLowerCase()) return null;
  return { id: user.uid, name: String(data.name), email: String(data.email), active: true,
    scope: data.scope, supervisorIds: data.supervisorIds };
}
