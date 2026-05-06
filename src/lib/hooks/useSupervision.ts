import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/hooks/useAuth"; // hook الموجود عندك
import {
  getTraineesBySupervisor,
  getAllTrainees,
  getSessionsBySupervisorMonth,
  getSessionsByTrainee,
  getSnapshotsBySupervisorMonth,
  getMonthlySnapshot,
  addSession,
  updateWorkHours,
  lockMonth,
  unlockMonth,
  addTrainee,
  assignTrainee,
  updateOnboardingStage,
  updateTraineeStatus,
} from "@/lib/firebase/supervision";
import type {
  Trainee,
  Session,
  MonthlySnapshot,
  SessionType,
  AbsenceReason,
  WarningReason,
  License,
  OnboardingStage,
  TraineeStatus,
} from "@/lib/types";

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// ===========================
// Hook للمشرف
// ===========================
export function useSupervisorSupervision() {
  const { user } = useAuth();
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // جلب المتدربين
  const fetchTrainees = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const data = await getTraineesBySupervisor(user.uid);
      setTrainees(data);
    } catch (e) {
      setError("حدث خطأ في جلب المتدربين");
    }
  }, [user?.uid]);

  // جلب الجلسات والـ snapshots للشهر المحدد
  const fetchMonthData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [sessionsData, snapshotsData] = await Promise.all([
        getSessionsBySupervisorMonth(user.uid, selectedMonth),
        getSnapshotsBySupervisorMonth(user.uid, selectedMonth),
      ]);
      setSessions(sessionsData);
      setSnapshots(snapshotsData);
    } catch (e) {
      setError("حدث خطأ في جلب بيانات الشهر");
    } finally {
      setLoading(false);
    }
  }, [user?.uid, selectedMonth]);

  useEffect(() => {
    fetchTrainees();
  }, [fetchTrainees]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  // تسجيل جلسة جديدة
  const submitSession = useCallback(
    async (data: {
      traineeIds: string[];
      type: SessionType;
      date: string;
      duration?: number;
      absenceReason?: AbsenceReason;
      warningReason?: WarningReason;
      notes?: string;
    }) => {
      if (!user?.uid) throw new Error("غير مصرح");
      await addSession({
        ...data,
        supervisorId: user.uid,
        createdBy: user.uid,
      });
      await fetchMonthData(); // تحديث البيانات بعد الإضافة
    },
    [user?.uid, fetchMonthData]
  );

  // تحديث ساعات عمل المتدرب الشهرية
  const submitWorkHours = useCallback(
    async (traineeId: string, workHours: number) => {
      if (!user?.uid) throw new Error("غير مصرح");
      await updateWorkHours(user.uid, traineeId, selectedMonth, workHours);
      await fetchMonthData();
    },
    [user?.uid, selectedMonth, fetchMonthData]
  );

  // جلب snapshot متدرب معين للشهر الحالي
  const getTraineeSnapshot = useCallback(
    (traineeId: string) => {
      return snapshots.find((s) => s.traineeId === traineeId) || null;
    },
    [snapshots]
  );

  // إجمالي ساعات المشرف للشهر
  const monthTotals = useCallback(() => {
    // الجماعية تُحسب مرة واحدة على المشرف
    const sessionSet = new Set<string>();
    let individual = 0;
    let group = 0;

    sessions.forEach((s) => {
      if (s.type === "individual") individual += s.duration || 0;
      if (s.type === "group" && !sessionSet.has(s.id)) {
        group += s.duration || 0;
        sessionSet.add(s.id);
      }
    });

    return { individual, group, total: individual + group };
  }, [sessions]);

  return {
    trainees,
    sessions,
    snapshots,
    selectedMonth,
    setSelectedMonth,
    loading,
    error,
    submitSession,
    submitWorkHours,
    getTraineeSnapshot,
    monthTotals,
    refresh: fetchMonthData,
  };
}

// ===========================
// Hook لجلسات متدرب معين (للمشرف والأدمن)
// ===========================
export function useTraineeSessions(traineeId: string, supervisorId?: string) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!traineeId) return;
    setLoading(true);
    getSessionsByTrainee(traineeId, supervisorId)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [traineeId, supervisorId]);

  return { sessions, loading };
}

// ===========================
// Hook للأدمن
// ===========================
export function useAdminSupervision() {
  const { user } = useAuth();
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllTrainees();
      setTrainees(data);
    } catch (e) {
      setError("حدث خطأ في جلب البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // إضافة متدرب جديد
  const createTrainee = useCallback(
    async (data: {
      name: string;
      email: string;
      phone: string;
      license: License;
    }) => {
      await addTrainee(data);
      await fetchAll();
    },
    [fetchAll]
  );

  // إسناد متدرب لمشرف
  const assignTraineeToSupervisor = useCallback(
    async (data: {
      traineeId: string;
      supervisorId: string;
      startDate: string;
      notes?: string;
    }) => {
      if (!user?.uid) throw new Error("غير مصرح");
      await assignTrainee({ ...data, adminId: user.uid });
      await fetchAll();
    },
    [user?.uid, fetchAll]
  );

  // تحديث مرحلة البوردنق
  const advanceOnboarding = useCallback(
    async (traineeId: string, stage: OnboardingStage) => {
      await updateOnboardingStage(traineeId, stage);
      await fetchAll();
    },
    [fetchAll]
  );

  // تحديث حالة المتدرب
  const changeTraineeStatus = useCallback(
    async (traineeId: string, status: TraineeStatus) => {
      await updateTraineeStatus(traineeId, status);
      await fetchAll();
    },
    [fetchAll]
  );

  // قفل شهر
  const lockMonthForTrainee = useCallback(
    async (supervisorId: string, traineeId: string, month: string) => {
      if (!user?.uid) throw new Error("غير مصرح");
      await lockMonth(supervisorId, traineeId, month, user.uid);
    },
    [user?.uid]
  );

  // فتح شهر
  const unlockMonthForTrainee = useCallback(
    async (supervisorId: string, traineeId: string, month: string) => {
      if (!user?.uid) throw new Error("غير مصرح");
      await unlockMonth(supervisorId, traineeId, month, user.uid);
    },
    [user?.uid]
  );

  // فلترة المتدربين
  const getTraineesByStatus = useCallback(
    (status: TraineeStatus) => trainees.filter((t) => t.status === status),
    [trainees]
  );

  const getTraineesBySupervisorId = useCallback(
    (supervisorId: string) =>
      trainees.filter((t) => t.currentSupervisorId === supervisorId),
    [trainees]
  );

  // إحصائيات سريعة
  const stats = {
    total: trainees.length,
    active: trainees.filter((t) => t.status === "active").length,
    onboarding: trainees.filter((t) => t.status === "onboarding").length,
    paused: trainees.filter((t) => t.status === "paused").length,
    withdrawn: trainees.filter((t) => t.status === "withdrawn").length,
    completed: trainees.filter((t) => t.status === "completed").length,
  };

  return {
    trainees,
    loading,
    error,
    stats,
    createTrainee,
    assignTraineeToSupervisor,
    advanceOnboarding,
    changeTraineeStatus,
    lockMonthForTrainee,
    unlockMonthForTrainee,
    getTraineesByStatus,
    getTraineesBySupervisorId,
    refresh: fetchAll,
  };
}
