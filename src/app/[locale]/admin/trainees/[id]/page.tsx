import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import { credentialRules } from "@/lib/qaba/compliance";
import TraineeMonthlyHours from "@/components/admin/TraineeMonthlyHours";

const value = (input: unknown) => {
  if (!input) return "—";
  if (typeof input === "string" || typeof input === "number") return String(input);
  if (input instanceof Date) return input.toLocaleDateString("ar-SA");
  if (typeof input === "object" && input && "toDate" in input) return (input as {toDate(): Date}).toDate().toLocaleString("ar-SA");
  return "—";
};

export default async function TraineeFilePage({ params }: { params: Promise<{locale: string; id: string}> }) {
  const { locale, id } = await params;
  const session = (await cookies()).get("__session")?.value;
  if (!session) redirect(`/${locale}/login?portal=admin`);
  const { adminAuth, adminDb } = await import("@/lib/firebase/admin");
  const decoded = await adminAuth.verifySessionCookie(session, true);
  if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login?portal=admin`);
  const traineeSnap = await adminDb.collection("trainees").doc(id).get();
  if (!traineeSnap.exists) notFound();
  const trainee = { id: traineeSnap.id, ...traineeSnap.data() } as any;
  const [supervisorSnap, activitiesSnap, bookingsSnap, agreementSnap, documentsSnap, planSnap, reportsSnap, assessmentsSnap] = await Promise.all([
    trainee.currentSupervisorId ? adminDb.collection("supervisors").doc(trainee.currentSupervisorId).get() : null,
    adminDb.collection("fieldworkActivities").where("traineeId", "==", id).get(),
    adminDb.collection("bookings").where("traineeId", "==", id).get(),
    adminDb.collection("supervisionAgreements").doc(id).get(),
    adminDb.collection("supervisionDocuments").where("traineeId", "==", id).get(),
    adminDb.collection("supervisionPlans").doc(id).get(),
    adminDb.collection("progressReports").where("traineeId", "==", id).get(),
    adminDb.collection("competencyAssessments").where("traineeId", "==", id).get(),
  ]);
  const activities = activitiesSnap.docs.map(d => {const a=d.data() as any;return {id:d.id,date:String(a.date||""),month:String(a.month||a.date||"").slice(0,7),startTime:String(a.startTime||""),endTime:String(a.endTime||""),activityType:String(a.activityType||""),category:String(a.category||""),setting:String(a.setting||""),format:String(a.format||""),duration:Number(a.duration||0),status:String(a.status||""),description:String(a.description||"")};}).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const target = Number(trainee.supervisionTargetHours || credentialRules(trainee.license || "QASP-S").supervisionTarget);
  const supervision = Number(trainee.approvedSupervisionHours || 0);
  const fieldwork = Number(trainee.approvedFieldworkHours || 0);
  const cards = [
    ["ساعات الإشراف", `${supervision} / ${target}`, "#0D40FC"],
    ["الإشراف الفردي", trainee.totalIndividualHours || 0, "#7C3AED"],
    ["الإشراف الجماعي", trainee.totalGroupHours || 0, "#0891B2"],
    ["الخبرة الميدانية المسجلة", `${fieldwork} / ${trainee.fieldworkTargetHours || credentialRules(trainee.license || "QASP-S").total}`, "#059669"],
  ];
  const details = [["الاسم",trainee.name],["البريد الإلكتروني",trainee.email],["الجوال",trainee.phone],["الرخصة",trainee.license],["الحالة",trainee.status],["حالة الحساب",trainee.accountStatus],["المشرف الحالي",supervisorSnap?.data()?.name],["بداية الإشراف",trainee.fieldworkStartDate],["تاريخ الإنشاء",trainee.createdAt]];
  return <AdminPageLayout locale={locale} title={`ملف المتدرب — ${trainee.name}`}>
    <div dir="rtl">
      <Link href={`/${locale}/admin/trainees`} style={{color:"#0D40FC",textDecoration:"none",fontWeight:700}}>→ العودة إلى المتدربين</Link>
      <section style={{marginTop:16,padding:24,borderRadius:20,color:"white",background:"linear-gradient(125deg,#001442,#0D40FC)",display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><div style={{fontSize:12,color:"#9EC5FF"}}>الملف الإداري الكامل</div><h2 style={{margin:"6px 0"}}>{trainee.name}</h2><div>{trainee.email} · {trainee.license}</div></div><div style={{padding:"9px 15px",borderRadius:99,background:"#ffffff18",alignSelf:"center"}}>المشرف: {supervisorSnap?.data()?.name || "غير مسند"}</div></section>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"16px 0"}}>{cards.map(([label,val,color])=><div key={String(label)} style={{background:"white",border:"1px solid #E2E8F0",borderTop:`3px solid ${color}`,borderRadius:15,padding:18}}><b style={{fontSize:22,color:String(color)}}>{String(val)}</b><div style={{fontSize:12,color:"#64748B",marginTop:6}}>{String(label)}</div></div>)}</div>
      <section style={{background:"white",border:"1px solid #E2E8F0",borderRadius:16,padding:20,marginBottom:16}}><h3 style={{marginTop:0}}>البيانات الأساسية</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>{details.map(([k,v])=><div key={String(k)} style={{background:"#F8FAFC",padding:12,borderRadius:10}}><small style={{color:"#64748B"}}>{String(k)}</small><div style={{fontWeight:700,marginTop:4}}>{value(v)}</div></div>)}</div></section>
      <section style={{background:"white",border:"1px solid #E2E8F0",borderRadius:16,padding:20,marginBottom:16}}><h3 style={{marginTop:0}}>ملخص الملف</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>{[["سجلات الساعات",activities.length],["الحجوزات",bookingsSnap.size],["المستندات",documentsSnap.size],["تقارير التقدم",reportsSnap.size],["تقييمات الكفاءة",assessmentsSnap.size],["الاتفاقية",agreementSnap.exists?"موجودة":"غير موجودة"],["الخطة",planSnap.exists?"موجودة":"غير موجودة"]].map(([k,v])=><div key={String(k)} style={{padding:14,border:"1px solid #E8EDF5",borderRadius:10,textAlign:"center"}}><b style={{fontSize:20}}>{String(v)}</b><div style={{fontSize:11,color:"#64748B"}}>{String(k)}</div></div>)}</div></section>
      <TraineeMonthlyHours activities={activities} />
    </div>
  </AdminPageLayout>;
}
