import { useState, useEffect, useCallback } from "react";
import {
  getTraineesBySupervisor,
  getAllTrainees,
  getSessionsBySupervisorMonth,
  getSessionsByTrainee,
  getSnapshotsBySupervisorMonth,
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
} from "@/lib/types/index";

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// ===========================
// Hook للمشرف — يستقبل supervisorId مباشرة
// ===========================
export function useSupervisorSupervision(supervisorId: string) {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainees = useCallback(async () => {
    if (!supervisorId) return;
    try {
      const data = await getTraineesBySupervisor(supervisorId);
      setTrainees(data);
    } catch (e) {
      setError("حدث خطأ في جلب المتدربين");
    }
  }, [supervisorId]);

  const fetchMonthData = useCallback(async () => {
    if (!supervisorId) return;
    setLoading(true);
    try {
      const [sessionsData, snapshotsData] = await Promise.all([
        getSessionsBySupervisorMonth(supervisorId, selectedMonth),
        getSnapshotsBySupervisorMonth(supervisorId, selectedMonth),
      ]);
      setSessions(sessionsData);
      setSnapshots(snapshotsData);
    } catch (e) {
      setError("حدث خطأ في جلب بيانات الشهر");
    } finally {
      setLoading(false);
    }
  }, [supervisorId, selectedMonth]);

  useEffect(() => { fetchTrainees(); }, [fetchTrainees]);
  useEffect(() => { fetchMonthData(); }, [fetchMonthData]);

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
      if (!supervisorId) throw new Error("غير مصرح");
      await addSession({ ...data, supervisorId, createdBy: supervisorId });
      await fetchMonthData();
    },
    [supervisorId, fetchMonthData]
  );

  const submitWorkHours = useCallback(
    async (traineeId: string, workHours: number) => {
      if (!supervisorId) throw new Error("غير مصرح");
      await updateWorkHours(supervisorId, traineeId, selectedMonth, workHours);
      await fetchMonthData();
    },
    [supervisorId, selectedMonth, fetchMonthData]
  );

  const getTraineeSnapshot = useCallback(
    (traineeId: string) => snapshots.find((s) => s.traineeId === traineeId) || null,
    [snapshots]
  );

  const monthTotals = useCallback(() => {
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
    trainees, sessions, snapshots, selectedMonth, setSelectedMonth,
    loading, error, submitSession, submitWorkHours, getTraineeSnapshot,
    monthTotals, refresh: fetchMonthData,
  };
}

// ===========================
// Hook لجلسات متدرب معين
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
// Hook للأدمن — يستقبل adminId مباشرة
// ===========================
export function useAdminSupervision(adminId?: string) {
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createTrainee = useCallback(
    async (data: { name: string; email: string; phone: string; license: License }) => {
      await addTrainee(data);
      await fetchAll();
    },
    [fetchAll]
  );

  const assignTraineeToSupervisor = useCallback(
    async (data: { traineeId: string; supervisorId: string; startDate: string; notes?: string }) => {
      await assignTrainee({ ...data, adminId: adminId || "admin" });
      await fetchAll();
    },
    [adminId, fetchAll]
  );

  const advanceOnboarding = useCallback(
    async (traineeId: string, stage: OnboardingStage) => {
      await updateOnboardingStage(traineeId, stage);
      await fetchAll();
    },
    [fetchAll]
  );

  const changeTraineeStatus = useCallback(
    async (traineeId: string, status: TraineeStatus) => {
      await updateTraineeStatus(traineeId, status);
      await fetchAll();
    },
    [fetchAll]
  );

  const lockMonthForTrainee = useCallback(
    async (supervisorId: string, traineeId: string, month: string) => {
      await lockMonth(supervisorId, traineeId, month, adminId || "admin");
    },
    [adminId]
  );

  const unlockMonthForTrainee = useCallback(
    async (supervisorId: string, traineeId: string, month: string) => {
      await unlockMonth(supervisorId, traineeId, month, adminId || "admin");
    },
    [adminId]
  );

  const getTraineesByStatus = useCallback(
    (status: TraineeStatus) => trainees.filter((t) => t.status === status),
    [trainees]
  );

  const getTraineesBySupervisorId = useCallback(
    (supervisorId: string) => trainees.filter((t) => t.currentSupervisorId === supervisorId),
    [trainees]
  );

  const stats = {
    total: trainees.length,
    active: trainees.filter((t) => t.status === "active").length,
    onboarding: trainees.filter((t) => t.status === "onboarding").length,
    paused: trainees.filter((t) => t.status === "paused").length,
    withdrawn: trainees.filter((t) => t.status === "withdrawn").length,
    completed: trainees.filter((t) => t.status === "completed").length,
  };

  return {
    trainees, loading, error, stats,
    createTrainee, assignTraineeToSupervisor, advanceOnboarding,
    changeTraineeStatus, lockMonthForTrainee, unlockMonthForTrainee,
    getTraineesByStatus, getTraineesBySupervisorId, refresh: fetchAll,
  };
}
