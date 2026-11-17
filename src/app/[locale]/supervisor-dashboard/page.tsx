import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";
import { redirect } from "next/navigation";
import { traineeRules } from "@/lib/qaba/compliance";
import { withContractDates } from "@/lib/qaba/contractDates";
import { buildMonthCycle } from "@/lib/admin/controlRoom";
import SupervisorPortal from "@/components/supervisor/portal/SupervisorPortal";
import type { FieldworkActivity } from "@/types";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ section?: string; trainee?: string; chat?: string }>;
}

export default async function SupervisorDashboardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const supervisor = (await getAuthenticatedSupervisor()) as any;
  if (!supervisor) redirect(`/${locale}/login`);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const previousDate = new Date(`${currentMonth}-01T00:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);

  const [
    bookingsSnap,
    traineesSnap,
    sessionsSnap,
    snapshotsSnap,
    notifsSnap,
    fieldworkSnap,
    approvedActivitiesSnap,
    monthActivitiesSnap,
    prevActivitiesSnap,
    prevSessionsSnap,
    approvalsSnap,
    prevApprovalsSnap,
  ] = await Promise.all([
    adminDb
      .collection("bookings")
      .where("supervisorId", "==", supervisor.id)
      .where("status", "==", "confirmed")
      .orderBy("date", "asc")
      .get(),
    adminDb
      .collection("trainees")
      .where("currentSupervisorId", "==", supervisor.id)
      .where("status", "==", "active")
      .get(),
    adminDb
      .collection("sessions")
      .where("supervisorId", "==", supervisor.id)
      .where("month", "==", currentMonth)
      .get(),
    adminDb
      .collection("monthlySnapshots")
      .where("supervisorId", "==", supervisor.id)
      .where("month", "==", currentMonth)
      .get(),
    adminDb
      .collection("notifications")
      .where("supervisorId", "==", supervisor.id)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get(),
    adminDb
      .collection("fieldworkActivities")
      .where("supervisorId", "==", supervisor.id)
      .where("status", "==", "submitted")
      .limit(500)
      .get(),
    adminDb
      .collection("fieldworkActivities")
      .where("supervisorId", "==", supervisor.id)
      .where("status", "==", "approved")
      .get(),
    adminDb.collection("fieldworkActivities").where("supervisorId", "==", supervisor.id).where("month", "==", currentMonth).get(),
    adminDb.collection("fieldworkActivities").where("supervisorId", "==", supervisor.id).where("month", "==", previousMonth).get(),
    adminDb.collection("sessions").where("supervisorId", "==", supervisor.id).where("month", "==", previousMonth).get(),
    adminDb.collection("monthlyApprovals").where("supervisorId", "==", supervisor.id).where("month", "==", currentMonth).get(),
    adminDb.collection("monthlyApprovals").where("supervisorId", "==", supervisor.id).where("month", "==", previousMonth).get(),
  ]);

  const allBookings = bookingsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const initialTrainees = (await withContractDates(traineesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })))) as any[];
  const initialSessions = sessionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((session: any) => !session.deleted) as any[];
  const initialSnapshots = snapshotsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const notificationCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const notifications = (
    notifsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[]
  ).filter(
    (notification) =>
      notification.targetType !== "admin" &&
      !notification.read &&
      (!notification.createdAt ||
        new Date(notification.createdAt).getTime() >= notificationCutoff),
  );
  const fieldworkActivities = (
    fieldworkSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
  ).filter((a) => a.status === "submitted");
  const approvedActivities = approvedActivitiesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];

  // Monthly cycle for my trainees: the open month and the one being closed.
  const cycleInputs = (month: string, activities: FirebaseFirestore.QuerySnapshot, sessions: FirebaseFirestore.QuerySnapshot, approvals: FirebaseFirestore.QuerySnapshot) =>
    buildMonthCycle({
      trainees: initialTrainees,
      activities: activities.docs.map((d) => ({ id: d.id, ...d.data() }) as FieldworkActivity),
      sessions: sessions.docs.map((d) => ({ id: d.id, data: d.data() })),
      approvals: approvals.docs.map((d) => d.data() as any),
      monthClosed: month < currentMonth,
    });
  const cycles = {
    [currentMonth]: cycleInputs(currentMonth, monthActivitiesSnap, sessionsSnap, approvalsSnap),
    [previousMonth]: cycleInputs(previousMonth, prevActivitiesSnap, prevSessionsSnap, prevApprovalsSnap),
  };
  const query = await searchParams;
  // Sessions from the supervisor's workbook that the admin imported without a usable date.
  // Graduates stay linked to their supervisor; they are listed apart from current trainees.
  const graduatesSnap = await adminDb.collection("trainees").where("currentSupervisorId", "==", supervisor.id).where("status", "==", "completed").get();
  const graduates = (await withContractDates(graduatesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as any)))
    .map((t: any) => ({
      id: t.id,
      name: String(t.name || ""),
      license: String(t.license || "QASP-S"),
      hours: Math.round(Number(t.approvedFieldworkHours || 0) * 10) / 10,
      required: traineeRules(t).total,
      supervision: Math.round((Number(t.totalIndividualHours || 0) + Number(t.totalGroupHours || 0)) * 10) / 10,
      completedAt: String(t.lifecycleStageChangedAt || "").slice(0, 10) || null,
    }))
    .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")) || a.name.localeCompare(b.name, "ar"));
  const gapsSnap = await adminDb.collection("importGaps").where("supervisorId", "==", supervisor.id).where("status", "==", "open").limit(300).get();
  const importGaps = gapsSnap.docs.map((doc) => {
    const g = doc.data();
    return { id: doc.id, traineeId: g.traineeId, traineeName: g.traineeName, sourceFile: g.sourceFile, sheet: g.sheet, cell: g.cell, raw: g.raw || "", expectedMonth: g.expectedMonth || null, suggestion: g.suggestion || null, individual: Number(g.individual || 0), group: Number(g.group || 0) };
  }).sort((a, b) => a.traineeName.localeCompare(b.traineeName, "ar") || String(a.expectedMonth).localeCompare(String(b.expectedMonth)));

  return (
    <SupervisorPortal
      locale={locale}
      supervisor={JSON.parse(JSON.stringify(supervisor))}
      trainees={initialTrainees}
      bookings={allBookings}
      sessions={initialSessions}
      snapshots={initialSnapshots}
      notifications={notifications}
      pendingActivities={fieldworkActivities}
      approvedActivities={approvedActivities}
      importGaps={importGaps}
      graduates={graduates}
      cycles={JSON.parse(JSON.stringify(cycles))}
      currentMonth={currentMonth}
      previousMonth={previousMonth}
      initialSection={typeof query.section === "string" ? query.section : undefined}
      initialTraineeId={typeof query.trainee === "string" ? query.trainee : undefined}
      initialChatId={typeof query.chat === "string" ? query.chat : undefined}
    />
  );
}
