export const ASSISTANT_ROLE = "administrative_assistant";
export type AssistantAccess = { id: string; name: string; email: string; active: boolean; scope: "all" | "supervisors"; supervisorIds: string[] };
export function validDocumentId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("/") && value !== "." && value !== "..";
}
export function validAssistantScope(value: { scope?: unknown; supervisorIds?: unknown }): boolean {
  return (value.scope === "all" && Array.isArray(value.supervisorIds) && value.supervisorIds.length === 0) ||
    (value.scope === "supervisors" && Array.isArray(value.supervisorIds) && value.supervisorIds.length > 0 && value.supervisorIds.length <= 30 &&
      value.supervisorIds.every(validDocumentId) && new Set(value.supervisorIds).size === value.supervisorIds.length);
}
export function assistantCanAccessSupervisor(user: AssistantAccess, id: string) {
  return user.active === true && validDocumentId(id) && (user.scope === "all" || user.supervisorIds.includes(id));
}
export function assistantCanAccessTrainee(user: AssistantAccess, trainee: Record<string, unknown>) {
  return user.active === true && (user.scope === "all" ||
    (typeof trainee.currentSupervisorId === "string" && user.supervisorIds.includes(trainee.currentSupervisorId)) ||
    (!trainee.currentSupervisorId && trainee.createdByAssistant === user.id));
}
export function assistantProfile(id: string, data: Record<string, unknown>) {
  // Deliberately omit balances, financial data, internal notes, credentials and file URLs.
  return { id, name: String(data.name || ""), email: String(data.email || ""), phone: String(data.phone || ""),
    license: String(data.license || ""), status: String(data.status || ""), lifecycleStage: String(data.lifecycleStage || ""),
    currentSupervisorId: String(data.currentSupervisorId || "") };
}
