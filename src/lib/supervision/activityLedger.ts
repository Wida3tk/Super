import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { FieldworkActivity } from "@/types";
import { projectLegacySessions } from "./legacySessions";

// Read-only projection for sessions recorded before linked activity rows existed.
// No historical documents are changed or deleted.
export async function getTraineeActivityLedger(traineeId: string, loaded?: { activities?: FirebaseFirestore.QuerySnapshot; sessions?: FirebaseFirestore.QuerySnapshot }): Promise<FieldworkActivity[]> {
  const [activities, sessions] = await Promise.all([
    loaded?.activities || adminDb.collection("fieldworkActivities").where("traineeId", "==", traineeId).get(),
    loaded?.sessions || adminDb.collection("sessions").where("traineeIds", "array-contains", traineeId).get(),
  ]);
  const rows = activities.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as FieldworkActivity[];
  return projectLegacySessions(rows, sessions.docs.map((doc) => ({ id: doc.id, data: { traineeIds: [traineeId], ...doc.data() } })), traineeId);
}
