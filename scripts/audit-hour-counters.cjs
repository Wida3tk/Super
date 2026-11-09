#!/usr/bin/env node
/**
 * Read-only audit: legacy supervision counters vs the activity ledger.
 *
 * For every trainee it prints the legacy counters (totalIndividualHours,
 * totalGroupHours), the rebuilt totals (approved*SupervisionHours), the
 * supervision hours found in approved fieldworkActivities rows, and the
 * difference. Nothing is written.
 *
 * Usage (same env vars as the app: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 * FIREBASE_PRIVATE_KEY_BASE64 or FIREBASE_PRIVATE_KEY):
 *   node scripts/audit-hour-counters.cjs > hour-counters.csv
 *
 * Legacy sessions still waiting for reconciliation sit in the counters but not
 * in the ledger; those trainees show a positive difference and need the
 * reconciliation flow before the screens switch to ledger totals.
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const key = process.env.FIREBASE_PRIVATE_KEY_BASE64
  ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8")
  : (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !key) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / private key.");
  process.exit(1);
}
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: key }) });
const db = getFirestore(process.env.FIRESTORE_DATABASE_ID || undefined);

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

(async () => {
  const [trainees, activities] = await Promise.all([
    db.collection("trainees").get(),
    db.collection("fieldworkActivities").where("status", "==", "approved").get(),
  ]);
  const ledger = new Map();
  for (const doc of activities.docs) {
    const a = doc.data();
    if (!String(a.activityType || "").startsWith("supervision_")) continue;
    const entry = ledger.get(a.traineeId) || { individual: 0, group: 0 };
    entry[a.format === "group" ? "group" : "individual"] += Number(a.duration) || 0;
    ledger.set(a.traineeId, entry);
  }
  console.log(["traineeId", "name", "status", "legacyIndividual", "legacyGroup", "approvedSupervision", "ledgerIndividual", "ledgerGroup", "difference", "totalsRebuiltAt"].join(","));
  let mismatched = 0;
  for (const doc of trainees.docs) {
    const t = doc.data();
    const legacy = (Number(t.totalIndividualHours) || 0) + (Number(t.totalGroupHours) || 0);
    const l = ledger.get(doc.id) || { individual: 0, group: 0 };
    const difference = round(legacy - (l.individual + l.group));
    if (Math.abs(difference) > 0.01) mismatched += 1;
    console.log([doc.id, t.name, t.status, round(Number(t.totalIndividualHours) || 0), round(Number(t.totalGroupHours) || 0), t.approvedSupervisionHours ?? "", round(l.individual), round(l.group), difference, t.fieldworkTotalsUpdatedAt || ""].map(csv).join(","));
  }
  console.error(`${trainees.size} trainees, ${mismatched} with counters that differ from the ledger.`);
})().catch((error) => { console.error(error); process.exit(1); });
