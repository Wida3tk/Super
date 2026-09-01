import "server-only";

import { adminDb } from "@/lib/firebase/admin";

/**
 * Keeps the trainee summary cache aligned with the authoritative activity ledger.
 * Dashboards may read these cached values, but fieldworkActivities remains the
 * source of truth and this function can safely rebuild the cache at any time.
 */
export async function syncTraineeFieldworkTotals(traineeId: string) {
  const snapshot = await adminDb
    .collection("fieldworkActivities")
    .where("traineeId", "==", traineeId)
    .get();

  let direct = 0;
  let indirect = 0;
  let supervision = 0;
  let groupSupervision = 0;
  for (const document of snapshot.docs) {
    const activity = document.data();
    if (activity.status !== "approved") continue;
    const duration = Number(activity.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) continue;
    if (activity.activityType === "direct") direct += duration;
    else if (activity.activityType === "indirect") indirect += duration;
    else if (String(activity.activityType).startsWith("supervision_")) {
      supervision += duration;
      if (activity.format === "group") groupSupervision += duration;
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  const totals = {
    approvedDirectHours: round(direct),
    approvedIndirectHours: round(indirect),
    approvedFieldworkHours: round(direct + indirect),
    approvedSupervisionHours: round(supervision),
    approvedGroupSupervisionHours: round(groupSupervision),
    // Compatibility field for existing administration screens. It now means
    // approved fieldwork, never supervision-session attendance.
    totalHours: round(direct + indirect),
    fieldworkTotalsUpdatedAt: new Date().toISOString(),
  };
  await adminDb.collection("trainees").doc(traineeId).set(totals, { merge: true });
  return totals;
}
