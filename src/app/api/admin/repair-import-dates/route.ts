import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { syncTraineeFieldworkTotals } from "@/lib/fieldwork/syncTotals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const body = await request.json();
    const supervisorId = String(body.supervisorId || "");
    const fromYear = Number(body.fromYear);
    const toYear = Number(body.toYear);
    if (!supervisorId || fromYear !== 2028 || toYear !== 2025) {
      return NextResponse.json({ error: "INVALID_REPAIR_REQUEST" }, { status: 400 });
    }

    const supervisor = await adminDb.collection("supervisors").doc(supervisorId).get();
    if (!supervisor.exists) return NextResponse.json({ error: "SUPERVISOR_NOT_FOUND" }, { status: 404 });

    const snapshot = await adminDb.collection("fieldworkActivities")
      .where("supervisorId", "==", supervisorId)
      .get();
    const targets = snapshot.docs.filter((doc) => {
      const row = doc.data();
      return String(row.date || "").startsWith("2028-")
        && (row.supervisorHoursImport?.version === 1 || row.legacyImport?.version === 1);
    });
    if (!targets.length) return NextResponse.json({ ok: true, repaired: 0, traineeIds: [] });

    const repairedAt = new Date().toISOString();
    for (let offset = 0; offset < targets.length; offset += 400) {
      const batch = adminDb.batch();
      targets.slice(offset, offset + 400).forEach((doc) => {
        const row = doc.data();
        const correctedDate = String(row.date).replace(/^2028-/, "2025-");
        batch.update(doc.ref, {
          date: correctedDate,
          month: correctedDate.slice(0, 7),
          updatedAt: repairedAt,
          importDateRepair: {
            fromYear,
            toYear,
            originalDate: row.date,
            repairedAt,
            repairedBy: admin.email || "admin",
          },
        });
      });
      await batch.commit();
    }

    const traineeIds = Array.from(new Set(targets.map((doc) => String(doc.data().traineeId || "")).filter(Boolean)));
    await Promise.all(traineeIds.map((id) => syncTraineeFieldworkTotals(id)));
    await adminDb.collection("activityLogs").add({
      type: "repair_import_dates",
      message: `تم تصحيح ${targets.length} سجل مستورد من 2028 إلى 2025 للمشرف ${supervisor.data()?.name || supervisorId}`,
      supervisorId,
      createdAt: FieldValue.serverTimestamp(),
      meta: { fromYear, toYear, repaired: targets.length, traineeIds },
    });
    return NextResponse.json({ ok: true, repaired: targets.length, traineeIds });
  } catch (error) {
    console.error("Import date repair failed", error);
    return NextResponse.json({ error: "IMPORT_DATE_REPAIR_FAILED" }, { status: 400 });
  }
}
