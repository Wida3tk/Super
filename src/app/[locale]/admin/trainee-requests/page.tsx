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
  const snapshot = await adminDb
    .collection("traineeRequests")
    .orderBy("createdAt", "desc")
    .get();
  const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return (
    <AdminPageLayout locale={locale} title="طلبات المتدربين">
      <TraineeRequestsManager initialRequests={requests} />
    </AdminPageLayout>
  );
}
