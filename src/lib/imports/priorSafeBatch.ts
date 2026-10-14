import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { DocumentReference, DocumentData, SetOptions } from "firebase-admin/firestore";

// Serializes historical imports with prior-credit approval and prevents a later
// workbook from adding or changing supervision already certified as prior credit.
export function priorSafeImportBatch(traineeId: string) {
  const writes: Array<{ ref: DocumentReference; data: DocumentData; options?: SetOptions; create: boolean; remove?: boolean }> = [];
  return {
    create(ref: DocumentReference, data: DocumentData) { writes.push({ ref, data, create: true }); },
    set(ref: DocumentReference, data: DocumentData, options: SetOptions) { writes.push({ ref, data, options, create: false }); },
    delete(ref: DocumentReference, data: DocumentData) { writes.push({ ref, data, create: false, remove: true }); },
    commit: () => adminDb.runTransaction(async tx => {
      const credits = await tx.get(adminDb.collection("priorSupervisionCredits").where("traineeId", "==", traineeId));
      const pending = await tx.get(adminDb.collection("supervisionReconciliations").where("traineeId", "==", traineeId));
      const protectedMonths = new Set(credits.docs.filter(d => d.data().status === "approved").map(d => d.data().month));
      pending.docs.filter(d => d.data().status === "pending").forEach(d => protectedMonths.add(String(d.data().candidate?.date || "").slice(0, 7)));
      if (writes.some(w => String(w.data.activityType || "").startsWith("supervision_") && protectedMonths.has(String(w.data.date || "").slice(0, 7)))) throw new Error("PRIOR_SUPERVISION_RECONCILIATION_REQUIRED");
      writes.forEach(w => { if (w.remove) tx.delete(w.ref); else if (w.create) tx.create(w.ref, w.data); else tx.set(w.ref, w.data, w.options!); });
    }),
  };
}
