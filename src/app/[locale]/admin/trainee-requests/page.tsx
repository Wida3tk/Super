import { redirect } from "next/navigation";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import TraineeRequestsManager from "@/components/admin/TraineeRequestsManager";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
export default async function RequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect(`/${locale}/login`);
  const [snapshot, supervisorsSnap] = await Promise.all([
    adminDb.collection("traineeRequests").orderBy("createdAt", "desc").get(),
    adminDb.collection("supervisors").where("isActive", "==", true).get(),
  ]);
  const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const supervisors = supervisorsSnap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    availableSeats: doc.data().availableSeats ?? 0,
  }));
  return (
    <AdminPageLayout locale={locale} title="طلبات المتدربين">
      <TraineeRequestsManager
        initialRequests={requests}
        supervisors={supervisors}
      />
    </AdminPageLayout>
  );
}
