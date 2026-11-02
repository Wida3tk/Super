import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";
import { redirect } from "next/navigation";
import { withContractDates } from "@/lib/qaba/contractDates";
import { buildMonthCycle } from "@/lib/admin/controlRoom";
import SupervisorPortal from "@/components/supervisor/portal/SupervisorPortal";
import type { FieldworkActivity } from "@/types";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ section?: string; trainee?: string }>;
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
      cycles={JSON.parse(JSON.stringify(cycles))}
      currentMonth={currentMonth}
      previousMonth={previousMonth}
      initialSection={typeof query.section === "string" ? query.section : undefined}
      initialTraineeId={typeof query.trainee === "string" ? query.trainee : undefined}
    />
  );
}
