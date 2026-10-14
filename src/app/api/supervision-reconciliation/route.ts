import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin, getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";
import { getTraineeActivityLedger } from "@/lib/supervision/activityLedger";
import { resolveReconciliation } from "@/lib/supervision/reconciliation";

export const dynamic = "force-dynamic";
function evidenceKey(ledger: Awaited<ReturnType<typeof getTraineeActivityLedger>>, month: string) {
  const rows = ledger.filter(a => a.month === month && a.activityType.startsWith("supervision_")).map(a =>
    [a.id, a.date, a.duration, a.format, a.status, a.startTime, a.endTime, a.supervisorId]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
async function actor() {
  const admin = await requireAdmin();
  if (admin) return { role: "admin" as const, id: admin.uid };
  const supervisor = await getAuthenticatedSupervisor();
  return supervisor ? { role: "supervisor" as const, id: supervisor.id } : null;
}
export async function GET(req: NextRequest) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const traineeId = req.nextUrl.searchParams.get("traineeId") || "";
  if (user.role === "admin" && !traineeId) return NextResponse.json({ error: "TRAINEE_REQUIRED" }, { status: 400 });
  const query = user.role === "admin"
    ? adminDb.collection("supervisionReconciliations").where("traineeId", "==", traineeId)
    : adminDb.collection("supervisionReconciliations").where("assignedSupervisorId", "==", user.id);
  const snapshot = await query.where("status", "==", "pending").limit(500).get();
  const records: any[] = [];
  const cache = new Map<string, { supervisorId: string; ledger: Awaited<ReturnType<typeof getTraineeActivityLedger>> }>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!cache.has(data.traineeId)) {
      const trainee = await adminDb.collection("trainees").doc(data.traineeId).get();
      if (user.role === "supervisor" && trainee.data()?.currentSupervisorId !== user.id) continue;
      cache.set(data.traineeId, { supervisorId: trainee.data()?.currentSupervisorId || "", ledger: await getTraineeActivityLedger(data.traineeId) });
    }
    const current = cache.get(data.traineeId)!;
    const currentMatches = current.ledger.filter(a => a.date === data.candidate.date && a.activityType.startsWith("supervision_") && a.status !== "rejected")
      .map(a => ({ date: a.date, duration: a.duration, format: a.format, startTime: a.startTime || "", endTime: a.endTime || "" }));
    const reviewKey = evidenceKey(current.ledger, String(data.candidate.date).slice(0, 7));
    records.push({ ...data, id: doc.id, currentMatches, reviewKey,
      adminApproval: data.adminApproval?.evidenceKey === reviewKey ? data.adminApproval : null,
      supervisorApproval: data.supervisorApproval?.actorId === current.supervisorId && data.supervisorApproval?.evidenceKey === reviewKey ? data.supervisorApproval : null });
  }
  return NextResponse.json({ records }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(req: NextRequest) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, decision, note, reviewKey } = await req.json();
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id) ||
    !["keep_existing", "add_separate"].includes(decision) || typeof note !== "string" || !note.trim() || note.length > 1000 || typeof reviewKey !== "string" || !/^[a-f0-9]{64}$/.test(reviewKey))
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  try {
    const result = await adminDb.runTransaction(async tx => {
      const reference = adminDb.collection("supervisionReconciliations").doc(id);
      const request = await tx.get(reference);
      if (!request.exists) throw new Error("NOT_FOUND");
      const data = request.data()!;
      const traineeRef = adminDb.collection("trainees").doc(data.traineeId);
      const trainee = await tx.get(traineeRef);
      const currentSupervisor = trainee.data()?.currentSupervisorId;
      if (!trainee.exists || (user.role === "supervisor" && currentSupervisor !== user.id)) throw new Error("FORBIDDEN");
      if (data.status !== "pending") return { status: data.status, alreadyResolved: true };
      if (!currentSupervisor) throw new Error("SUPERVISOR_REQUIRED");
      const row = data.candidate, month = String(row.date).slice(0, 7);
      const [activities, sessions, approval, snapshots] = await Promise.all([
        tx.get(adminDb.collection("fieldworkActivities").where("traineeId", "==", data.traineeId)),
        tx.get(adminDb.collection("sessions").where("traineeIds", "array-contains", data.traineeId)),
        tx.get(adminDb.collection("monthlyApprovals").doc(`${data.traineeId}_${month}`)),
        tx.get(adminDb.collection("monthlySnapshots").where("traineeId", "==", data.traineeId)),
      ]);
      if (decision === "add_separate" && (approval.data()?.locked || snapshots.docs.some(d => d.data().month === month && d.data().lockedAt))) throw new Error("MONTH_LOCKED");
      const ledger = await getTraineeActivityLedger(data.traineeId, { activities, sessions });
      const currentKey = evidenceKey(ledger, month);
      if (reviewKey !== currentKey) throw new Error("EVIDENCE_CHANGED");
      const now = new Date().toISOString();
      const stamp = { actorId: user.id, decision, note: note.trim(), at: now, evidenceKey: currentKey };
      // A changed ledger or assigned supervisor invalidates earlier consent.
      const adminApproval = user.role === "admin" ? stamp : data.adminApproval?.evidenceKey === currentKey ? data.adminApproval : null;
      const supervisorApproval = user.role === "supervisor" ? stamp :
        data.supervisorApproval?.actorId === currentSupervisor && data.supervisorApproval?.evidenceKey === currentKey ? data.supervisorApproval : null;
      const outcome = resolveReconciliation(adminApproval, supervisorApproval);
      const resolved = ["keep_existing", "add_separate"].includes(outcome);
      if (outcome === "add_separate") {
        const duration = Number(row.duration);
        if (!Number.isFinite(duration) || duration <= 0 || duration > 16 || !["individual", "group"].includes(row.format)) throw new Error("INVALID_DATA");
        const creditId = `reconciled_${id}`;
        tx.create(adminDb.collection("priorSupervisionCredits").doc(creditId), {
          traineeId: data.traineeId, supervisorName: data.supervisorName, startDate: row.date, endDate: row.date, month,
          individualHours: row.format === "individual" ? duration : 0, groupHours: row.format === "group" ? duration : 0,
          mode: "workbook", sourceFileHash: data.sourceFileHash, sourceSheet: data.sourceSheet, status: "approved",
          createdAt: now, createdBy: data.createdBy, approvedAt: now, approvedBy: adminApproval.actorId,
          reconciliationId: id, adminApproval, supervisorApproval,
        });
        tx.create(adminDb.collection("fieldworkActivities").doc(creditId), {
          traineeId: data.traineeId, supervisorId: `external_${createHash("sha256").update(data.supervisorName).digest("hex").slice(0, 24)}`,
          previousSupervisorName: data.supervisorName, priorCreditId: creditId, reconciliationId: id,
          date: row.date, month, duration, format: row.format, activityType: "supervision_indirect", status: "approved",
          startTime: "", endTime: "", description: `جلسة إضافية موثقة بعد مطابقة الإدارة والمشرف — ${data.supervisorName}`,
          priorWorkbookSource: { hash: data.sourceFileHash, sheet: data.sourceSheet, row: row.sourceRow, column: row.sourceColumn },
          createdAt: now, updatedAt: now, reviewedAt: now, reviewedBy: adminApproval.actorId,
        });
        tx.update(traineeRef, {
          totalIndividualHours: FieldValue.increment(row.format === "individual" ? duration : 0), totalGroupHours: FieldValue.increment(row.format === "group" ? duration : 0),
          approvedSupervisionHours: FieldValue.increment(duration), approvedGroupSupervisionHours: FieldValue.increment(row.format === "group" ? duration : 0),
          approvedFieldworkHours: FieldValue.increment(duration), totalHours: FieldValue.increment(duration), updatedAt: now,
        });
      }
      tx.update(reference, { adminApproval, supervisorApproval, assignedSupervisorId: currentSupervisor,
        status: resolved ? "resolved" : "pending", outcome, updatedAt: now, ...(resolved ? { resolvedAt: now } : {}) });
      tx.create(adminDb.collection("activityLog").doc(), { type: "supervision_reconciliation_review", traineeId: data.traineeId,
        actorId: user.id, actorRole: user.role, message: "مراجعة طلب مطابقة ساعات الإشراف", createdAt: now, meta: { requestId: id, decision, outcome, note: note.trim(), evidenceKey: currentKey } });
      return { status: resolved ? "resolved" : "pending", outcome };
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "REVIEW_FAILED";
    const status = code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : ["MONTH_LOCKED", "SUPERVISOR_REQUIRED", "EVIDENCE_CHANGED"].includes(code) ? 409 : code === "INVALID_DATA" ? 400 : 503;
    return NextResponse.json({ error: status === 503 ? "REVIEW_FAILED" : code }, { status });
  }
}
