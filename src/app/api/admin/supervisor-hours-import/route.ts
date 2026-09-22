import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { syncTraineeFieldworkTotals } from "@/lib/fieldwork/syncTotals";
import { normalizeIdentityEmail, normalizeIdentityPhone } from "@/lib/identity/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportedHour = {
  sourceMonth: number;
  sourceRow: number;
  date: string;
  duration: number;
  format: "individual" | "group";
};

type ParsedTrainee = {
  sheet: string;
  name: string;
  email: string;
  phone: string;
  license: "QASP-S" | "QBA";
  hours: ImportedHour[];
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

const email = (value: ExcelJS.CellValue | unknown) => normalizeIdentityEmail(text(value as ExcelJS.CellValue));

function sheetPhone(sheet: ExcelJS.Worksheet) {
  for (let row = 1; row <= Math.min(sheet.rowCount, 15); row += 1) {
    for (let column = 1; column <= Math.min(sheet.columnCount, 20); column += 1) {
      const label = text(sheet.getCell(row, column).value).replace(/\s/g, "");
      if (!/(رقم)?(الجوال|الهاتف|الموبايل)/.test(label)) continue;
      for (let candidate = column + 1; candidate <= Math.min(column + 3, sheet.columnCount); candidate += 1) {
        const phone = normalizeIdentityPhone(text(sheet.getCell(row, candidate).value));
        if (phone) return phone;
      }
    }
  }
  return normalizeIdentityPhone(text(sheet.getCell(6, 11).value));
}

function normalizeLicense(value: ExcelJS.CellValue): "QASP-S" | "QBA" {
  return text(value).toUpperCase().includes("QASP") ? "QASP-S" : "QBA";
}

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
  if (raw instanceof Date) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 16 ? parsed : 0;
}

