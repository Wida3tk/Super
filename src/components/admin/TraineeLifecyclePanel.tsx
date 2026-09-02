"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { TraineeLifecycleStage } from "@/types";

const STAGES: Array<{ key: TraineeLifecycleStage; label: string; short: string; color: string; icon: string }> = [
  { key: "initial_interview", label: "مرحلة المقابلة الأولية", short: "المقابلة الأولية", color: "#2563EB", icon: "💬" },
  { key: "post_interview", label: "مرحلة ما بعد المقابلة", short: "اتخاذ القرار", color: "#7C3AED", icon: "🤝" },
  { key: "contracting", label: "مرحلة التعاقد", short: "التعاقد", color: "#D97706", icon: "📝" },
  { key: "active_service", label: "مرحلة البدء والاستمرار", short: "البدء والاستمرار", color: "#059669", icon: "🚀" },
  { key: "approved_pause", label: "مرحلة التأجيل المسموح", short: "تأجيل معتمد", color: "#64748B", icon: "⏸️" },
  { key: "supervisor_transfer", label: "مرحلة الانتقال إلى مشرف آخر", short: "انتقال مشرف", color: "#0891B2", icon: "🔄" },
  { key: "platform_suspension", label: "مرحلة الإيقاف من المنصة", short: "موقوف من المنصة", color: "#DC2626", icon: "⛔" },
  { key: "financial_clearance", label: "مرحلة المخالصة المالية", short: "مخالصة مالية", color: "#C2410C", icon: "💳" },
  { key: "completed", label: "مرحلة الإنهاء والإكمال", short: "الإنهاء والإكمال", color: "#0F766E", icon: "🎓" },
];

function stageOf(trainee: any): TraineeLifecycleStage {
  if (trainee.lifecycleStage) return trainee.lifecycleStage;
  if (trainee.status === "active") return "active_service";
  if (trainee.status === "paused") return "approved_pause";
  if (trainee.status === "completed") return "completed";
  if (trainee.onboardingStage === "contracting" || trainee.onboardingStage === "ready_assignment") return "contracting";
  if (["awaiting_decisions", "admin_review", "interview_declined"].includes(trainee.onboardingStage)) return "post_interview";
  return "initial_interview";
}

