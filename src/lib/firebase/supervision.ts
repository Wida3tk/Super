import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "./client"; // مسار firebase config الموجود عندك
import type {
  Trainee,
  Session,
  MonthlySnapshot,
  Assignment,
  License,
  OnboardingStage,
  TraineeStatus,
  SessionType,
  AbsenceReason,
  WarningReason,
} from "../../types";

// ===========================
// helpers
// ===========================
const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // "2026-05"
const getSnapshotId = (supervisorId: string, traineeId: string, month: string) =>
  `${supervisorId}_${traineeId}_${month}`;

// ===========================
// المتدربون — Trainees
// ===========================

/** جلب كل متدربي مشرف معين */
export async function getTraineesBySupervisor(supervisorId: string): Promise<Trainee[]> {
  const q = query(
    collection(db, "trainees"),
    where("currentSupervisorId", "==", supervisorId),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trainee));
}

/** جلب كل المتدربين (للأدمن) */
export async function getAllTrainees(): Promise<Trainee[]> {
  const snap = await getDocs(collection(db, "trainees"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trainee));
}

/** جلب متدرب واحد */
export async function getTrainee(traineeId: string): Promise<Trainee | null> {
  const snap = await getDoc(doc(db, "trainees", traineeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Trainee;
}

/** إضافة متدرب جديد (بوردنق) */
export async function addTrainee(data: {
  name: string;
  email: string;
  phone: string;
  license: License;
}): Promise<string> {
  const requiredHours = data.license === "QASP-S" ? 1000 : 2000;
  const ref = await addDoc(collection(db, "trainees"), {
    ...data,
    requiredHours,
    status: "onboarding",
    onboardingStage: "initial_interview",
    currentSupervisorId: null,
    totalIndividualHours: 0,
    totalGroupHours: 0,
    totalHours: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return ref.id;
}

/** تحديث مرحلة البوردنق */
export async function updateOnboardingStage(
  traineeId: string,
  stage: OnboardingStage
): Promise<void> {
  await updateDoc(doc(db, "trainees", traineeId), {
    onboardingStage: stage,
    updatedAt: new Date().toISOString(),
  });
}

/** تحديث حالة المتدرب */
export async function updateTraineeStatus(
  traineeId: string,
  status: TraineeStatus
): Promise<void> {
  await updateDoc(doc(db, "trainees", traineeId), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

// ===========================
// الإسناد — Assignments
// ===========================

/** إسناد متدرب لمشرف */
export async function assignTrainee(data: {
  traineeId: string;
  supervisorId: string;
  startDate: string;
  notes?: string;
  adminId: string;
}): Promise<void> {
  const batch = writeBatch(db);

  // إضافة assignment جديد
  const assignRef = doc(collection(db, "assignments"));
  batch.set(assignRef, {
    traineeId: data.traineeId,
    supervisorId: data.supervisorId,
    startDate: data.startDate,
    notes: data.notes || "",
    createdAt: new Date().toISOString(),
    createdBy: data.adminId,
  });

  // تحديث المتدرب
  const traineeRef = doc(db, "trainees", data.traineeId);
  batch.update(traineeRef, {
    currentSupervisorId: data.supervisorId,
    status: "active",
    onboardingStage: null,
    updatedAt: new Date().toISOString(),
  });

  await batch.commit();
}

/** نقل متدرب لمشرف آخر */
export async function transferTrainee(data: {
  traineeId: string;
  oldSupervisorId: string;
  newSupervisorId: string;
  adminId: string;
  notes?: string;
}): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // إغلاق الإسناد القديم
  const oldAssignQ = query(
    collection(db, "assignments"),
    where("traineeId", "==", data.traineeId),
    where("supervisorId", "==", data.oldSupervisorId)
  );
  const oldAssignSnap = await getDocs(oldAssignQ);
  const traineeSnap = await getDoc(doc(db, "trainees", data.traineeId));
  const traineeData = traineeSnap.data() as Trainee;

  oldAssignSnap.docs.forEach((d) => {
    batch.update(d.ref, {
      endDate: now,
      hoursAtTransfer: traineeData.totalHours,
    });
  });

  // إضافة إسناد جديد
  const newAssignRef = doc(collection(db, "assignments"));
  batch.set(newAssignRef, {
    traineeId: data.traineeId,
    supervisorId: data.newSupervisorId,
    startDate: now,
    notes: data.notes || "",
    createdAt: now,
    createdBy: data.adminId,
  });

  // تحديث المتدرب
  batch.update(doc(db, "trainees", data.traineeId), {
    currentSupervisorId: data.newSupervisorId,
    updatedAt: now,
  });

  await batch.commit();
}

// ===========================
// الجلسات — Sessions
// ===========================

/** إضافة جلسة جديدة (فردية أو جماعية أو غياب أو إنذار) */
export async function addSession(data: {
  supervisorId: string;
  traineeIds: string[];
  type: SessionType;
  date: string;
  duration?: number;
  absenceReason?: AbsenceReason;
  warningReason?: WarningReason;
  notes?: string;
  createdBy: string;
}): Promise<void> {
  const month = data.date.slice(0, 7); // "2026-05"

  // التحقق: الجلسة لازم تكون في نفس الشهر الحالي
  const currentMonth = getCurrentMonth();
  if (month !== currentMonth) {
    throw new Error("لا يمكن تسجيل جلسة لشهر مختلف عن الشهر الحالي");
  }

  // التحقق: الجماعية تحتاج متدربَين على الأقل
  if (data.type === "group" && data.traineeIds.length < 2) {
    throw new Error("الجلسة الجماعية تتطلب متدربَين على الأقل");
  }

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // إضافة الجلسة
  const sessionRef = doc(collection(db, "sessions"));
  batch.set(sessionRef, {
    supervisorId: data.supervisorId,
    traineeIds: data.traineeIds,
    type: data.type,
    date: data.date,
    month,
    duration: data.duration || null,
    absenceReason: data.absenceReason || null,
    warningReason: data.warningReason || null,
    notes: data.notes || "",
    createdAt: now,
    createdBy: data.createdBy,
  });

  // تحديث snapshot وإحصائيات المتدربين (فقط للجلسات الفعلية)
  if (data.type === "individual" || data.type === "group") {
    const duration = data.duration || 1;

    // ساعات المشرف = duration بغض النظر عن عدد المتدربين
    // ساعات كل متدرب = duration

    for (const traineeId of data.traineeIds) {
      // تحديث snapshot الشهري
      const snapshotId = getSnapshotId(data.supervisorId, traineeId, month);
      const snapshotRef = doc(db, "monthlySnapshots", snapshotId);
      const snapshotSnap = await getDoc(snapshotRef);

      if (snapshotSnap.exists()) {
        const current = snapshotSnap.data() as MonthlySnapshot;
        const newIndividual =
          data.type === "individual"
            ? current.individualHours + duration
            : current.individualHours;
        const newGroup =
          data.type === "group"
            ? current.groupHours + duration
            : current.groupHours;
        const newTotal = newIndividual + newGroup;
        const groupPct = newTotal > 0 ? (newGroup / newTotal) * 100 : 0;

        batch.update(snapshotRef, {
          individualHours: newIndividual,
          groupHours: newGroup,
          totalHours: newTotal,
          groupPercentage: Math.round(groupPct * 10) / 10,
          updatedAt: now,
        });
      } else {
        // إنشاء snapshot جديد
        const newIndividual = data.type === "individual" ? duration : 0;
        const newGroup = data.type === "group" ? duration : 0;
        const newTotal = newIndividual + newGroup;
        const groupPct = newTotal > 0 ? (newGroup / newTotal) * 100 : 0;

        batch.set(snapshotRef, {
          supervisorId: data.supervisorId,
          traineeId,
          month,
          workHours: 0,
          requiredHours: 0,
          individualHours: newIndividual,
          groupHours: newGroup,
          totalHours: newTotal,
          groupPercentage: Math.round(groupPct * 10) / 10,
          absenceCount: 0,
          warningCount: 0,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        });
      }

      // تحديث إجمالي المتدرب
      const traineeSnap = await getDoc(doc(db, "trainees", traineeId));
      if (traineeSnap.exists()) {
        const t = traineeSnap.data() as Trainee;
        const newIndTotal =
          data.type === "individual"
            ? t.totalIndividualHours + duration
            : t.totalIndividualHours;
        const newGrpTotal =
          data.type === "group"
            ? t.totalGroupHours + duration
            : t.totalGroupHours;
        batch.update(doc(db, "trainees", traineeId), {
          totalIndividualHours: newIndTotal,
          totalGroupHours: newGrpTotal,
          totalHours: newIndTotal + newGrpTotal,
          updatedAt: now,
        });
      }
    }
  }

  // تحديث عداد الغياب والإنذار في الـ snapshot
  if (data.type === "absence" || data.type === "warning") {
    const traineeId = data.traineeIds[0];
    const snapshotId = getSnapshotId(data.supervisorId, traineeId, month);
    const snapshotRef = doc(db, "monthlySnapshots", snapshotId);
    const snapshotSnap = await getDoc(snapshotRef);

    const field = data.type === "absence" ? "absenceCount" : "warningCount";

    if (snapshotSnap.exists()) {
      const current = snapshotSnap.data() as MonthlySnapshot;
      batch.update(snapshotRef, {
        [field]: (current[field] || 0) + 1,
        updatedAt: now,
      });
    } else {
      batch.set(snapshotRef, {
        supervisorId: data.supervisorId,
        traineeId,
        month,
        workHours: 0,
        requiredHours: 0,
        individualHours: 0,
        groupHours: 0,
        totalHours: 0,
        groupPercentage: 0,
        absenceCount: data.type === "absence" ? 1 : 0,
        warningCount: data.type === "warning" ? 1 : 0,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      });
    }
  }

  await batch.commit();
}

/** جلب جلسات متدرب مع مشرف معين */
export async function getSessionsByTrainee(
  traineeId: string,
  supervisorId?: string
): Promise<Session[]> {
  let q = query(
    collection(db, "sessions"),
    where("traineeIds", "array-contains", traineeId),
    orderBy("date", "desc")
  );
  if (supervisorId) {
    q = query(
      collection(db, "sessions"),
      where("traineeIds", "array-contains", traineeId),
      where("supervisorId", "==", supervisorId),
      orderBy("date", "desc")
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session));
}

/** جلب جلسات مشرف في شهر معين */
export async function getSessionsBySupervisorMonth(
  supervisorId: string,
  month: string
): Promise<Session[]> {
  const q = query(
    collection(db, "sessions"),
    where("supervisorId", "==", supervisorId),
    where("month", "==", month),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session));
}

/** حذف جلسة (المشرف في نفس الشهر فقط) */
export async function deleteSession(
  sessionId: string,
  requesterId: string,
  isAdmin: boolean
): Promise<void> {
  const sessionSnap = await getDoc(doc(db, "sessions", sessionId));
  if (!sessionSnap.exists()) throw new Error("الجلسة غير موجودة");

  const session = sessionSnap.data() as Session;
  const currentMonth = getCurrentMonth();

  // المشرف ما يقدر يحذف جلسات شهر مختلف
  if (!isAdmin && session.month !== currentMonth) {
    throw new Error("لا يمكن حذف جلسات من شهر سابق");
  }

  // TODO: عكس الساعات من الـ snapshot والمتدرب
  await updateDoc(doc(db, "sessions", sessionId), {
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: requesterId,
  });
}

// ===========================
// الملخص الشهري — Monthly Snapshots
// ===========================

/** تحديث ساعات عمل المتدرب الشهرية */
export async function updateWorkHours(
  supervisorId: string,
  traineeId: string,
  month: string,
  workHours: number
): Promise<void> {
  const snapshotId = getSnapshotId(supervisorId, traineeId, month);
  const snapshotRef = doc(db, "monthlySnapshots", snapshotId);
  const requiredHours = workHours * 0.05;

  await updateDoc(snapshotRef, {
    workHours,
    requiredHours: Math.round(requiredHours * 10) / 10,
    updatedAt: new Date().toISOString(),
  });
}

/** جلب snapshot شهري */
export async function getMonthlySnapshot(
  supervisorId: string,
  traineeId: string,
  month: string
): Promise<MonthlySnapshot | null> {
  const snapshotId = getSnapshotId(supervisorId, traineeId, month);
  const snap = await getDoc(doc(db, "monthlySnapshots", snapshotId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MonthlySnapshot;
}

/** جلب كل snapshots مشرف لشهر معين */
export async function getSnapshotsBySupervisorMonth(
  supervisorId: string,
  month: string
): Promise<MonthlySnapshot[]> {
  const q = query(
    collection(db, "monthlySnapshots"),
    where("supervisorId", "==", supervisorId),
    where("month", "==", month)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MonthlySnapshot));
}

// ===========================
// القفل — Month Locking
// ===========================

/** قفل شهر يدوياً (أدمن) */
export async function lockMonth(
  supervisorId: string,
  traineeId: string,
  month: string,
  adminId: string
): Promise<void> {
  const snapshotId = getSnapshotId(supervisorId, traineeId, month);
  await updateDoc(doc(db, "monthlySnapshots", snapshotId), {
    lockedAt: new Date().toISOString(),
    lockedBy: adminId,
    updatedAt: new Date().toISOString(),
  });
}

/** فتح شهر مقفول (أدمن فقط) */
export async function unlockMonth(
  supervisorId: string,
  traineeId: string,
  month: string,
  adminId: string
): Promise<void> {
  const snapshotId = getSnapshotId(supervisorId, traineeId, month);
  await updateDoc(doc(db, "monthlySnapshots", snapshotId), {
    lockedAt: null,
    lockedBy: null,
    updatedAt: new Date().toISOString(),
  });
}

/** قفل تلقائي لكل snapshots الشهر الماضي — يُستدعى من أول يوم في الشهر الجديد */
export async function autoLockPreviousMonth(): Promise<void> {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 7);

  const q = query(
    collection(db, "monthlySnapshots"),
    where("month", "==", prevMonth),
    where("lockedAt", "==", null)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  const lockTime = new Date().toISOString();

  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      lockedAt: lockTime,
      lockedBy: "auto",
      updatedAt: lockTime,
    });
  });

  await batch.commit();
}

/** التحقق هل الشهر مقفول */
export async function isMonthLocked(
  supervisorId: string,
  traineeId: string,
  month: string
): Promise<boolean> {
  const snapshot = await getMonthlySnapshot(supervisorId, traineeId, month);
  if (!snapshot) return false;
  return !!snapshot.lockedAt;
}
