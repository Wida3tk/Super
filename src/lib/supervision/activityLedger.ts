import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { FieldworkActivity } from "@/types";

// Read-only projection for sessions recorded before linked activity rows existed.
// No historical documents are changed or deleted.
export async function getTraineeActivityLedger(traineeId: string): Promise<FieldworkActivity[]> {
  const [activities, sessions] = await Promise.all([
    adminDb.collection("fieldworkActivities").where("traineeId", "==", traineeId).get(),
    adminDb.collection("sessions").where("traineeIds", "array-contains", traineeId).get(),
  ]);
  const rows = activities.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as FieldworkActivity[];
  const linked = new Set(activities.docs.map((doc) => doc.data().sessionId).filter(Boolean));
  for (const doc of sessions.docs) {
    const session = doc.data();
    if (session.deleted || linked.has(doc.id) || !["individual", "group"].includes(session.type)) continue;
    const ambiguous = activities.docs.some((activity) => {
      const row = activity.data();
      return !row.sessionId && row.status === "approved" &&
        String(row.activityType || "").startsWith("supervision_") &&
        row.date === session.date && Number(row.duration) === Number(session.duration) &&
        row.format === session.type && row.supervisorId === session.supervisorId;
    });
    rows.push({ id: `session_${doc.id}_${traineeId}`, traineeId,
      supervisorId: session.supervisorId, date: session.date, month: session.month,
      duration: Number(session.duration || 0), activityType: "supervision_indirect",
      format: session.type, status: ambiguous ? "revision_requested" : "approved",
      description: ambiguous ? "جلسة قديمة تحتاج مطابقة مع سجل إشراف موجود قبل احتسابها" : session.notes || "جلسة إشراف مسجلة بواسطة المشرف",
      startTime: "", endTime: "", createdAt: session.createdAt || "", updatedAt: session.createdAt || "",
    } as FieldworkActivity);
  }
  return rows;
}