export default function TraineeLifecyclePanel({ trainees, supervisors, transitions }: { trainees: any[]; supervisors: any[]; transitions: any[] }) {
  const { locale } = useParams<{locale:string}>();
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [supervisor, setSupervisor] = useState("all");
  const [license, setLicense] = useState("all");
  const [busy, setBusy] = useState("");
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const movements = useMemo(() => transitions.filter(item => String(item.changedMonth || item.changedAt || "").slice(0,7) === month), [transitions,month]);
  const visible = trainees.filter(t => {
    const q=search.trim().toLowerCase();
    return (selectedStage === "all" || stageOf(t) === selectedStage) && (supervisor === "all" || t.currentSupervisorId === supervisor) && (license === "all" || t.license === license) && (!q || [t.name,t.email,t.phone].some(v=>String(v||"").toLowerCase().includes(q)));
  });
  async function move(trainee:any, nextStage:string){
    const current=stageOf(trainee); if(current===nextStage)return;
    const reason=window.prompt(`سبب نقل ${trainee.name} إلى ${STAGES.find(s=>s.key===nextStage)?.short}:`); if(reason===null)return;
    setBusy(trainee.id); const response=await fetch("/api/admin/trainee",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({traineeId:trainee.id,action:"updateLifecycle",stage:nextStage,reason})});
    setBusy(""); if(response.ok)location.reload(); else alert("تعذر تحديث المرحلة");
  }
  async function cleanupDemoTrainees(){setCleanupBusy(true);const response=await fetch("/api/admin/cleanup-trainees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation:"KEEP_REHAB_AND_OSAMA_ONLY"})});const result=await response.json();if(response.ok){alert(`تم حذف ${result.removed.length} متدربين والإبقاء على رحاب وأسامة`);location.reload();}else{alert(result.error||"تعذر الحذف");setCleanupBusy(false);}}
  return <div dir="rtl">
    <section style={{background:"linear-gradient(125deg,#001442,#0D40FC)",borderRadius:18,padding:20,color:"white",marginBottom:16,display:"flex",justifyContent:"space-between",gap:15,flexWrap:"wrap"}}><div><h2 style={{margin:"0 0 5px",fontSize:20}}>رحلة المتدربين التشغيلية</h2><p style={{margin:0,color:"#C7D7FF",fontSize:13}}>تظهر خدمات المنصة فقط للمتدرب الموجود في مرحلة البدء والاستمرار.</p></div><div style={{display:"flex",gap:8,alignItems:"end"}}>{trainees.length>2&&<button disabled={cleanupBusy} onClick={()=>void cleanupDemoTrainees()} style={{padding:"9px 12px",borderRadius:9,border:"1px solid #ffffff44",background:"#DC2626",color:"white",fontWeight:800,cursor:"pointer"}}>حذف البيانات التجريبية</button>}<label style={{fontSize:13}}>حركة شهر <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{display:"block",marginTop:5,padding:"8px 10px",borderRadius:9,border:0}}/></label></div></section>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginBottom:20}}>{STAGES.map(stage=>{const total=trainees.filter(t=>stageOf(t)===stage.key).length;const entered=movements.filter(m=>m.toStage===stage.key).length;const left=movements.filter(m=>m.fromStage===stage.key).length;return <button key={stage.key} onClick={()=>setSelectedStage(selectedStage===stage.key?"all":stage.key)} style={{textAlign:"right",background:selectedStage===stage.key?"#F1F5FF":"white",border:`1px solid ${selectedStage===stage.key?stage.color:"#E2E8F0"}`,borderTop:`3px solid ${stage.color}`,borderRadius:15,padding:17,cursor:"pointer",fontFamily:"inherit",minHeight:125}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:20}}>{stage.icon}</span><b style={{fontSize:27,color:stage.color}}>{total}</b></div><div style={{fontWeight:800,color:"#001442",fontSize:14,margin:"9px 0"}}>{stage.short}</div><div style={{fontSize:12,color:"#64748B"}}>هذا الشهر: <span style={{color:"#059669",fontWeight:700}}>+{entered} دخل</span> · <span style={{color:"#DC2626",fontWeight:700}}>-{left} غادر</span></div></button>})}</div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",background:"white",border:"1px solid #E2E8F0",padding:12,borderRadius:13,marginBottom:12}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد أو الجوال..." style={{flex:"1 1 260px",padding:10,border:"1px solid #CBD5E1",borderRadius:9}}/><select value={supervisor} onChange={e=>setSupervisor(e.target.value)} style={{padding:10,border:"1px solid #CBD5E1",borderRadius:9}}><option value="all">كل المشرفين</option>{supervisors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={license} onChange={e=>setLicense(e.target.value)} style={{padding:10,border:"1px solid #CBD5E1",borderRadius:9}}><option value="all">كل الرخص</option><option value="QASP-S">QASP-S</option><option value="QBA">QBA</option></select><b style={{alignSelf:"center",color:"#64748B",fontSize:12}}>{visible.length} متدرب</b></div>
    <div style={{background:"white",border:"1px solid #E2E8F0",borderRadius:15,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:950}}><thead><tr style={{background:"#F8FAFC"}}>{["المتدرب","المرحلة الحالية","منذ","المشرف","الرخصة","تقدم الإشراف","نقل المرحلة"].map(h=><th key={h} style={{padding:12,textAlign:"right",fontSize:11,color:"#64748B"}}>{h}</th>)}</tr></thead><tbody>{visible.map(t=>{const stage=STAGES.find(s=>s.key===stageOf(t))!;const sup=supervisors.find(s=>s.id===t.currentSupervisorId);const target=Number(t.supervisionTargetHours|| (t.license==="QBA"?100:50));const done=Number(t.approvedSupervisionHours||0);return <tr key={t.id} style={{borderTop:"1px solid #EEF2F7"}}><td style={{padding:12}}><Link href={`/${locale}/admin/trainees/${t.id}`} style={{fontWeight:800,color:"#001442",textDecoration:"none"}}>{t.name}</Link><small style={{display:"block",color:"#94A3B8"}}>{t.email}</small></td><td style={{padding:12}}><span style={{background:`${stage.color}15`,color:stage.color,padding:"5px 9px",borderRadius:99,fontSize:11,fontWeight:700}}>{stage.short}</span></td><td style={{padding:12,fontSize:11,color:"#64748B"}}>{String(t.lifecycleStageChangedAt||t.updatedAt||t.createdAt||"").slice(0,10)||"—"}</td><td style={{padding:12}}>{sup?.name||"—"}</td><td style={{padding:12}}>{t.license}</td><td style={{padding:12}}><b>{done} / {target}</b><div style={{width:90,height:5,background:"#E2E8F0",borderRadius:9,marginTop:5}}><div style={{width:`${Math.min(100,(done/target)*100)}%`,height:"100%",background:"#0D40FC",borderRadius:9}}/></div></td><td style={{padding:12}}><select disabled={busy===t.id} value={stage.key} onChange={e=>void move(t,e.target.value)} style={{padding:7,border:"1px solid #CBD5E1",borderRadius:8,maxWidth:170}}>{STAGES.map(s=><option key={s.key} value={s.key}>{s.short}</option>)}</select></td></tr>})}</tbody></table>{!visible.length&&<p style={{padding:30,textAlign:"center",color:"#64748B"}}>لا توجد نتائج مطابقة.</p>}</div>
  </div>;
}
