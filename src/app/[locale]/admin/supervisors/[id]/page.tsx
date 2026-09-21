import { redirect } from "next/navigation";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import AdminSupervisorOperations from "@/components/admin/AdminSupervisorOperations";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import SupervisorMonthlyWork from "@/components/admin/SupervisorMonthlyWork";

export default async function SupervisorOperationsPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { locale, id } = await params;
  const { view: requestedView } = await searchParams;
  const view = requestedView === "schedule" ? "schedule" : "work";
  if (!(await requireAdmin())) redirect(`/${locale}/login?portal=admin`);
  const today = new Date().toISOString().slice(0,10);
  const [supervisor, slots, traineesSnap, activitiesSnap, sessionsSnap, minutesSnap, documentsSnap] = await Promise.all([adminDb.collection("supervisors").doc(id).get(),adminDb.collection("availability").where("supervisorId","==",id).where("date",">=",today).orderBy("date","asc").get(),adminDb.collection("trainees").where("currentSupervisorId","==",id).get(),adminDb.collection("fieldworkActivities").where("supervisorId","==",id).get(),adminDb.collection("sessions").where("supervisorId","==",id).get(),adminDb.collection("meetingMinutes").where("supervisorId","==",id).get(),adminDb.collection("supervisionDocuments").where("supervisorId","==",id).get()]);
  if (!supervisor.exists) redirect(`/${locale}/admin/supervisors`);
  const supervisorData:any={id:supervisor.id,...supervisor.data()};
  const serial=(data:any)=>Object.fromEntries(Object.entries(data).map(([k,v]:any)=>[k,v?.toDate?v.toDate().toISOString():v]));
  const clean=(docs:any[])=>docs.map(d=>({id:d.id,...serial(d.data())}));
  return <AdminPageLayout locale={locale} title={`${view === "work" ? "ملف عمل" : "مواعيد"} المشرف: ${String(supervisorData.name||"")}`}>
    <nav aria-label="أقسام حساب المشرف" style={{display:"flex",gap:8,marginBottom:14,padding:6,background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,width:"fit-content"}}>
      <a href={`/${locale}/admin/supervisors/${id}?view=work`} style={{padding:"9px 14px",borderRadius:8,textDecoration:"none",fontSize:12,fontWeight:800,background:view==="work"?"#0D40FC":"transparent",color:view==="work"?"#fff":"#64748B"}}>ملف العمل وكشف المتدربين</a>
      <a href={`/${locale}/admin/supervisors/${id}?view=schedule`} style={{padding:"9px 14px",borderRadius:8,textDecoration:"none",fontSize:12,fontWeight:800,background:view==="schedule"?"#0D40FC":"transparent",color:view==="schedule"?"#fff":"#64748B"}}>{supervisorData.accountType === "consultant" ? "المواعيد" : "المواعيد والمقاعد"}</a>
    </nav>
    {view === "work" ? <div id="work"><SupervisorMonthlyWork locale={locale} supervisor={serial(supervisorData)} trainees={clean(traineesSnap.docs)} activities={clean(activitiesSnap.docs)} sessions={clean(sessionsSnap.docs).filter((session:any)=>!session.deleted)} minutes={clean(minutesSnap.docs)} documents={clean(documentsSnap.docs)}/></div> : <div id="schedule"><AdminSupervisorOperations locale={locale} supervisor={supervisorData} initialSlots={slots.docs.map((doc)=>({id:doc.id,...doc.data()}))}/></div>}
  </AdminPageLayout>;
}