function parseHours(sheet: ExcelJS.Worksheet) {
  const rows: ImportedHour[] = [];
  for (const blockRow of [20, 33, 46, 59, 72]) {
    const starts: Array<{ month: number; column: number }> = [];
    sheet.getRow(blockRow).eachCell({ includeEmpty: false }, (cell, column) => {
      if (cell.isMerged && cell.master.address !== cell.address) return;
      const month = Number(text(cell.value));
      if (Number.isInteger(month) && month >= 1 && month <= 20) starts.push({ month, column });
    });
    starts.sort((a, b) => a.column - b.column);
    for (let index = 0; index < starts.length; index += 1) {
      const start = starts[index];
      const endColumn = (starts[index + 1]?.column || sheet.columnCount + 1) - 1;
      let individualColumn = 0;
      let groupColumn = 0;
      for (let column = start.column; column <= endColumn; column += 1) {
        const cell = sheet.getCell(blockRow + 2, column);
        if (cell.isMerged && cell.master.address !== cell.address) continue;
        const label = text(cell.value).replace(/\s/g, "");
        if (label.includes("فردي")) individualColumn = column;
        if (label.includes("جماعي")) groupColumn = column;
      }
      for (let offset = 0; offset < 7; offset += 1) {
        const row = blockRow + 3 + offset;
        const date = isoDate(sheet.getCell(row, start.column).value);
        if (!date) continue;
        const individual = individualColumn ? number(sheet.getCell(row, individualColumn).value) : 0;
        const group = groupColumn ? number(sheet.getCell(row, groupColumn).value) : 0;
        if (individual) rows.push({ sourceMonth: start.month, sourceRow: row, date, duration: individual, format: "individual" });
        if (group) rows.push({ sourceMonth: start.month, sourceRow: row, date, duration: group, format: "group" });
      }
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

function identityKey(kind: "email" | "phone", value: string) {
  return `${kind}_${createHash("sha256").update(value).digest("hex")}`;
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
    const parsed: ParsedTrainee[] = workbook.worksheets
      .filter((sheet) => !ignored.has(sheet.name))
      .map((sheet) => ({
        sheet: sheet.name,
        name: text(sheet.getCell(3, 11).value),
        email: email(sheet.getCell(4, 11).value),
        phone: sheetPhone(sheet),
        license: normalizeLicense(sheet.getCell(5, 11).value),
        hours: parseHours(sheet),
      }))
      .filter((item) => item.name && item.email.includes("@"));

    const traineeSnapshots = await adminDb.collection("trainees").get();
    const traineesByEmail = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    const traineesByPhone = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    const existingEmailCounts = new Map<string, number>();
    traineeSnapshots.docs.forEach((doc) => {
      const data = doc.data();
      const traineeEmail = email(data.email);
      const traineePhone = normalizeIdentityPhone(data.phone);
      if (traineeEmail) {
        traineesByEmail.set(traineeEmail, doc);
        existingEmailCounts.set(
          traineeEmail,
          (existingEmailCounts.get(traineeEmail) || 0) + 1,
        );
      }
      if (traineePhone) traineesByPhone.set(traineePhone, doc);
    });
    const fileEmailCounts = new Map<string, number>();
    const filePhoneCounts = new Map<string, number>();
    parsed.forEach((item) => {
      fileEmailCounts.set(item.email, (fileEmailCounts.get(item.email) || 0) + 1);
      if (item.phone) filePhoneCounts.set(item.phone, (filePhoneCounts.get(item.phone) || 0) + 1);
    });
    const conflicts: Array<Record<string, unknown>> = [];
    const matched: ParsedTrainee[] = [];
    const pendingCreation: ParsedTrainee[] = [];
    for (const item of parsed) {
      const existingByEmail = traineesByEmail.get(item.email);
      const existingByPhone = item.phone ? traineesByPhone.get(item.phone) : undefined;
      let reason = "";
      if ((fileEmailCounts.get(item.email) || 0) > 1) reason = "DUPLICATE_EMAIL_IN_FILE";
      else if ((existingEmailCounts.get(item.email) || 0) > 1) reason = "DUPLICATE_EMAIL_IN_SYSTEM";
      else if (item.phone && (filePhoneCounts.get(item.phone) || 0) > 1) reason = "DUPLICATE_PHONE_IN_FILE";
      else if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id)
        reason = "IDENTITY_CONFLICT";
      else if (existingByPhone && email(existingByPhone.data()?.email) !== item.email)
        reason = "PHONE_ALREADY_USED";
      else if (existingByEmail && existingByEmail.data()?.currentSupervisorId !== supervisorId)
        reason = "ASSIGNED_TO_ANOTHER_SUPERVISOR";
      if (reason) conflicts.push({ name: item.name, email: item.email, phone: item.phone, reason });
      else if (existingByEmail) matched.push(item);
      else pendingCreation.push(item);
    }
    const assignedByEmail = new Map(
      matched.map((item) => [item.email, traineesByEmail.get(item.email)!]),
    );
    const preview = {
      supervisor: { id: supervisorId, name: supervisor.name, email: supervisor.email, publicProfileId: supervisor.publicProfileId || null },
      sourceFile: file.name,
      matched: matched.map((item) => ({ name: item.name, email: item.email, phone: item.phone, license: item.license, records: item.hours.length, hours: item.hours.reduce((sum, row) => sum + row.duration, 0) })),
      pendingCreation: pendingCreation.map((item) => ({ name: item.name, email: item.email, phone: item.phone, license: item.license, records: item.hours.length, hours: item.hours.reduce((sum, row) => sum + row.duration, 0) })),
      conflicts,
    };
    if (!commit) return NextResponse.json({ ok: true, preview });
    if (conflicts.length) return NextResponse.json({ error: "TRAINEE_IDENTITY_CONFLICTS", preview }, { status: 409 });
    if (!matched.length && !pendingCreation.length)
      return NextResponse.json({ error: "NO_TRAINEES_FOUND", preview }, { status: 409 });

    const now = new Date().toISOString();
    const createdAccounts: Array<Record<string, unknown>> = [];
    for (const item of pendingCreation) {
      try {
        await adminAuth.getUserByEmail(item.email);
        return NextResponse.json(
          { error: "AUTH_EMAIL_ALREADY_USED", email: item.email, preview },
          { status: 409 },
        );
      } catch (lookupError: any) {
        if (lookupError?.code !== "auth/user-not-found") throw lookupError;
      }
    }
    for (const item of pendingCreation) {
      const traineeRef = adminDb.collection("trainees").doc();
      const authUser = await adminAuth.createUser({
        email: item.email,
        displayName: item.name,
        emailVerified: false,
      });
      try {
        await adminAuth.setCustomUserClaims(authUser.uid, {
          role: "trainee",
          traineeId: traineeRef.id,
        });
        const startDate = item.hours
          .map((row) => row.date)
          .sort()[0] || now.slice(0, 10);
        const requiredHours = item.license === "QASP-S" ? 1000 : 2000;
        const supervisionTargetHours = item.license === "QASP-S" ? 50 : 100;
        const emailKeyRef = adminDb.collection("identityKeys").doc(identityKey("email", item.email));
        const phoneKeyRef = item.phone
          ? adminDb.collection("identityKeys").doc(identityKey("phone", item.phone))
          : null;
        await adminDb.runTransaction(async (transaction) => {
          const emailKey = await transaction.get(emailKeyRef);
          const phoneKey = phoneKeyRef ? await transaction.get(phoneKeyRef) : null;
          if (emailKey.exists || phoneKey?.exists) throw new Error("IDENTITY_KEY_EXISTS");
          transaction.create(traineeRef, {
            name: item.name,
            email: item.email,
            phone: item.phone,
            license: item.license,
            requiredHours,
            fieldworkTargetHours: requiredHours,
            supervisionTargetHours,
            status: "active",
            lifecycleStage: "active_service",
            lifecycleStageChangedAt: now,
            serviceAccessEnabled: true,
            onboardingStage: null,
            currentSupervisorId: supervisorId,
            assignmentStatus: "active",
            authUid: authUser.uid,
            accountStatus: "prepared",
            fieldworkStartDate: startDate,
            courseworkStartDate: startDate,
            totalIndividualHours: 0,
            totalGroupHours: 0,
            totalHours: 0,
            createdAt: now,
            updatedAt: now,
            supervisorHoursImport: { version: 1, sourceFile: file.name, importedAt: now },
          });
          transaction.create(emailKeyRef, { kind: "email", value: item.email, traineeId: traineeRef.id, createdAt: now });
          if (phoneKeyRef) {
            transaction.create(phoneKeyRef, { kind: "phone", value: item.phone, traineeId: traineeRef.id, createdAt: now });
          }
          transaction.set(adminDb.collection("assignments").doc(`supervisor_hours_${traineeRef.id}_${supervisorId}`), {
            traineeId: traineeRef.id,
            supervisorId,
            startDate,
            notes: "إنشاء تلقائي من ملف ساعات المشرف",
            createdAt: now,
            createdBy: admin.email || "admin",
            adminOverride: true,
            status: "active",
          });
        });
      } catch (creationError) {
        await adminAuth.deleteUser(authUser.uid).catch(() => undefined);
        throw creationError;
      }
      assignedByEmail.set(item.email, await traineeRef.get());
      matched.push(item);
      createdAccounts.push({ traineeId: traineeRef.id, name: item.name, email: item.email, phone: item.phone });
    }
    const results: Array<Record<string, unknown>> = [];
    for (const item of matched) {
      const traineeDoc = assignedByEmail.get(item.email)!;
      const existingSnap = await adminDb.collection("fieldworkActivities")
        .where("traineeId", "==", traineeDoc.id)
        .where("supervisorId", "==", supervisorId)
        .get();
      // The uploaded supervisor workbook is authoritative for previously imported
      // supervision history. Replace those rows, but preserve sessions entered
      // directly through the platform.
      const priorImportedDocs = existingSnap.docs.filter((doc) => {
        const row = doc.data();
        return String(row.activityType || "").startsWith("supervision_")
          && (row.supervisorHoursImport?.version === 1 || row.legacyImport?.version === 1);
      });
      for (let offset = 0; offset < priorImportedDocs.length; offset += 400) {
        const cleanup = adminDb.batch();
        priorImportedDocs.slice(offset, offset + 400).forEach((doc) => cleanup.delete(doc.ref));
        await cleanup.commit();
      }
      const priorImportedIds = new Set(priorImportedDocs.map((doc) => doc.id));
      const manualFingerprintCounts = new Map<string, number>();
      existingSnap.docs
        .filter((doc) => !priorImportedIds.has(doc.id))
        .map((doc) => doc.data())
        .filter((row) => String(row.activityType || "").startsWith("supervision_"))
        .forEach((row) => {
          const fp = fingerprint(String(row.date || "").slice(0, 10), Number(row.duration || 0), String(row.format || "individual"));
          manualFingerprintCounts.set(fp, (manualFingerprintCounts.get(fp) || 0) + 1);
        });
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
          const matchingManualRows = manualFingerprintCounts.get(fp) || 0;
          if (!managed[index].exists && matchingManualRows > 0) {
            manualFingerprintCounts.set(fp, matchingManualRows - 1);
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
        });
        await batch.commit();
      }
      const totals = await syncTraineeFieldworkTotals(traineeDoc.id);
      await traineeDoc.ref.set({
        totalIndividualHours: Math.max(0, totals.approvedSupervisionHours - totals.approvedGroupSupervisionHours),
        totalGroupHours: totals.approvedGroupSupervisionHours,
        updatedAt: now,
      }, { merge: true });
      results.push({ traineeId: traineeDoc.id, name: item.name, created, updated, unchanged, replaced: priorImportedDocs.length, totals });
    }

    await adminDb.collection("activityLogs").add({
      type: "supervisor_hours_import",
      message: `تم تحديث ساعات المشرف ${supervisor.name}`,
      supervisorId,
      createdAt: FieldValue.serverTimestamp(),
      meta: {
        sourceFile: file.name,
        matched: matched.length,
        createdAccounts: createdAccounts.length,
        conflicts: conflicts.length,
        results,
      },
    });
    return NextResponse.json({ ok: true, committed: true, preview, createdAccounts, results });
  } catch (error) {
    console.error("Supervisor hours import failed", error);
    return NextResponse.json({ error: "SUPERVISOR_HOURS_IMPORT_FAILED" }, { status: 400 });
  }
}
