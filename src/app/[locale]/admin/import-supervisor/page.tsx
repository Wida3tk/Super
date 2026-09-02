import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/serverAuth";
import SupervisorImportClient from "@/components/admin/SupervisorImportClient";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";

export default async function SupervisorImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect("/ar/login?portal=admin");
  return <AdminPageLayout locale={locale} title="استيراد ملف مشرف"><SupervisorImportClient /></AdminPageLayout>;
}
