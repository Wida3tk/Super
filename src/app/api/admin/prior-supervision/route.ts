import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { validatePriorCredit } from "@/lib/supervision/priorCredit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await req.json();
    const traineeId = String(body.traineeId || "");
    if (!traineeId || traineeId.includes("/")) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
    const traineeRef = adminDb.collection("trainees").doc(traineeId);
    const now = new Date().toISOString();
    if (body.action === "draft") {
      if (!validatePriorCredit(body, now.slice(0, 10)) || String(body.evidenceId).includes("/")) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
      const [trainee, evidence] = await Promise.all([traineeRef.get(), adminDb.collection("supervisionDocuments").doc(body.evidenceId).get()]);
      if (!trainee.exists || !evidence.exists || evidence.data()?.traineeId !== traineeId || !evidence.data()?.driveFileId || evidence.data()?.status === "revoked") return NextResponse.json({ error: "INVALID_EVIDENCE" }, { status: 400 });
      const ref = adminDb.collection("priorSupervisionCredits").doc();
      await ref.create({ traineeId, supervisorName: String(body.supervisorName).trim(), startDate: body.startDate, endDate: body.endDate, month: body.startDate.slice(0, 7), individualHours: body.individualHours, groupHours: body.groupHours, mode: body.mode, evidenceId: body.evidenceId, status: "draft", createdAt: now, createdBy: admin.uid });
      return NextResponse.json({ id: ref.id });
    }
    if (body.action !== "approve" || typeof body.creditId !== "string" || !body.creditId || body.creditId.includes("/")) return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    const creditRef = adminDb.collection("priorSupervisionCredits").doc(body.creditId);
    await adminDb.runTransaction(async tx => {
      const creditSnap = await tx.get(creditRef);
      const credit = creditSnap.data();
      if (!credit || credit.traineeId !== traineeId) throw new Error("NOT_FOUND");
      if (credit.status === "approved") return; // Idempotent approval, including retries.
      if (credit.status !== "draft" || !validatePriorCredit(credit, now.slice(0, 10))) throw new Error("INVALID_DATA");
      const [trainee, evidence, activities, sessions, approvals, snapshots, pending] = await Promise.all([
        tx.get(traineeRef), tx.get(adminDb.collection("supervisionDocuments").doc(credit.evidenceId)),
        tx.get(adminDb.collection("fieldworkActivities").where("traineeId", "==", traineeId)),
        tx.get(adminDb.collection("sessions").where("traineeIds", "array-contains", traineeId)),
        tx.get(adminDb.collection("monthlyApprovals").doc(`${traineeId}_${credit.month}`)),
        tx.get(adminDb.collection("monthlySnapshots").where("traineeId", "==", traineeId)),
        tx.get(adminDb.collection("supervisionReconciliations").where("traineeId", "==", traineeId)),
      ]);
      if (pending.docs.some(d => d.data().status === "pending" && String(d.data().candidate?.date || "").slice(0, 7) === credit.month)) throw new Error("EXISTING_HOURS");
      if (!trainee.exists || !evidence.exists || evidence.data()?.traineeId !== traineeId || !evidence.data()?.driveFileId || evidence.data()?.status === "revoked") throw new Error("INVALID_EVIDENCE");
      if (approvals.data()?.locked || snapshots.docs.some(d => d.data().month === credit.month && d.data().lockedAt)) throw new Error("MONTH_LOCKED");
      const rows = activities.docs.filter(d => String(d.data().date || "").slice(0, 7) === credit.month && String(d.data().activityType || "").startsWith("supervision_") && d.data().status !== "rejected");
      const monthSessions = sessions.docs.filter(d => !d.data().deleted && String(d.data().date || "").slice(0, 7) === credit.month && ["individual", "group"].includes(d.data().type));
      if (credit.mode === "new") {
        // Conservative: require reconciliation rather than guessing whether a partial
        // monthly balance overlaps any imported, submitted, or historical sessions.
        if (rows.length || monthSessions.length) throw new Error("EXISTING_HOURS");
        for (const [format, duration] of [["individual", credit.individualHours], ["group", credit.groupHours]] as const) {
          if (!duration) continue;
          tx.create(adminDb.collection("fieldworkActivities").doc(`prior_${creditRef.id}_${format}`), {
            traineeId, supervisorId: `external_${creditRef.id}`, priorCreditId: creditRef.id, previousSupervisorName: credit.supervisorName,
            date: credit.endDate, month: credit.month, startTime: "", endTime: "", duration, format,
            activityType: "supervision_indirect", status: "approved", evidenceNote: `إثبات: ${credit.evidenceId}`,
            description: `رصيد إشراف سابق مع ${credit.supervisorName} للفترة ${credit.startDate} — ${credit.endDate} (ملخص شهري وليس جلسة جديدة)`,
            reviewedBy: admin.uid, reviewedByRole: "admin", reviewedAt: now, createdAt: now, updatedAt: now,
          });
        }
        tx.update(traineeRef, { totalIndividualHours: FieldValue.increment(credit.individualHours), totalGroupHours: FieldValue.increment(credit.groupHours), totalHours: FieldValue.increment(credit.individualHours + credit.groupHours), approvedSupervisionHours: FieldValue.increment(credit.individualHours + credit.groupHours), approvedGroupSupervisionHours: FieldValue.increment(credit.groupHours), approvedFieldworkHours: FieldValue.increment(credit.individualHours + credit.groupHours), updatedAt: now });
      } else {
        if (!rows.length || monthSessions.length || rows.some(d => (!d.data().legacyImport && !d.data().supervisorHoursImport) || d.data().status !== "approved" || d.data().priorCreditId || d.data().date < credit.startDate || d.data().date > credit.endDate)) throw new Error("EXISTING_HOURS");
        const group = rows.filter(d => d.data().format === "group").reduce((n, d) => n + Number(d.data().duration), 0);
        const total = rows.reduce((n, d) => n + Number(d.data().duration), 0);
        if (Math.abs(group - credit.groupHours) > 0.001 || Math.abs(total - group - credit.individualHours) > 0.001) throw new Error("TOTAL_MISMATCH");
        if (rows.length > 400) throw new Error("TOO_MANY_ROWS");
        // Annotate the imported originals only; never add the same hours again.
        rows.forEach(d => tx.update(d.ref, { priorCreditId: creditRef.id, previousSupervisorName: credit.supervisorName }));
      }
      tx.update(creditRef, { status: "approved", approvedAt: now, approvedBy: admin.uid, activityIds: credit.mode === "existing" ? rows.map(d => d.id) : [credit.individualHours ? `prior_${creditRef.id}_individual` : null, credit.groupHours ? `prior_${creditRef.id}_group` : null].filter(Boolean) });
      tx.create(adminDb.collection("activityLog").doc(), { type: "prior_supervision_approved", traineeId, createdAt: now, actorId: admin.uid, message: "اعتماد ساعات إشراف سابقة", meta: { creditId: creditRef.id, mode: credit.mode } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FAILED";
    const known = ["NOT_FOUND", "INVALID_DATA", "INVALID_EVIDENCE", "MONTH_LOCKED", "EXISTING_HOURS", "TOTAL_MISMATCH", "TOO_MANY_ROWS"];
    return NextResponse.json({ error: known.includes(code) ? code : "FAILED" }, { status: known.includes(code) ? 409 : 500 });
  }
}
