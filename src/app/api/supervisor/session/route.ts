import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activityLog";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    traineeIds,
    type,
    date,
    duration,
    absenceReason,
    warningReason,
    scheduledTime,
    noticeGivenAt,
    billingStatus,
    notes,
  } = await req.json();

  if (!traineeIds || !type || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (
    !Array.isArray(traineeIds) ||
    traineeIds.length === 0 ||
    traineeIds.length > 50
  ) {
    return NextResponse.json({ error: "Invalid trainees" }, { status: 400 });
  }
  if (!["individual", "group", "absence", "warning"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid session type" },
      { status: 400 },
    );
  }

  const uniqueTraineeIds = [
    ...new Set(
      traineeIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];
  if (uniqueTraineeIds.length !== traineeIds.length) {
    return NextResponse.json({ error: "Invalid trainees" }, { status: 400 });
  }
  const traineeDocs = await Promise.all(
    uniqueTraineeIds.map((id) => adminDb.collection("trainees").doc(id).get()),
  );
  if (
    traineeDocs.some(
      (doc) => !doc.exists || doc.data()?.currentSupervisorId !== supervisor.id,
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = date.slice(0, 7);
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (month !== currentMonth) {
    return NextResponse.json(
      { error: "لا يمكن تسجيل جلسة لشهر مختلف عن الشهر الحالي" },
      { status: 400 },
    );
  }

  if (type === "group" && traineeIds.length < 2) {
    return NextResponse.json(
      { error: "الجلسة الجماعية تتطلب متدربَين على الأقل" },
      { status: 400 },
    );
  }

  const batch = adminDb.batch();
  const now = new Date().toISOString();
  let absenceSequence: number | null = null;
  if (type === "absence") {
    const attendanceSnapshot = await adminDb
      .collection("monthlySnapshots")
      .doc(`${supervisor.id}_${uniqueTraineeIds[0]}_${month}`)
      .get();
    absenceSequence = Number(attendanceSnapshot.data()?.absenceCount || 0) + 1;
  }
  const scheduledDateTime = scheduledTime
    ? new Date(`${date}T${scheduledTime}:00`)
    : null;
  const noticeDateTime = noticeGivenAt ? new Date(noticeGivenAt) : null;
  const noticeHours =
    scheduledDateTime &&
    noticeDateTime &&
    Number.isFinite(scheduledDateTime.getTime()) &&
    Number.isFinite(noticeDateTime.getTime())
      ? Math.round(
          ((scheduledDateTime.getTime() - noticeDateTime.getTime()) / 3600000) *
            10,
        ) / 10
      : null;
  let absenceEscalation: {
    traineeId: string;
    count: number;
    traineeName: string;
  } | null = null;

  // إضافة الجلسة
  const sessionRef = adminDb.collection("sessions").doc();
  batch.set(sessionRef, {
    supervisorId: supervisor.id,
    traineeIds: uniqueTraineeIds,
    type,
    date,
    month,
    duration: duration || null,
    absenceReason: absenceReason || null,
    warningReason: warningReason || null,
    scheduledTime: scheduledTime || null,
    noticeGivenAt: noticeGivenAt || null,
    noticeHours,
    timelyNotice: noticeHours !== null ? noticeHours >= 6 : false,
    absenceSequence,
    recommendedAction:
      absenceSequence === null
        ? null
        : absenceSequence >= 3
          ? "admin_review"
          : absenceSequence === 2
            ? "billable_warning"
            : "warning",
    billingStatus:
      type === "absence" &&
      ["pending", "not_billable", "billable"].includes(billingStatus)
        ? billingStatus
        : type === "absence"
          ? "pending"
          : null,
    notes: notes || "",
    createdAt: now,
    createdBy: supervisor.id,
  });

  // تحديث snapshots والإجماليات
  if (type === "individual" || type === "group") {
    const dur = duration || 1;

    for (const traineeId of uniqueTraineeIds) {
      const snapshotId = `${supervisor.id}_${traineeId}_${month}`;
      const snapshotRef = adminDb
        .collection("monthlySnapshots")
        .doc(snapshotId);
      const snapshotSnap = await snapshotRef.get();

      if (snapshotSnap.exists) {
        const current = snapshotSnap.data() as any;
        const newInd =
          type === "individual"
            ? (current.individualHours || 0) + dur
            : current.individualHours || 0;
        const newGrp =
          type === "group"
            ? (current.groupHours || 0) + dur
            : current.groupHours || 0;
        const newTotal = newInd + newGrp;
        batch.update(snapshotRef, {
          individualHours: newInd,
          groupHours: newGrp,
          totalHours: newTotal,
          groupPercentage:
            newTotal > 0 ? Math.round((newGrp / newTotal) * 1000) / 10 : 0,
          updatedAt: now,
        });
      } else {
        const newInd = type === "individual" ? dur : 0;
        const newGrp = type === "group" ? dur : 0;
        const newTotal = newInd + newGrp;
        batch.set(snapshotRef, {
          supervisorId: supervisor.id,
          traineeId,
          month,
          workHours: 0,
          requiredHours: 0,
          individualHours: newInd,
          groupHours: newGrp,
          totalHours: newTotal,
          groupPercentage:
            newTotal > 0 ? Math.round((newGrp / newTotal) * 1000) / 10 : 0,
          absenceCount: 0,
          warningCount: 0,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        });
      }

      // تحديث إجمالي المتدرب
      const traineeRef = adminDb.collection("trainees").doc(traineeId);
      const traineeSnap = await traineeRef.get();
      if (traineeSnap.exists) {
        const t = traineeSnap.data() as any;
        const newIndTotal =
          type === "individual"
            ? (t.totalIndividualHours || 0) + dur
            : t.totalIndividualHours || 0;
        const newGrpTotal =
          type === "group"
            ? (t.totalGroupHours || 0) + dur
            : t.totalGroupHours || 0;
        batch.update(traineeRef, {
          totalIndividualHours: newIndTotal,
          totalGroupHours: newGrpTotal,
          totalSupervisionSessionHours: newIndTotal + newGrpTotal,
          updatedAt: now,
        });
      }
    }
  }

  // تحديث عداد الغياب/الإنذار
  if (type === "absence" || type === "warning") {
    const traineeId = uniqueTraineeIds[0];
    const snapshotId = `${supervisor.id}_${traineeId}_${month}`;
    const snapshotRef = adminDb.collection("monthlySnapshots").doc(snapshotId);
    const snapshotSnap = await snapshotRef.get();
    const field = type === "absence" ? "absenceCount" : "warningCount";

    if (snapshotSnap.exists) {
      const current = snapshotSnap.data() as any;
      const nextCount = (current[field] || 0) + 1;
      batch.update(snapshotRef, { [field]: nextCount, updatedAt: now });
      if (type === "absence" && nextCount === 3)
        absenceEscalation = {
          traineeId,
          count: nextCount,
          traineeName: String(traineeDocs[0].data()?.name || traineeId),
        };
    } else {
      batch.set(snapshotRef, {
        supervisorId: supervisor.id,
        traineeId,
        month,
        workHours: 0,
        requiredHours: 0,
        individualHours: 0,
        groupHours: 0,
        totalHours: 0,
        groupPercentage: 0,
        absenceCount: type === "absence" ? 1 : 0,
        warningCount: type === "warning" ? 1 : 0,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      });
    }
  }

  await batch.commit();
  if (absenceEscalation) {
    await adminDb.collection("notifications").add({
      type: "warning",
      title: "تكرار غياب متدرب",
      message: `وصل ${absenceEscalation.traineeName} إلى 3 غيابات خلال ${month}. يرجى مراجعة ملفه والإجراء المناسب.`,
      traineeId: absenceEscalation.traineeId,
      supervisorId: supervisor.id,
      audience: "admin",
      read: false,
      createdAt: now,
    });
  }

  // تسجيل النشاط
  const sessionTypeLabel =
    type === "individual"
      ? "فردية"
      : type === "group"
        ? "جماعية"
        : type === "absence"
          ? "غياب"
          : "إنذار";
  await logActivity({
    type: "session",
    message: `سجّل ${supervisor.name} جلسة ${sessionTypeLabel}`,
    actorId: supervisor.id,
    actorName: supervisor.name,
    supervisorId: supervisor.id,
    traineeId: uniqueTraineeIds[0],
    meta: { sessionType: type, duration, date },
  });

  return NextResponse.json({ success: true, sessionId: sessionRef.id });
}

// تحديث ساعات العمل الشهرية
export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { traineeId, month, workHours } = await req.json();
  if (
    typeof traineeId !== "string" ||
    !/^\d{4}-\d{2}$/.test(month) ||
    typeof workHours !== "number" ||
    !Number.isFinite(workHours) ||
    workHours < 0 ||
    workHours > 1000
  ) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }
  const trainee = await adminDb.collection("trainees").doc(traineeId).get();
  if (
    !trainee.exists ||
    trainee.data()?.currentSupervisorId !== supervisor.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const snapshotId = `${supervisor.id}_${traineeId}_${month}`;
  const requiredHours = Math.round(workHours * 0.05 * 10) / 10;

  const snapshotRef = adminDb.collection("monthlySnapshots").doc(snapshotId);
  const snapshot = await snapshotRef.get();
  if (!snapshot.exists)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (snapshot.data()?.lockedAt)
    return NextResponse.json({ error: "Month locked" }, { status: 409 });

  await snapshotRef.update({
    workHours,
    requiredHours,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
