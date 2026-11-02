import type { FieldworkActivity } from "@/types";

type SessionDoc = { id: string; data: Record<string, any> };

/**
 * Pure projection of supervisor sessions recorded before linked activity rows
 * existed. Shared by the per-trainee ledger and the admin control room so both
 * count exactly the same hours. Nothing is written.
 */
export function projectLegacySessions(activities: FieldworkActivity[], sessions: SessionDoc[], traineeId: string): FieldworkActivity[] {
  const rows = [...activities];
  const linked = new Set(activities.map((row: any) => row.sessionId).filter(Boolean));
  for (const { id, data: session } of sessions) {
    if (session.deleted || linked.has(id) || !["individual", "group"].includes(session.type)) continue;
    if (!Array.isArray(session.traineeIds) || !session.traineeIds.includes(traineeId)) continue;
    const ambiguous = activities.some((row: any) =>
      !row.sessionId && row.status === "approved" &&
      String(row.activityType || "").startsWith("supervision_") &&
      row.date === session.date && Number(row.duration) === Number(session.duration) &&
      row.format === session.type && row.supervisorId === session.supervisorId);
    rows.push({ id: `session_${id}_${traineeId}`, traineeId,
      supervisorId: session.supervisorId, date: session.date, month: session.month,
      duration: Number(session.duration || 0), activityType: "supervision_indirect",
      format: session.type, status: ambiguous ? "revision_requested" : "approved",
      description: ambiguous ? "جلسة قديمة تحتاج مطابقة مع سجل إشراف موجود قبل احتسابها" : session.notes || "جلسة إشراف مسجلة بواسطة المشرف",
      startTime: "", endTime: "", createdAt: session.createdAt || "", updatedAt: session.createdAt || "",
    } as FieldworkActivity);
  }
  return rows;
}
