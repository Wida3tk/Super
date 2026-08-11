export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";
import { buildCompliance } from "@/lib/qaba/compliance";
import type { FieldworkActivity } from "@/types";

export async function GET(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const traineeId = req.nextUrl.searchParams.get("traineeId") || "";
  const month =
    req.nextUrl.searchParams.get("month") ||
    new Date().toISOString().slice(0, 7);
  const trainee = await adminDb.collection("trainees").doc(traineeId).get();
  if (!trainee.exists || trainee.data()?.currentSupervisorId !== supervisor.id)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const snap = await adminDb
    .collection("monthlyApprovals")
    .doc(`${traineeId}_${month}`)
    .get();
  return NextResponse.json({
    approval: snap.exists ? { id: snap.id, ...snap.data() } : null,
  });
}

export async function POST(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { traineeId, month, attestation } = await req.json();
  const traineeSnap = await adminDb
    .collection("trainees")
    .doc(String(traineeId))
    .get();
  if (
    !traineeSnap.exists ||
    traineeSnap.data()?.currentSupervisorId !== supervisor.id
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!/^\d{4}-\d{2}$/.test(String(month)) || attestation !== true)
    return NextResponse.json(
      { error: "ATTESTATION_REQUIRED" },
      { status: 400 },
    );
  const credentialExpiresAt = String(
    (supervisor as any).credentialExpiresAt || "",
  );
  if (credentialExpiresAt && credentialExpiresAt < `${month}-01`)
    return NextResponse.json(
      { error: "SUPERVISOR_CREDENTIAL_EXPIRED" },
      { status: 409 },
    );
  const activitiesSnap = await adminDb
    .collection("fieldworkActivities")
    .where("traineeId", "==", traineeId)
    .where("month", "==", month)
    .limit(500)
    .get();
  const activities = activitiesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as FieldworkActivity[];
  const trainee = traineeSnap.data() as any;
  const result = buildCompliance(
    activities,
    trainee.license || "QASP-S",
    trainee.fieldworkStartDate,
  );
  const check = result.months.find((m) => m.month === month);
  if (
    !check ||
    !check.validHoursBand ||
    !check.meetsSupervision ||
    !check.meetsGroupLimit
  )
    return NextResponse.json(
      { error: "MONTH_NOT_COMPLIANT", compliance: check || null },
      { status: 409 },
    );
  const pending = activities.filter((a) =>
    ["draft", "submitted", "revision_requested"].includes(a.status),
  );
  if (pending.length)
    return NextResponse.json(
      { error: "PENDING_ACTIVITIES", count: pending.length },
      { status: 409 },
    );
  const now = new Date().toISOString();
  await adminDb
    .collection("monthlyApprovals")
    .doc(`${traineeId}_${month}`)
    .set(
      {
        traineeId,
        supervisorId: supervisor.id,
        month,
        supervisorApprovedAt: now,
        supervisorName: supervisor.name,
        traineeAcknowledgedAt: null,
        locked: false,
        summary: {
          fieldwork: check.fieldwork,
          supervision: check.supervision,
          group: check.group,
        },
        createdAt: now,
      },
      { merge: true },
    );
  return NextResponse.json({ success: true });
}
