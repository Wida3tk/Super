import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import { credentialRules } from "@/lib/qaba/compliance";
import TraineeMonthlyHours from "@/components/admin/TraineeMonthlyHours";
import ManageTraineePassword from "@/components/admin/ManageTraineePassword";
import TraineeHoursUpdate from "@/components/admin/TraineeHoursUpdate";

const value = (input: unknown) => {
  if (!input) return "—";
  if (typeof input === "string" || typeof input === "number") return String(input);
  if (input instanceof Date) return input.toLocaleDateString("ar-SA");
  if (typeof input === "object" && input && "toDate" in input) return (input as {toDate(): Date}).toDate().toLocaleString("ar-SA");
  return "—";
};

const statusLabel: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  paused: "مؤجل",
  completed: "مكتمل",
  prepared: "جاهز للتفعيل",
  invited: "تم إرسال الدعوة",
  suspended: "موقوف",
};

const dateOnly = (input: unknown) => {
  const raw = value(input);
  if (raw === "—") return raw;
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? raw.slice(0, 10) : date.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
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
  const documents = documentsSnap.docs.map(d => ({id:d.id,...d.data()} as any)).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  const target = Number(trainee.supervisionTargetHours || credentialRules(trainee.license || "QASP-S").supervisionTarget);
  const supervision = Number(trainee.approvedSupervisionHours || 0);
  const fieldwork = Number(trainee.approvedFieldworkHours || 0);
  const fieldworkTarget = Number(trainee.fieldworkTargetHours || credentialRules(trainee.license || "QASP-S").total);
  const cards = [
    ["ساعات الإشراف", supervision, target, "#0D40FC"],
    ["الإشراف الفردي", Number(trainee.totalIndividualHours || 0), target, "#7C3AED"],
    ["الإشراف الجماعي", Number(trainee.totalGroupHours || 0), target, "#0891B2"],
    ["الخبرة الميدانية", fieldwork, fieldworkTarget, "#059669"],
  ];
  const identityDetails = [["الاسم الكامل",trainee.name,"👤"],["البريد الإلكتروني",trainee.email,"✉"],["رقم الجوال",trainee.phone,"☎"],["الرخصة المهنية",trainee.license,"◈"]];
  const enrollmentDetails = [["المشرف الحالي",supervisorSnap?.data()?.name,"◎"],["بداية الإشراف",dateOnly(trainee.fieldworkStartDate),"◷"],["حالة المتدرب",statusLabel[String(trainee.status || "")] || trainee.status,"●"],["حالة الدخول",statusLabel[String(trainee.accountStatus || "")] || trainee.accountStatus,"🔐"],["تاريخ إضافة الملف",dateOnly(trainee.createdAt),"＋"]];
  return <AdminPageLayout locale={locale} title={`ملف المتدرب — ${trainee.name}`}>
    <div dir="rtl">
      <style>{css}</style>
      <div className="file-topbar"><Link href={`/${locale}/admin/trainees`}>→ العودة إلى المتدربين</Link><span>ملف إداري للعرض والمراجعة</span></div>
      <section className="trainee-hero">
        <div className="hero-identity"><div className="hero-avatar">{String(trainee.name || "م").trim()[0]}</div><div><small>ملف المتدرب</small><h2>{trainee.name}</h2><p>{trainee.email} <span>·</span> {trainee.license}</p></div></div>
        <div className="hero-actions"><span className="supervisor-pill">المشرف: <b>{supervisorSnap?.data()?.name || "غير مسند"}</b></span><TraineeHoursUpdate trainee={{id,name:trainee.name,email:trainee.email,license:trainee.license}} supervisor={supervisorSnap?.exists ? {name:String(supervisorSnap.data()?.name || ""),email:String(supervisorSnap.data()?.email || "")} : null} /><ManageTraineePassword traineeId={id} /></div>
      </section>
      <div className="progress-grid">{cards.map(([label,current,total,color])=>{const percent=Math.min(100,Number(total)?(Number(current)/Number(total))*100:0);return <div className="progress-card" key={String(label)} style={{"--accent":String(color)} as CSSProperties}><div className="progress-card-head"><span>{String(label)}</span><b>{Number(current).toFixed(1).replace(".0","")} <small>/ {String(total)}</small></b></div><div className="progress-track"><i style={{width:`${percent}%`}} /></div><small>{Math.round(percent)}% مكتمل</small></div>})}</div>
      <section className="profile-section"><div className="section-heading"><div><small>معلومات أساسية</small><h3>بيانات المتدرب</h3></div><span>آخر تحديث: {dateOnly(trainee.updatedAt || trainee.createdAt)}</span></div><div className="profile-columns"><div className="detail-group"><h4>بيانات التواصل والترخيص</h4>{identityDetails.map(([k,v,icon])=><div className="detail-row" key={String(k)}><i>{String(icon)}</i><div><small>{String(k)}</small><b>{value(v)}</b></div></div>)}</div><div className="detail-group"><h4>الإسناد وحالة الملف</h4>{enrollmentDetails.map(([k,v,icon])=><div className="detail-row" key={String(k)}><i>{String(icon)}</i><div><small>{String(k)}</small><b>{value(v)}</b></div></div>)}</div></div></section>
      <section style={{background:"white",border:"1px solid #E2E8F0",borderRadius:16,padding:20,marginBottom:16}}><h3 style={{marginTop:0}}>ملخص الملف</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>{[["سجلات الساعات",activities.length],["الحجوزات",bookingsSnap.size],["المستندات",documentsSnap.size],["تقارير التقدم",reportsSnap.size],["تقييمات الكفاءة",assessmentsSnap.size],["الاتفاقية",agreementSnap.exists?"موجودة":"غير موجودة"],["الخطة",planSnap.exists?"موجودة":"غير موجودة"]].map(([k,v])=><div key={String(k)} style={{padding:14,border:"1px solid #E8EDF5",borderRadius:10,textAlign:"center"}}><b style={{fontSize:20}}>{String(v)}</b><div style={{fontSize:11,color:"#64748B"}}>{String(k)}</div></div>)}</div></section>
      <section style={{background:"white",border:"1px solid #E2E8F0",borderRadius:16,padding:20,marginBottom:16}}><h3 style={{marginTop:0}}>ملفات المتدرب</h3>{documents.length ? <div style={{display:"grid",gap:8}}>{documents.map(document=><div key={document.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:12,border:"1px solid #E8EDF5",borderRadius:10,flexWrap:"wrap"}}><div><b>{document.title||document.fileName}</b><div style={{fontSize:11,color:"#64748B",marginTop:4}}>{document.fileName||"—"} · {document.issuedAt||"—"} · {document.status==="reviewed"?"تمت المراجعة":document.status==="replace_required"?"يحتاج استبدال":"بانتظار المراجعة"}</div></div>{document.storageProvider==="google_drive"?<a href={`/api/files?documentId=${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer" style={{color:"#0D40FC",fontWeight:700,textDecoration:"none"}}>عرض الملف ↗</a>:document.fileUrl?<a href={`/api/supervisor/document-upload?path=${encodeURIComponent(document.fileUrl)}`} style={{color:"#0D40FC",fontWeight:700,textDecoration:"none"}}>تنزيل</a>:null}</div>)}</div>:<p style={{fontSize:12,color:"#64748B"}}>لا توجد ملفات مرفوعة بعد.</p>}</section>
      <TraineeMonthlyHours activities={activities} />
    </div>
  </AdminPageLayout>;
}

const css = `.file-topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:13px}.file-topbar a{color:#0D40FC;text-decoration:none;font-size:12px;font-weight:800}.file-topbar span{font-size:10px;color:#94A3B8}.trainee-hero{padding:22px 24px;border-radius:20px;color:white;background:linear-gradient(125deg,#001442,#0D40FC);display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;box-shadow:0 10px 30px #0D40FC18}.hero-identity{display:flex;align-items:center;gap:14px}.hero-avatar{width:54px;height:54px;border-radius:16px;background:#ffffff18;border:1px solid #ffffff28;display:grid;place-items:center;font-size:22px;font-weight:900}.hero-identity small{font-size:10px;color:#9EC5FF}.hero-identity h2{margin:3px 0;font-size:22px}.hero-identity p{margin:0;color:#D6E1FF;font-size:12px}.hero-identity p span{opacity:.45;margin:0 4px}.hero-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.supervisor-pill{padding:9px 13px;border-radius:10px;background:#ffffff12;border:1px solid #ffffff20;font-size:11px}.progress-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin:14px 0}.progress-card{--accent:#0D40FC;background:white;border:1px solid #E2E8F0;border-radius:14px;padding:15px;box-shadow:0 3px 10px #00144208}.progress-card-head{display:flex;justify-content:space-between;align-items:start;gap:7px}.progress-card-head>span{font-size:11px;color:#64748B;font-weight:700}.progress-card-head b{font-size:20px;color:var(--accent);white-space:nowrap}.progress-card-head b small{font-size:11px;color:#94A3B8}.progress-track{height:5px;background:#EEF2F7;border-radius:99px;overflow:hidden;margin:11px 0 6px}.progress-track i{display:block;height:100%;background:var(--accent);border-radius:99px}.progress-card>small{font-size:9px;color:#94A3B8}.profile-section{background:#fff;border:1px solid #E2E8F0;border-radius:17px;padding:20px;margin-bottom:16px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:12px;padding-bottom:14px;border-bottom:1px solid #EEF2F7}.section-heading small{color:#0D40FC;font-size:9px;font-weight:800}.section-heading h3{margin:2px 0 0;color:#001442;font-size:17px}.section-heading>span{font-size:9px;color:#94A3B8}.profile-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-top:16px}.detail-group{border:1px solid #EEF2F7;border-radius:13px;overflow:hidden}.detail-group h4{margin:0;padding:11px 13px;background:#F8FAFC;color:#334155;font-size:11px}.detail-row{display:flex;align-items:center;gap:10px;padding:10px 13px;border-top:1px solid #F1F5F9}.detail-row i{width:28px;height:28px;border-radius:8px;background:#EEF4FF;color:#0D40FC;display:grid;place-items:center;font-style:normal;font-size:11px;flex:0 0 auto}.detail-row div{min-width:0}.detail-row small{display:block;color:#94A3B8;font-size:9px;margin-bottom:2px}.detail-row b{display:block;color:#001442;font-size:11px;overflow-wrap:anywhere}@media(max-width:900px){.progress-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.trainee-hero{align-items:flex-start}.hero-actions{width:100%}.profile-columns{grid-template-columns:1fr}.progress-grid{grid-template-columns:1fr 1fr}.file-topbar span{display:none}}`;
