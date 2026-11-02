import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { contractDateFor } from "./compliance";

/**
 * Adds `contractSignedAt` to each trainee (trainee field first, then the
 * supervision agreement), so client screens can pick the right QBA rule.
 * Reads only; nothing is written.
 */
export async function withContractDates<T extends { id: string; contractSignedAt?: unknown }>(trainees: T[]) {
  if (!trainees.length) return trainees;
  const agreements = await adminDb.collection("supervisionAgreements").get();
  const signed = new Map(agreements.docs.map((doc) => [doc.id, doc.data()?.signedAt]));
  return trainees.map((trainee) => ({ ...trainee, contractSignedAt: contractDateFor(trainee, { signedAt: signed.get(trainee.id) }) }));
}

export async function contractDateForTrainee(traineeId: string, trainee: { contractSignedAt?: unknown } | undefined) {
  const agreement = await adminDb.collection("supervisionAgreements").doc(traineeId).get();
  return contractDateFor(trainee, agreement.data());
}
