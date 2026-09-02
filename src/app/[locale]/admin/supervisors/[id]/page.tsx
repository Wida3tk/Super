import { redirect } from "next/navigation";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import AdminSupervisorOperations from "@/components/admin/AdminSupervisorOperations";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import SupervisorWorkHistory from "@/components/admin/SupervisorWorkHistory";

export default async function SupervisorOperationsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!(await requireAdmin())) redirect(`/${locale}/login?portal=admin`);
  const today = new Date().toISOString().slice(0,10);
  const [supervisor, slots, traineesSnap, activitiesSnap, sessionsSnap, minutesSnap, documentsSnap] = await Promise.all([adminDb.collection("supervisors").doc(id).get(),adminDb.collection("availability").where("supervisorId","==",id).where("date",">=",today).orderBy("date","asc").get(),adminDb.collection("trainees").where("currentSupervisorId","==",id).get(),adminDb.collection("fieldworkActivities").where("supervisorId","==",id).get(),adminDb.collection("sessions").where("supervisorId","==",id).get(),adminDb.collection("meetingMinutes").where("supervisorId","==",id).get(),adminDb.collection("supervisionDocuments").where("supervisorId","==",id).get()]);
  if (!supervisor.exists) redirect(`/${locale}/admin/supervisors`);
  const supervisorData={id:supervisor.id,...supervisor.data()};
  return <AdminPageLayout locale={locale} title="ملف المشرف وإدارته"><AdminSupervisorOperations locale={locale} supervisor={supervisorData} initialSlots={slots.docs.map((doc)=>({id:doc.id,...doc.data()}))}/><SupervisorWorkHistory supervisor={supervisorData} trainees={traineesSnap.docs.map(d=>({id:d.id,...d.data()}))} activities={activitiesSnap.docs.map(d=>({id:d.id,...d.data()}))} sessions={sessionsSnap.docs.map(d=>({id:d.id,...d.data()}))} minutes={minutesSnap.docs.map(d=>({id:d.id,...d.data()}))} documents={documentsSnap.docs.map(d=>({id:d.id,...d.data()}))}/></AdminPageLayout>;
}
