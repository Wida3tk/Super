import { redirect } from "next/navigation";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import OnboardingBoard, { type BoardTrainee } from "@/components/admin/onboarding/OnboardingBoard";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { boardColumn, monthlyMovement } from "@/lib/admin/onboarding";

const monthsBack = (count: number) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
};

/** «الانضمام»: every applicant from a new request to assignment, with the monthly movement of each step. */
export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect(`/${locale}/login?portal=admin`);
  const months = monthsBack(6);
  const [traineesSnap, supervisorsSnap, transitionsSnap] = await Promise.all([
    adminDb.collection("trainees").get(),
    adminDb.collection("supervisors").select("name", "isActive", "isDemo", "accountType", "availableSeats").get(),
    adminDb.collection("traineeLifecycleTransitions").where("changedMonth", "in", months).get(),
  ]);
  const all = traineesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
  const trainees: BoardTrainee[] = all.flatMap((t) => {
    const column = boardColumn(t);
    if (!column) return [];
    return [{
      id: t.id, name: String(t.name || t.email || t.id), email: t.email || "", phone: t.phone || "", license: t.license || "",
      column, onboardingStage: t.onboardingStage || null,
      since: t.lifecycleStageChangedAt || t.updatedAt || t.createdAt || "", createdAt: t.createdAt || "",
      interviewSupervisorId: t.interviewSupervisorId || "", traineeIntent: t.traineeContinuationIntent || "", supervisorIntent: t.supervisorContinuationIntent || "",
    }];
  });
  const supervisors = supervisorsSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({
    id: d.id, name: String(d.data().name || d.id), active: d.data().isActive !== false, consultant: d.data().accountType === "consultant", seats: Number(d.data().availableSeats || 0),
  }));
  const movement = monthlyMovement(months, transitionsSnap.docs.map((d) => d.data()), all);
  return (
    <AdminPageLayout locale={locale} title="الانضمام">
      <OnboardingBoard locale={locale} trainees={trainees} supervisors={supervisors} months={months} movement={Object.fromEntries(movement)} />
    </AdminPageLayout>
  );
}
