import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { directoryState } from "./directory";
export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("INVALID_MONTH");
  const start = new Date(`${month}-01T00:00:00Z`), end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
export async function readMonthTransitions(month: string) {
  const { start, end } = monthBounds(month);
  return adminDb.collection("traineeLifecycleTransitions").where("changedAt", ">=", start).where("changedAt", "<", end).get();
}
export async function readDirectoryTransitions(trainees: any[], month: string) {
  monthBounds(month);
  // The collapsed monthly report loads only when explicitly opened.
  const docs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  // Basic phases need no historical scan. Only exceptional files need their
  // previous evidenced milestone; preserve that history rather than guessing.
  const exceptional = trainees.filter(t => directoryState(t).exception).map(t => t.id);
  for (let offset = 0; offset < exceptional.length; offset += 30) {
    const history = await adminDb.collection("traineeLifecycleTransitions").where("traineeId", "in", exceptional.slice(offset, offset + 30)).get();
    history.docs.forEach(d => docs.set(d.id, d));
  }
  return [...docs.values()].map(d => ({ id: d.id, ...d.data() }));
}
