export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { needsAcknowledgment } from "@/lib/supervision/sessionAcknowledgment";
import type { FieldworkActivity } from "@/types";

const MAX = 100;

/**
 * The administration confirms supervisor-logged sessions on the trainee's
 * behalf, so a trainee who has not answered, or a dispute the administration
 * has checked, does not hold up the supervisor's monthly approval or pay.
 * Hours are not changed; a resolved dispute is kept on the row.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.activityIds) ? [...new Set<string>(body.activityIds.filter((id: unknown) => typeof id === "string" && id && !id.includes("/")))] : [];
  if (!ids.length || ids.length > MAX) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });

  const now = new Date().toISOString();
  const by = admin.email || "admin";
  const confirmed: FieldworkActivity[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const ref = adminDb.collection("fieldworkActivities").doc(id);
    try {
      const row = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? ({ id: snap.id, ...snap.data() } as FieldworkActivity) : null;
        if (!data) throw new Error("NOT_FOUND");
        if (!needsAcknowledgment(data)) throw new Error("NOT_ACKNOWLEDGEABLE");
        if (data.traineeAcknowledgment?.status === "confirmed") throw new Error("ALREADY_CONFIRMED");
        const approval = await tx.get(adminDb.collection("monthlyApprovals").doc(`${data.traineeId}_${data.month}`));
        if (approval.data()?.locked) throw new Error("MONTH_LOCKED");
        const previous = data.traineeAcknowledgment;
        const traineeAcknowledgment = {
          status: "confirmed", at: now, note: null, via: "admin", by,
          resolvedDispute: previous?.status === "disputed" ? { note: previous.note || null, at: previous.at } : null,
        };
        tx.update(ref, { traineeAcknowledgment, updatedAt: now });
        return { ...data, traineeAcknowledgment, _wasDisputed: previous?.status === "disputed" } as FieldworkActivity & { _wasDisputed: boolean };
      });
      confirmed.push(row);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "FAILED";
      if (!["NOT_FOUND", "NOT_ACKNOWLEDGEABLE", "ALREADY_CONFIRMED", "MONTH_LOCKED"].includes(reason)) throw error;
      skipped.push({ id, reason });
    }
  }

  const writes: Promise<unknown>[] = [];
  for (const row of confirmed as (FieldworkActivity & { _wasDisputed?: boolean })[]) {
    const label = `${row.date} · ${row.duration} ساعة · ${row.format === "group" ? "جماعية" : "فردية"}`;
    writes.push(adminDb.collection("activityLog").add({
      type: "session_acknowledged_by_admin", traineeId: row.traineeId, supervisorId: row.supervisorId, activityId: row.id,
      message: row._wasDisputed ? `اعتمدت الإدارة جلسة إشراف بعد مراجعة اعتراض المتدرب (${label})` : `اعتمدت الإدارة جلسة إشراف نيابة عن المتدرب (${label})`,
      by, createdAt: now,
    }));
    if (row._wasDisputed) {
      writes.push(
        adminDb.collection("notifications").add({
          targetType: "supervisor", supervisorId: row.supervisorId, traineeId: row.traineeId, read: false,
          type: "session_dispute_resolved", title: "حُسم اعتراض على جلسة",
          message: `راجعت الإدارة الاعتراض على جلسة ${label} واعتمدتها.`, createdAt: now,
        }),
        adminDb.collection("notifications").add({
          targetType: "trainee", targetId: row.traineeId, traineeId: row.traineeId, read: false,
          type: "session_dispute_resolved", title: "حُسم اعتراضك على جلسة إشراف",
          message: `راجعت الإدارة اعتراضك على جلسة ${label} واعتمدتها. تواصل مع الإدارة إن كان لديك استفسار.`, createdAt: now,
        }),
      );
    }
  }
  await Promise.all(writes);
  return NextResponse.json({ success: true, confirmed: confirmed.map((row) => row.id), skipped });
}
