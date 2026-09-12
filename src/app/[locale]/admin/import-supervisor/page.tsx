import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/serverAuth";

export default async function SupervisorImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect("/ar/login?portal=admin");
  redirect(`/${locale}/admin/supervisors?view=import`);
}
