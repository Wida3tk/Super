import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { getTraineeActivityLedger } from "@/lib/supervision/activityLedger";
import { calculateHourTotals } from "./hourTotals";

/**
 * Keeps the trainee summary cache aligned with the authoritative activity ledger.
 * Dashboards may read these cached values, but fieldworkActivities remains the
 * source of truth and this function can safely rebuild the cache at any time.
 */
export async function syncTraineeFieldworkTotals(traineeId: string, options?: { reconcileSupervisionCounters?: boolean }) {
  return adminDb.runTransaction(async tx => {
  const reference = adminDb.collection("trainees").doc(traineeId);
  const [trainee, activities, sessions] = await Promise.all([
    tx.get(reference),
    tx.get(adminDb.collection("fieldworkActivities").where("traineeId", "==", traineeId)),
    tx.get(adminDb.collection("sessions").where("traineeIds", "array-contains", traineeId)),
  ]);
  if (!trainee.exists) throw new Error("TRAINEE_NOT_FOUND");
  const ledger = await getTraineeActivityLedger(traineeId, { activities, sessions });
  const hours = calculateHourTotals(ledger);
  const totals = {
    approvedDirectHours: hours.direct,
    approvedIndirectHours: hours.indirect,
    approvedFieldworkHours: hours.fieldwork,
    approvedSupervisionHours: hours.supervision,
    approvedIndividualSupervisionHours: hours.individual,
    approvedGroupSupervisionHours: hours.group,
    // Total experience includes supervisor hours once, alongside activities.
    totalHours: hours.fieldwork,
    fieldworkTotalsUpdatedAt: new Date().toISOString(),
    // Explicit supervisor import already rebuilt these counters; keep that
    // operation atomic with the ledger read, not a separate stale write.
    ...(options?.reconcileSupervisionCounters ? {
      totalIndividualHours: hours.individual,
      totalGroupHours: hours.group,
    } : {}),
  };
  // Preserve legacy individual/group balances pending historical reconciliation.
  tx.update(reference, totals);
  return totals;
  });
}
