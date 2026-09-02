import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json();
  const id = String(body.id || ""),
    decision = String(body.decision || ""),
    adminNote = String(body.adminNote || "")
      .trim()
      .slice(0, 1000),
    newSupervisorId = String(body.newSupervisorId || "");
  if (!id || !["approved", "rejected"].includes(decision))
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const ref = adminDb.collection("traineeRequests").doc(id),
    snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.status !== "pending")
    return NextResponse.json({ error: "NOT_PENDING" }, { status: 409 });
  const data = snapshot.data()!;
  if (
    decision === "approved" &&
    data.type === "change_supervisor" &&
    !newSupervisorId
  )
    return NextResponse.json({ error: "SUPERVISOR_REQUIRED" }, { status: 400 });
  const now = new Date().toISOString(),
    batch = adminDb.batch();
  batch.update(ref, {
    status: decision,
    adminNote,
    reviewedAt: now,
    reviewedBy: admin.uid,
    updatedAt: now,
  });
  const traineeRef = adminDb.collection("trainees").doc(data.traineeId);
  if (decision === "approved" && data.type === "defer")
    batch.update(traineeRef, {
      status: "paused",
      pauseStartDate: data.startDate,
      expectedReturnDate: data.returnDate,
      updatedAt: now,
    });
  if (decision === "approved" && data.type === "withdraw")
    batch.update(traineeRef, {
      status: "withdrawn",
      withdrawnAt: now,
      updatedAt: now,
    });
  if (decision === "approved" && data.type === "termination") {
    batch.update(traineeRef, {
      status: "terminated",
      terminatedAt: now,
      terminationReason: data.reason || "",
      updatedAt: now,
    });
    batch.set(
      adminDb.collection("supervisionAgreements").doc(data.traineeId),
      {
        status: "terminated",
        terminatedAt: now,
        terminationReason: data.reason || "",
        updatedAt: now,
        updatedBy: admin.uid,
      },
      { merge: true },
    );
    const currentAssignments = await adminDb
      .collection("assignments")
      .where("traineeId", "==", data.traineeId)
      .get();
    currentAssignments.docs
      .filter((doc) => !doc.data().endDate)
      .forEach((doc) =>
        batch.update(doc.ref, {
          endDate: (data.requestedEndDate || now).slice(0, 10),
          notes: "إنهاء بعد موافقة الإدارة",
        }),
      );
  }
  if (decision === "approved" && data.type === "change_supervisor") {
    const [supervisor, trainee, activitySnap] = await Promise.all([
      adminDb.collection("supervisors").doc(newSupervisorId).get(),
      traineeRef.get(),
      adminDb
        .collection("fieldworkActivities")
        .where("traineeId", "==", data.traineeId)
        .limit(1000)
        .get(),
    ]);
    if (!supervisor.exists || supervisor.data()?.isActive === false)
      return NextResponse.json(
        { error: "INVALID_SUPERVISOR" },
        { status: 400 },
      );
    const previousSupervisorId =
      trainee.data()?.currentSupervisorId || data.supervisorId || "";
    const hoursAtTransfer = activitySnap.docs
      .map((doc) => doc.data())
      .filter(
        (activity) =>
          activity.supervisorId === previousSupervisorId &&
          activity.status === "approved" &&
          String(activity.activityType || "").startsWith("supervision_"),
      )
      .reduce((total, activity) => total + Number(activity.duration || 0), 0);
    batch.update(traineeRef, {
      currentSupervisorId: newSupervisorId,
      status: "active",
      lifecycleStage: "active_service",
      lifecycleStageChangedAt: now,
      serviceAccessEnabled: true,
      updatedAt: now,
    });
    const assignments = await adminDb
      .collection("assignments")
      .where("traineeId", "==", data.traineeId)
      .get();
    assignments.docs
      .filter((doc) => !doc.data().endDate)
      .forEach((doc) =>
        batch.update(doc.ref, {
          endDate: now.slice(0, 10),
          hoursAtTransfer: Math.round(hoursAtTransfer * 100) / 100,
          notes: "نقل بموافقة الإدارة",
        }),
      );
    batch.set(adminDb.collection("assignments").doc(), {
      traineeId: data.traineeId,
      supervisorId: newSupervisorId,
      startDate: now.slice(0, 10),
      notes: "نقل بعد موافقة طلب تغيير المشرف",
      carriedSupervisionHours: Math.round(hoursAtTransfer * 100) / 100,
      createdAt: now,
      createdBy: admin.uid,
    });
    batch.set(
      adminDb.collection("supervisionAgreements").doc(data.traineeId),
      {
        currentSupervisorId: newSupervisorId,
        carriedSupervisionHours: Math.round(hoursAtTransfer * 100) / 100,
        updatedAt: now,
        updatedBy: admin.uid,
      },
      { merge: true },
    );
    batch.update(ref, { previousSupervisorId, newSupervisorId });
  }
  batch.set(adminDb.collection("traineeStatusHistory").doc(), {
    traineeId: data.traineeId,
    requestId: id,
    action: decision,
    requestType: data.type,
    adminNote,
    newSupervisorId: newSupervisorId || null,
    actorId: admin.uid,
    createdAt: now,
  });
  await batch.commit();
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json(),
    traineeId = String(body.traineeId || "");
  if (!traineeId || body.action !== "resume")
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const ref = adminDb.collection("trainees").doc(traineeId),
    trainee = await ref.get();
  if (!trainee.exists || trainee.data()?.status !== "paused")
    return NextResponse.json({ error: "NOT_PAUSED" }, { status: 409 });
  const now = new Date().toISOString(),
    batch = adminDb.batch();
  batch.update(ref, {
    status: "active",
    lifecycleStage: "active_service",
    lifecycleStageChangedAt: now,
    serviceAccessEnabled: true,
    pauseStartDate: null,
    expectedReturnDate: null,
    resumedAt: now,
    updatedAt: now,
  });
  batch.set(adminDb.collection("traineeStatusHistory").doc(), {
    traineeId,
    action: "resumed",
    actorId: admin.uid,
    createdAt: now,
  });
  await batch.commit();
  return NextResponse.json({ success: true });
}
