import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee } from "@/lib/auth/serverAuth";
import TraineeFieldworkDashboard from "@/components/trainee/TraineeFieldworkDashboard";
import type { FieldworkActivity } from "@/types";

export default async function TraineeDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const trainee = await getAuthenticatedTrainee();
  if (!trainee) redirect(`/${locale}/login`);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [
    activitySnap,
    supervisorSnap,
    planSnap,
    assessmentsSnap,
    documentsSnap,
    meetingsSnap,
    monthlyApprovalSnap,
    attendanceSnap,
    requestsSnap,
    financialPlanSnap,
    agreementSnap,
    assignmentsSnap,
    improvementPlansSnap,
    progressReportsSnap,
  ] = await Promise.all([
    adminDb
      .collection("fieldworkActivities")
      .where("traineeId", "==", trainee.id)
      .limit(300)
      .get(),
    trainee.currentSupervisorId
      ? adminDb.collection("supervisors").doc(trainee.currentSupervisorId).get()
      : Promise.resolve(null),
    adminDb.collection("supervisionPlans").doc(trainee.id).get(),
    adminDb
      .collection("competencyAssessments")
      .where("traineeId", "==", trainee.id)
      .limit(20)
      .get(),
    adminDb
      .collection("supervisionDocuments")
      .where("traineeId", "==", trainee.id)
      .limit(100)
      .get(),
    adminDb
      .collection("meetingMinutes")
      .where("traineeId", "==", trainee.id)
      .limit(100)
      .get(),
    adminDb
      .collection("monthlyApprovals")
      .doc(`${trainee.id}_${currentMonth}`)
      .get(),
    adminDb
      .collection("sessions")
      .where("traineeIds", "array-contains", trainee.id)
      .limit(100)
      .get(),
    adminDb
      .collection("traineeRequests")
      .where("traineeId", "==", trainee.id)
      .limit(50)
      .get(),
    adminDb.collection("financialPlans").doc(trainee.id).get(),
    adminDb.collection("supervisionAgreements").doc(trainee.id).get(),
    adminDb
      .collection("assignments")
      .where("traineeId", "==", trainee.id)
      .limit(50)
      .get(),
    adminDb
      .collection("performanceImprovementPlans")
      .where("traineeId", "==", trainee.id)
      .limit(50)
      .get(),
    adminDb
      .collection("progressReports")
      .where("traineeId", "==", trainee.id)
      .limit(50)
      .get(),
  ]);
  const activities = (
    activitySnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as FieldworkActivity[]
  ).sort((a, b) => b.date.localeCompare(a.date));
  const supervisorName = supervisorSnap?.exists
    ? String(supervisorSnap.data()?.name || "")
    : "";
  const supervisionFile = {
    plan: planSnap.exists
      ? { id: planSnap.id, ...planSnap.data() }
      : { goals: [] },
    assessments: assessmentsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))),
    documents: documentsSnap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        type: x.type,
        title: x.title,
        issuedAt: x.issuedAt,
        expiresAt: x.expiresAt,
        status: x.status,
        fileUrl: x.fileUrl,
        fileName: x.fileName,
      };
    }),
    meetings: meetingsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))),
    monthlyApproval: monthlyApprovalSnap.exists
      ? { id: monthlyApprovalSnap.id, ...monthlyApprovalSnap.data() }
      : null,
    currentMonth,
    attendance: attendanceSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((item: any) => item.type === "absence" || item.type === "warning")
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))),
    requests: requestsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    financialPlan: financialPlanSnap.exists
      ? { id: financialPlanSnap.id, ...financialPlanSnap.data() }
      : null,
    agreement: agreementSnap.exists
      ? { id: agreementSnap.id, ...agreementSnap.data() }
      : null,
    assignments: assignmentsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) =>
        String(b.startDate).localeCompare(String(a.startDate)),
      ),
    improvementPlans: improvementPlansSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((item: any) => item.visibleToTrainee !== false)
      .sort((a: any, b: any) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    progressReports: progressReportsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((item: any) => item.visibleToTrainee !== false)
      .sort((a: any, b: any) =>
        String(b.periodEnd).localeCompare(String(a.periodEnd)),
      ),
  };
  return (
    <TraineeFieldworkDashboard
      trainee={trainee}
      supervisorName={supervisorName}
      initialActivities={activities}
      supervisionFile={supervisionFile}
    />
  );
}
