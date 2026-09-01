import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";

export const dynamic = "force-dynamic";

const SERVICE_LABELS: Record<string, string> = {
  google_calendar: "تقويم Google",
  email: "البريد الإلكتروني",
  data_sync: "مزامنة البيانات",
};

export default async function OperationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await requireAdmin())) redirect(`/${locale}/login?portal=admin`);
  const [incidentsSnapshot, activitiesSnapshot] = await Promise.all([
    adminDb.collection("operationalIncidents").orderBy("createdAt", "desc").limit(100).get(),
    adminDb.collection("activityLog").orderBy("createdAt", "desc").limit(50).get(),
  ]);
  const incidents = incidentsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as any[];
  const activities = activitiesSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as any[];
  const open = incidents.filter((incident) => incident.status === "open");
  return (
    <AdminPageLayout locale={locale} title="المراقبة وسجل التدقيق">
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginBottom:20}}>
        {[
          ["الحوادث المفتوحة",open.length,"#DC2626"],
          ["أعطال البريد",open.filter(i=>i.service==="email").length,"#D97706"],
          ["أعطال التقويم",open.filter(i=>i.service==="google_calendar").length,"#2563EB"],
        ].map(([label,value,color])=><div key={String(label)} style={{background:"#fff",border:"1px solid #E5EAF2",borderRadius:14,padding:18}}><div style={{fontSize:12,color:"#64748B"}}>{label}</div><strong style={{display:"block",fontSize:28,color:String(color),marginTop:6}}>{value}</strong></div>)}
      </div>
      <section style={{background:"#fff",border:"1px solid #E5EAF2",borderRadius:14,padding:18,marginBottom:20}}>
        <h2 style={{fontSize:16,margin:"0 0 14px"}}>الحوادث التشغيلية</h2>
        {incidents.length===0?<p style={{color:"#64748B"}}>لا توجد أعطال مسجلة.</p>:incidents.map(incident=><div key={incident.id} style={{padding:"12px 0",borderBottom:"1px solid #EEF2F7",display:"grid",gridTemplateColumns:"160px 1fr 150px",gap:12}}><strong>{SERVICE_LABELS[incident.service]||incident.service}</strong><span>{incident.operation} · {incident.lastError}</span><small style={{color:"#64748B"}}>{String(incident.createdAt||"").replace("T"," ").slice(0,16)}</small></div>)}
      </section>
      <section style={{background:"#fff",border:"1px solid #E5EAF2",borderRadius:14,padding:18}}>
        <h2 style={{fontSize:16,margin:"0 0 14px"}}>سجل التدقيق الإداري</h2>
        {activities.map(activity=><div key={activity.id} style={{padding:"11px 0",borderBottom:"1px solid #EEF2F7",display:"flex",justifyContent:"space-between",gap:16}}><span>{activity.message||activity.type}</span><small style={{color:"#64748B"}}>{String(activity.createdAt||"").replace("T"," ").slice(0,16)}</small></div>)}
      </section>
    </AdminPageLayout>
  );
}
