import { redirect } from "next/navigation";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import AdminSupervisorOperations from "@/components/admin/AdminSupervisorOperations";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export default async function SupervisorOperationsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!(await requireAdmin())) redirect(`/${locale}/login?portal=admin`);
  const today = new Date().toISOString().slice(0,10);
  const [supervisor, slots] = await Promise.all([adminDb.collection("supervisors").doc(id).get(),adminDb.collection("availability").where("supervisorId","==",id).where("date",">=",today).orderBy("date","asc").get()]);
  if (!supervisor.exists) redirect(`/${locale}/admin/supervisors`);
  return <AdminPageLayout locale={locale} title="إدارة المواعيد والمقاعد"><AdminSupervisorOperations locale={locale} supervisor={{id:supervisor.id,...supervisor.data()}} initialSlots={slots.docs.map((doc)=>({id:doc.id,...doc.data()}))}/></AdminPageLayout>;
}
