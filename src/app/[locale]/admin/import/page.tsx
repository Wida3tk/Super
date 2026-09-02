import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/serverAuth";
import LegacyImportClient from "@/components/admin/LegacyImportClient";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";

export default async function LegacyImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect("/ar/login?portal=admin");
  return <AdminPageLayout locale={locale} title="استيراد ملف متدرب"><LegacyImportClient /></AdminPageLayout>;
}
