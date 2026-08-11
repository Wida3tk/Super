import { redirect } from "next/navigation";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import ClientAccountsManager, {
  ClientAccount,
} from "@/components/admin/ClientAccountsManager";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect(`/${locale}/login`);
  const snapshot = await adminDb
    .collection("clients")
    .orderBy("createdAt", "desc")
    .get();
  const clients = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ClientAccount[];
  return (
    <AdminPageLayout locale={locale} title="حسابات المسجلين">
      <ClientAccountsManager initialClients={clients} />
    </AdminPageLayout>
  );
}
