import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { syncTraineeFieldworkTotals } from "@/lib/fieldwork/syncTotals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportedHour = {
  sourceMonth: number;
  sourceRow: number;
  date: string;
  duration: number;
  format: "individual" | "group";
};

const text = (value: ExcelJS.CellValue) => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) return text(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text || "").trim();
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
};

const email = (value: ExcelJS.CellValue) => text(value).toLowerCase().replace(/^mailto:/, "");

function isoDate(value: ExcelJS.CellValue) {
  const raw = value && typeof value === "object" && "result" in value ? value.result : value;
  if (raw instanceof Date && !Number.isNaN(raw.valueOf())) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(Date.UTC(1899, 11, 30) + raw * 86400000).toISOString().slice(0, 10);
  }
  const valueText = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(valueText)) return valueText.slice(0, 10);
  return "";
}

function number(value: ExcelJS.CellValue) {
  const raw = value && typeof value === "object" && "result" in value ? value.result : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseHours(sheet: ExcelJS.Worksheet) {
  const rows: ImportedHour[] = [];
  for (let monthIndex = 0; monthIndex < 20; monthIndex += 1) {
    const blockRow = 20 + Math.floor(monthIndex / 4) * 13;
    const blockColumn = 2 + (monthIndex % 4) * 21;
    for (let offset = 0; offset < 7; offset += 1) {
      const row = blockRow + 3 + offset;
      const date = isoDate(sheet.getCell(row, blockColumn).value);
      if (!date) continue;
      const individual = number(sheet.getCell(row, blockColumn + 10).value);
      const group = number(sheet.getCell(row, blockColumn + 15).value);
      if (individual) rows.push({ sourceMonth: monthIndex + 1, sourceRow: row, date, duration: individual, format: "individual" });
      if (group) rows.push({ sourceMonth: monthIndex + 1, sourceRow: row, date, duration: group, format: "group" });
    }
  }
  return rows;
}

function sourceId(supervisorId: string, traineeEmail: string, row: ImportedHour) {
  const key = ["supervisor-hours-v1", supervisorId, traineeEmail, row.sourceMonth, row.sourceRow, row.format].join("|");
  return `suphrs_${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

function fingerprint(date: string, duration: number, format: string) {
  return `${date}|${Number(duration).toFixed(3)}|${format}`;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    const supervisorId = String(form.get("supervisorId") || "").trim();
    const commit = form.get("commit") === "true";
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || !supervisorId) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });

    const supervisorSnap = await adminDb.collection("supervisors").doc(supervisorId).get();
    if (!supervisorSnap.exists) return NextResponse.json({ error: "SUPERVISOR_NOT_FOUND" }, { status: 404 });
    const supervisor = supervisorSnap.data() || {};

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
    const master = workbook.getWorksheet("لوحة المعلومات الرئيسية");
    if (!master) return NextResponse.json({ error: "UNSUPPORTED_SUPERVISOR_FILE" }, { status: 400 });
    const fileName = text(master.getCell("E2").value) || text(master.getCell("F2").value);
    const fileEmail = email(master.getCell("E3").value) || email(master.getCell("F3").value);
    if (!fileEmail || fileEmail !== String(supervisor.email || "").trim().toLowerCase()) {
      return NextResponse.json({
        error: "SUPERVISOR_FILE_MISMATCH",
        expected: { name: supervisor.name, email: supervisor.email },
        found: { name: fileName, email: fileEmail },
      }, { status: 409 });
    }

    const ignored = new Set(["تعليمات الاستخدام", "لوحة المعلومات الرئيسية", "اسم المتدرب | للنسخ"]);
    const parsed = workbook.worksheets
      .filter((sheet) => !ignored.has(sheet.name))
      .map((sheet) => ({
        sheet: sheet.name,
        name: text(sheet.getCell(3, 11).value),
        email: email(sheet.getCell(4, 11).value),
        license: text(sheet.getCell(5, 11).value),
        hours: parseHours(sheet),
      }))
      .filter((item) => item.name && item.email.includes("@"));

    const traineeSnapshots = await adminDb.collection("trainees").where("currentSupervisorId", "==", supervisorId).get();
    const assignedByEmail = new Map(traineeSnapshots.docs.map((doc) => [String(doc.data().email || "").trim().toLowerCase(), doc]));
    const matched = parsed.filter((item) => assignedByEmail.has(item.email));
    const unmatched = parsed.filter((item) => !assignedByEmail.has(item.email));
    const preview = {
      supervisor: { id: supervisorId, name: supervisor.name, email: supervisor.email, publicProfileId: supervisor.publicProfileId || null },
      sourceFile: file.name,
      matched: matched.map((item) => ({ name: item.name, email: item.email, license: item.license, records: item.hours.length, hours: item.hours.reduce((sum, row) => sum + row.duration, 0) })),
      unmatched: unmatched.map((item) => ({ name: item.name, email: item.email, reason: "NOT_ASSIGNED_TO_SUPERVISOR" })),
    };
    if (!commit) return NextResponse.json({ ok: true, preview });
    if (!matched.length) return NextResponse.json({ error: "NO_MATCHED_TRAINEES", preview }, { status: 409 });

    const now = new Date().toISOString();
    const results: Array<Record<string, unknown>> = [];
    for (const item of matched) {
      const traineeDoc = assignedByEmail.get(item.email)!;
      const existingSnap = await adminDb.collection("fieldworkActivities")
        .where("traineeId", "==", traineeDoc.id)
        .where("supervisorId", "==", supervisorId)
        .get();
      const existingFingerprints = new Set(existingSnap.docs
        .map((doc) => doc.data())
        .filter((row) => String(row.activityType || "").startsWith("supervision_"))
        .map((row) => fingerprint(String(row.date || "").slice(0, 10), Number(row.duration || 0), String(row.format || "individual"))));
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      for (let offset = 0; offset < item.hours.length; offset += 400) {
        const batch = adminDb.batch();
        const chunk = item.hours.slice(offset, offset + 400);
        const refs = chunk.map((row) => adminDb.collection("fieldworkActivities").doc(sourceId(supervisorId, item.email, row)));
        const managed = await adminDb.getAll(...refs);
        chunk.forEach((row, index) => {
          const fp = fingerprint(row.date, row.duration, row.format);
          const ref = refs[index];
          if (!managed[index].exists && existingFingerprints.has(fp)) {
            unchanged += 1;
            return;
          }
          const payload = {
            traineeId: traineeDoc.id,
            supervisorId,
            date: row.date,
            month: row.date.slice(0, 7),
            duration: row.duration,
            activityType: "supervision_indirect",
            setting: "video",
            format: row.format,
            observedWithClient: false,
            description: "جلسة إشراف موثقة في ملف المشرف المعتمد",
            evidenceNote: `مستورد من ملف المشرف: ${file.name}`,
            status: "approved",
            reviewerNote: "اعتماد إداري من تحديث ملف المشرف",
            reviewedAt: now,
            reviewedBy: admin.email || "admin",
            updatedAt: now,
            supervisorHoursImport: { version: 1, sourceFile: file.name, sourceSheet: item.sheet, sourceMonth: row.sourceMonth, sourceRow: row.sourceRow },
          };
          if (managed[index].exists) {
            batch.set(ref, payload, { merge: true });
            updated += 1;
          } else {
            batch.create(ref, { ...payload, createdAt: now });
            created += 1;
          }
          existingFingerprints.add(fp);
        });
        await batch.commit();
      }
      const totals = await syncTraineeFieldworkTotals(traineeDoc.id);
      await traineeDoc.ref.set({
        totalIndividualHours: Math.max(0, totals.approvedSupervisionHours - totals.approvedGroupSupervisionHours),
        totalGroupHours: totals.approvedGroupSupervisionHours,
        updatedAt: now,
      }, { merge: true });
      results.push({ traineeId: traineeDoc.id, name: item.name, created, updated, unchanged, totals });
    }

    await adminDb.collection("activityLogs").add({
      type: "supervisor_hours_import",
      message: `تم تحديث ساعات المشرف ${supervisor.name}`,
      supervisorId,
      createdAt: FieldValue.serverTimestamp(),
      meta: { sourceFile: file.name, matched: matched.length, unmatched: unmatched.length, results },
    });
    return NextResponse.json({ ok: true, committed: true, preview, results });
  } catch (error) {
    console.error("Supervisor hours import failed", error);
    return NextResponse.json({ error: "SUPERVISOR_HOURS_IMPORT_FAILED" }, { status: 400 });
  }
}
