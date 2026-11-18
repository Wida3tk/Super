import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import AssistantManagement from "@/components/admin/AssistantManagement";
import "@/styles/assistant.css";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect(`/${locale}/login?portal=admin`);
  const supervisors = await adminDb.collection("supervisors").limit(200).get();
  return <AdminPageLayout locale={locale} title="المساعدون الإداريون"><AssistantManagement locale={locale} supervisors={supervisors.docs.filter(d => d.data().isActive !== false && d.data().accountType !== "consultant").map(d => ({ id: d.id, name: String(d.data().name || "") }))} /></AdminPageLayout>;
}
