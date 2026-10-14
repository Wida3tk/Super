import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { readPreviousSupervisorWorkbook, reconcilePreviousHours, type PreviousHour } from "@/lib/imports/previousSupervisorWorkbook";
export const runtime = "nodejs";
export const maxDuration = 60;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const form = await req.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size > 12 * 1024 * 1024 || !file.size) return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer()), fileHash = hash(bytes);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as never);
    if (workbook.worksheets.length > 50) return NextResponse.json({ error: "TOO_MANY_SHEETS" }, { status: 400 });
    const parsed = readPreviousSupervisorWorkbook(workbook, new Date().toISOString().slice(0, 10));
    const supervisorName = String(form.get("supervisorName") || parsed.supervisorName).trim().slice(0, 200);
    if (!supervisorName || !parsed.trainees.length) return NextResponse.json({ error: "UNSUPPORTED_FILE" }, { status: 400 });
    // Exact identity lookups, never scan every trainee in the project.
    // Unmatched/legacy-formatted emails remain blocked for review, not auto-created.
    const emails = [...new Set(parsed.trainees.map(t => t.email))];
    const accountDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (let offset = 0; offset < emails.length; offset += 30) {
      const chunk = await adminDb.collection("trainees").where("email", "in", emails.slice(offset, offset + 30)).get();
      accountDocs.push(...chunk.docs);
    }
    const preview: any[] = [];
    const matched: Array<{ traineeId: string; item: typeof parsed.trainees[number] }> = [];
    for (const item of parsed.trainees) {
      const matches = accountDocs.filter(d => String(d.data().email || "").trim().toLowerCase() === item.email);
      const issues = [...item.issues];
      if (item.hours.length > 350) issues.push("أكثر من 350 جلسة؛ قسّمي الملف للمراجعة");
      if (matches.length !== 1) issues.push(matches.length ? "أكثر من حساب بنفس البريد" : "لا يوجد حساب مطابق للبريد");
      const traineeId = matches.length === 1 ? matches[0].id : null;
      let duplicates = 0, fresh: PreviousHour[] = [], conflictCount = 0;
      if (traineeId && !issues.length) {
        const state = await plan(traineeId, item.hours, undefined, fileHash, item.sheet);
        issues.push(...state.issues); duplicates = state.duplicates; fresh = state.fresh;
        conflictCount = state.conflicts.length;
        if (!issues.length) matched.push({ traineeId, item });
      }
      preview.push({ sheet: item.sheet, name: item.name, email: item.email, traineeId, issues, duplicates, conflicts: conflictCount, sessions: item.hours.length, newSessions: fresh.length, individual: fresh.filter(h => h.format === "individual").reduce((n, h) => n + h.duration, 0), group: fresh.filter(h => h.format === "group").reduce((n, h) => n + h.duration, 0), details: item.hours });
    }
    const previewToken = hash(JSON.stringify({ fileHash, supervisorName, preview }));
    if (form.get("action") !== "commit") return NextResponse.json({ supervisorName, preview, previewToken });
    if (form.get("previewToken") !== previewToken) return NextResponse.json({ error: "PREVIEW_CHANGED" }, { status: 409 });
    const selected: string[] = JSON.parse(String(form.get("traineeIds") || "[]"));
    if (!Array.isArray(selected) || !selected.length || selected.length > 30 || selected.some(id => typeof id !== "string" || !matched.some(m => m.traineeId === id))) return NextResponse.json({ error: "INVALID_SELECTION" }, { status: 400 });
    // Original source is stored privately before any hours are written. This
    // avoids the broken Drive path; failure to archive stops the import.
    const source = adminDb.collection("priorSupervisionSources").doc(fileHash);
    if (!(await source.get()).exists) {
      const batch = adminDb.batch(); let parts = 0;
      for (let offset = 0; offset < bytes.length; offset += 500000) { batch.set(source.collection("parts").doc(String(parts++)), { bytes: bytes.subarray(offset, offset + 500000) }); }
      batch.set(source, { name: file.name.slice(0, 200), hash: fileHash, size: bytes.length, parts, createdBy: admin.uid, createdAt: new Date().toISOString() }); await batch.commit();
    }
    const results: any[] = [];
    for (const id of [...new Set(selected)]) {
      const item = matched.find(m => m.traineeId === id)!.item;
      try {
        const result = await adminDb.runTransaction(async tx => {
          const state = await plan(id, item.hours, tx, fileHash, item.sheet);
          if (state.issues.length) throw new Error("CONFLICT");
          if (state.fresh.length > 350) throw new Error("TOO_MANY_SESSIONS");
          const trainee = await tx.get(adminDb.collection("trainees").doc(id));
          if (!trainee.exists || String(trainee.data()?.email || "").trim().toLowerCase() !== item.email) throw new Error("ACCOUNT_CHANGED");
          const now = new Date().toISOString();
          for (const conflict of state.conflicts) {
            const row = conflict.hour;
            const requestId = hash(`${id}|${fileHash}|${item.sheet}|${row.sourceRow}|${row.sourceColumn}`);
            tx.create(adminDb.collection("supervisionReconciliations").doc(requestId), {
              traineeId: id, traineeName: item.name, assignedSupervisorId: trainee.data()?.currentSupervisorId || null,
              status: "pending", candidate: row, matches: conflict.matches, supervisorName,
              sourceFileHash: fileHash, sourceSheet: item.sheet, createdAt: now, createdBy: admin.uid,
              adminApproval: null, supervisorApproval: null,
            });
          }
          if (state.conflicts.length) {
            tx.create(adminDb.collection("activityLog").doc(), { type: "supervision_reconciliation_requested", traineeId: id,
              actorId: admin.uid, message: "تعليق ساعات مستوردة للمطابقة واعتماد الإدارة والمشرف", createdAt: now,
              meta: { sourceHash: fileHash, sessions: state.conflicts.length } });
            tx.create(adminDb.collection("notifications").doc(), { targetType: "admin", traineeId: id, read: false,
              type: "supervision_reconciliation", title: "ساعات إشراف تحتاج مطابقة واعتمادًا مزدوجًا", message: `${item.name}: ${state.conflicts.length} سجل معلّق`, createdAt: now });
            if (trainee.data()?.currentSupervisorId) tx.create(adminDb.collection("notifications").doc(), {
              supervisorId: trainee.data()!.currentSupervisorId, targetType: "supervisor", traineeId: id, read: false,
              type: "supervision_reconciliation", title: "طلب مطابقة ساعات إشراف", message: `${item.name}: يحتاج اعتمادك واعتماد الإدارة`, createdAt: now,
            });
          }
          const months = [...new Set(state.fresh.map(h => h.date.slice(0, 7)))];
          for (const month of months) {
            const rows = state.fresh.filter(h => h.date.startsWith(month));
            const creditId = `workbook_${hash(`${id}|${fileHash}|${month}`).slice(0, 40)}`;
            const dates = rows.map(h => h.date).sort();
            const individual = rows.filter(h => h.format === "individual").reduce((n, h) => n + h.duration, 0), group = rows.filter(h => h.format === "group").reduce((n, h) => n + h.duration, 0);
            tx.create(adminDb.collection("priorSupervisionCredits").doc(creditId), { traineeId: id, supervisorName, startDate: dates[0], endDate: dates[dates.length - 1], month, individualHours: individual, groupHours: group, mode: "workbook", sourceFileHash: fileHash, sourceSheet: item.sheet, status: "approved", createdAt: now, createdBy: admin.uid, approvedAt: now, approvedBy: admin.uid });
            for (const row of rows) {
              const rowId = `prior_session_${hash(`${id}|${fileHash}|${item.sheet}|${row.sourceRow}|${row.sourceColumn}`).slice(0, 40)}`;
              tx.create(adminDb.collection("fieldworkActivities").doc(rowId), { traineeId: id, supervisorId: `external_${hash(supervisorName).slice(0, 24)}`, priorCreditId: creditId, previousSupervisorName: supervisorName, date: row.date, month, duration: row.duration, format: row.format, activityType: "supervision_indirect", status: "approved", startTime: "", endTime: "", description: `جلسة إشراف سابقة مع ${supervisorName} — مستوردة من ${item.sheet}`, evidenceNote: `مصدر محفوظ: ${fileHash}`, priorWorkbookSource: { hash: fileHash, sheet: item.sheet, row: row.sourceRow, column: row.sourceColumn }, createdAt: now, updatedAt: now, reviewedAt: now, reviewedBy: admin.uid });
            }
          }
          const individual = state.fresh.filter(h => h.format === "individual").reduce((n, h) => n + h.duration, 0), group = state.fresh.filter(h => h.format === "group").reduce((n, h) => n + h.duration, 0);
          if (state.fresh.length) { tx.update(trainee.ref, { totalIndividualHours: FieldValue.increment(individual), totalGroupHours: FieldValue.increment(group), totalHours: FieldValue.increment(individual + group), approvedSupervisionHours: FieldValue.increment(individual + group), approvedGroupSupervisionHours: FieldValue.increment(group), approvedFieldworkHours: FieldValue.increment(individual + group), updatedAt: now }); tx.create(adminDb.collection("activityLog").doc(), { type: "prior_supervision_import", traineeId: id, actorId: admin.uid, message: "استيراد جلسات مشرف سابق", createdAt: now, meta: { sourceHash: fileHash, individual, group, sessions: state.fresh.length } }); }
          return { added: state.fresh.length, pending: state.conflicts.length, duplicates: state.duplicates, individual, group };
        });
        results.push({ traineeId: id, name: item.name, success: true, ...result });
      } catch { results.push({ traineeId: id, name: item.name, success: false, error: "تغيرت السجلات أو يوجد تعارض. أعيدي المعاينة؛ لم يُضف شيء لهذا الحساب." }); }
    }
    return NextResponse.json({ results });
  } catch { return NextResponse.json({ error: "IMPORT_FAILED" }, { status: 400 }); }
}

