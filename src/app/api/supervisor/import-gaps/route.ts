export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";
import { priorSafeImportBatch } from "@/lib/imports/priorSafeBatch";
import { syncTraineeFieldworkTotals } from "@/lib/fieldwork/syncTotals";

/**
 * Sessions from the supervisor's workbook that the admin imported without a
 * usable date. The supervisor gives the date (the session then counts, as the
 * rest of the workbook did) or says it should not count, with a reason.
 */
export async function POST(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const gapId = typeof body.gapId === "string" && /^gap_[a-f0-9]{32}$/.test(body.gapId) ? body.gapId : "";
  const action = body.action;
  if (!gapId || !["fill", "dismiss"].includes(action)) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });

  const ref = adminDb.collection("importGaps").doc(gapId);
  const gap = await ref.get();
  const data = gap.data();
  if (!gap.exists || !data || data.supervisorId !== supervisor.id) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (data.status !== "open") return NextResponse.json({ error: "ALREADY_DONE" }, { status: 409 });
  const now = new Date().toISOString();

  if (action === "dismiss") {
    const note = String(body.note || "").trim().slice(0, 500);
    if (note.length < 5) return NextResponse.json({ error: "NOTE_REQUIRED" }, { status: 400 });
    await ref.update({ status: "dismissed", note, resolvedAt: now, resolvedBy: supervisor.id });
    return NextResponse.json({ ok: true });
  }

  const date = String(body.date || "");
  const today = now.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today || date < "2015-01-01")
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  const approval = await adminDb.collection("monthlyApprovals").doc(`${data.traineeId}_${date.slice(0, 7)}`).get();
  if (approval.data()?.locked) return NextResponse.json({ error: "MONTH_LOCKED" }, { status: 409 });

  const batch = priorSafeImportBatch(data.traineeId, { protectLockedMonths: true });
  const rows = ([["individual", Number(data.individual || 0)], ["group", Number(data.group || 0)]] as const).filter(([, hours]) => hours > 0);
  for (const [format, duration] of rows) {
    batch.create(adminDb.collection("fieldworkActivities").doc(`${gapId}_${format}`), {
      traineeId: data.traineeId,
      supervisorId: supervisor.id,
      date,
      month: date.slice(0, 7),
      duration,
      activityType: "supervision_indirect",
      setting: "video",
      format,
      observedWithClient: false,
      description: "جلسة إشراف موثقة في ملف المشرف المعتمد",
      evidenceNote: `مستورد من ملف المشرف: ${data.sourceFile} (أكمل المشرف التاريخ)`,
      status: "approved",
      reviewerNote: "أكمل المشرف تاريخ الجلسة بعد الاستيراد",
      reviewedAt: now,
      reviewedBy: supervisor.email || supervisor.id,
      createdAt: now,
      updatedAt: now,
      importGap: { id: gapId, sourceFile: data.sourceFile, sheet: data.sheet, cell: data.cell, raw: data.raw || "" },
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "IMPORT_MONTH_LOCKED") return NextResponse.json({ error: "MONTH_LOCKED" }, { status: 409 });
    if (code === "PRIOR_SUPERVISION_RECONCILIATION_REQUIRED") return NextResponse.json({ error: "PROTECTED_MONTH" }, { status: 409 });
    throw error;
  }
  await ref.update({ status: "filled", date, resolvedAt: now, resolvedBy: supervisor.id });
  await syncTraineeFieldworkTotals(data.traineeId);
  return NextResponse.json({ ok: true });
}