async function plan(traineeId: string, hours: PreviousHour[], tx?: FirebaseFirestore.Transaction, fileHash?: string, sheet?: string) {
  const get = (ref: any): Promise<any> => tx ? tx.get(ref) : ref.get();
  const [activities, sessions, credits, approvals, snapshots, requests] = await Promise.all([
    get(adminDb.collection("fieldworkActivities").where("traineeId", "==", traineeId)), get(adminDb.collection("sessions").where("traineeIds", "array-contains", traineeId)),
    get(adminDb.collection("priorSupervisionCredits").where("traineeId", "==", traineeId)), get(adminDb.collection("monthlyApprovals").where("traineeId", "==", traineeId)), get(adminDb.collection("monthlySnapshots").where("traineeId", "==", traineeId)),
    get(adminDb.collection("supervisionReconciliations").where("traineeId", "==", traineeId)),
  ]);
  const linked = new Set(activities.docs.map((d: any) => d.data().sessionId).filter(Boolean));
  const rows = activities.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((a: any) => String(a.activityType).startsWith("supervision_") && a.status !== "rejected").map((a: any) => ({ id: a.id, date: a.date, format: a.format, duration: a.duration, status: a.status, startTime: a.startTime || "", endTime: a.endTime || "" }));
  for (const d of sessions.docs) { const s = d.data(); if (!s.deleted && !linked.has(d.id) && ["individual", "group"].includes(s.type)) rows.push({ id: `session_${d.id}`, date: s.date, format: s.type, duration: s.duration, status: "approved", startTime: "", endTime: "" }); }
  const recorded = new Set(requests.docs.map((d: any) => d.id));
  const unprocessed = hours.filter(h => !recorded.has(hash(`${traineeId}|${fileHash}|${sheet}|${h.sourceRow}|${h.sourceColumn}`)));
  // Another upload must not bypass a still-pending match by changing file bytes.
  for (const d of requests.docs) { const r = d.data(); if (r.status === "pending" && r.sourceFileHash !== fileHash) rows.push({ date: r.candidate.date, format: r.candidate.format, duration: r.candidate.duration, status: "submitted" }); }
  const state = reconcilePreviousHours(unprocessed, rows,
    [...approvals.docs.filter((d: any) => d.data().locked), ...snapshots.docs.filter((d: any) => d.data().lockedAt)].map((d: any) => d.data().month),
    credits.docs.filter((d: any) => d.data().status === "approved").map((d: any) => d.data().month));
  return state;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("source") || "";
  if (!/^[a-f0-9]{64}$/.test(id)) return NextResponse.json({ error: "INVALID_SOURCE" }, { status: 400 });
  const ref = adminDb.collection("priorSupervisionSources").doc(id), doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const parts = await Promise.all(Array.from({ length: Number(doc.data()!.parts) }, (_, i) => ref.collection("parts").doc(String(i)).get()));
  const bytes = Buffer.concat(parts.map(p => Buffer.from(p.data()!.bytes)));
  if (hash(bytes) !== id) return NextResponse.json({ error: "SOURCE_CORRUPT" }, { status: 500 });
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=previous-supervisor-source.xlsx", "Cache-Control": "private, no-store" } });
}
