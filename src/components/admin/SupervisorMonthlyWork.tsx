"use client";
import { useMemo, useState } from "react";

const MONTHS=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const num=(v:unknown)=>Number(v||0);
const monthOf=(x:any)=>String(x.month||x.date||x.issuedAt||x.createdAt||"").slice(0,7);

export default function SupervisorMonthlyWork({supervisor,trainees,activities,sessions,minutes,documents}:{supervisor:any;trainees:any[];activities:any[];sessions:any[];minutes:any[];documents:any[]}){
  const months=useMemo(()=>Array.from(new Set([...activities,...sessions,...minutes,...documents].map(monthOf).filter(x=>/^\d{4}-\d{2}$/.test(x)))).sort().reverse(),[activities,sessions,minutes,documents]);
  const [selected,setSelected]=useState(months[0]||"");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<"remaining"|"cumulative"|"name">("remaining");
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const toggle=(id:string)=>setExpanded(e=>({...e,[id]:!e[id]}));
  const label=(m:string)=>{const [y,i]=m.split("-");return `${MONTHS[Number(i)-1]||i} ${y}`};
  const inMonth=(items:any[])=>items.filter(x=>monthOf(x)===selected);
  const monthActivities=inMonth(activities).filter(x=>x.status==="approved");
  const monthSessions=inMonth(sessions),monthMinutes=inMonth(minutes),monthDocuments=inMonth(documents);
  const individual=monthActivities.filter(x=>String(x.activityType||"").startsWith("supervision_")&&String(x.format||"").toLowerCase()!=="group").reduce((n,x)=>n+num(x.duration),0);
  const group=monthActivities.filter(x=>String(x.activityType||"").startsWith("supervision_")&&String(x.format||"").toLowerCase()==="group").reduce((n,x)=>n+num(x.duration),0);

  // صف محسوب لكل متدرب: ساعات الشهر، فردي/جماعي، التراكمي، الهدف والمتبقي — نفس منطق ملف الإكسل الأصلي
  const rows=trainees.map(t=>{
    const a=monthActivities.filter(x=>x.traineeId===t.id);
    const fw=a.filter(x=>!String(x.activityType||"").startsWith("supervision_")).reduce((n,x)=>n+num(x.duration),0);
    const ind=a.filter(x=>String(x.activityType||"").startsWith("supervision_")&&String(x.format||"").toLowerCase()!=="group").reduce((n,x)=>n+num(x.duration),0);
    const grp=a.filter(x=>String(x.activityType||"").startsWith("supervision_")&&String(x.format||"").toLowerCase()==="group").reduce((n,x)=>n+num(x.duration),0);
    const cumulative=activities.filter(x=>x.traineeId===t.id&&x.status==="approved"&&String(x.activityType||"").startsWith("supervision_")).reduce((n,x)=>n+num(x.duration),0);
    const target=Number(t.supervisionTargetHours||(/QBA/i.test(String(t.license||""))&&!/QASP/i.test(String(t.license||""))?100:50));
    const remaining=Math.max(0,target-cumulative);
    const sessionsCount=monthSessions.filter(x=>x.traineeId===t.id||(x.traineeIds||[]).includes(t.id)).length;
    return {trainee:t,fw,ind,grp,cumulative,target,remaining,sessionsCount};
  });

  const reachedTarget=rows.filter(r=>r.remaining===0&&r.target>0).length;
  const totalRemaining=rows.reduce((n,r)=>n+r.remaining,0);

  const searchQuery=search.trim().toLowerCase();
  const filteredRows=searchQuery?rows.filter(r=>`${r.trainee.name||""} ${r.trainee.license||""}`.toLowerCase().includes(searchQuery)):rows;
  const visibleRows=[...filteredRows].sort((a,b)=>{
    if(sort==="name") return String(a.trainee.name||"").localeCompare(String(b.trainee.name||""),"ar");
    if(sort==="cumulative") return b.cumulative-a.cumulative;
    return b.remaining-a.remaining;
  });

  const detailRows=[...monthSessions.map(x=>({...x,kind:"جلسة"})),...monthMinutes.map(x=>({...x,kind:"محضر اجتماع"})),...monthActivities.filter(x=>String(x.activityType||"").startsWith("supervision_")).map(x=>({...x,kind:"ساعات إشراف"})),...monthDocuments.map(x=>({...x,kind:"مستند"}))].sort((a,b)=>String(b.date||b.createdAt||"").localeCompare(String(a.date||a.createdAt||"")));
  const detailGroups=visibleRows.map(({trainee})=>({trainee,rows:detailRows.filter(row=>row.traineeId===trainee.id||(row.traineeIds||[]).includes(trainee.id))})).filter(group=>group.rows.length);

  return <section dir="rtl" style={{marginBottom:18}}>
    <div style={{background:"linear-gradient(125deg,#001442,#0D40FC)",color:"white",borderRadius:18,padding:"20px 24px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><small style={{color:"#8FE8FF"}}>سجل المشرف الشهري</small><h2 style={{margin:"5px 0"}}>{supervisor.name}</h2><span style={{color:"#D6E1FF",fontSize:12}}>{supervisor.email}</span></div><a href="#schedule" style={{color:"#001442",background:"white",textDecoration:"none",padding:"9px 13px",borderRadius:9,fontSize:12,fontWeight:700}}>إدارة المواعيد والمقاعد</a></div>
    <div style={{background:"white",border:"1px solid #E2E8F0",borderRadius:16,overflow:"hidden"}}>
      <div style={{padding:"17px 18px 12px"}}><h3 style={{margin:0,color:"#001442"}}>المتابعة حسب الشهر</h3><p style={{fontSize:12,color:"#64748B",margin:"5px 0 0"}}>بنفس تنظيم ملف المشرف: اختر الشهر لمراجعة جميع المتدربين والجلسات المسجلة خلاله.</p></div>
      <div style={{display:"flex",gap:7,overflowX:"auto",padding:"0 18px 13px",borderBottom:"1px solid #E2E8F0"}}>{months.map(m=><button key={m} onClick={()=>setSelected(m)} style={{whiteSpace:"nowrap",border:selected===m?"1px solid #0D40FC":"1px solid #DCE5F0",background:selected===m?"#0D40FC":"#F8FAFC",color:selected===m?"white":"#475569",padding:"9px 14px",borderRadius:9,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>{label(m)}</button>)}</div>
      {!selected?<p style={{padding:30,textAlign:"center",color:"#64748B"}}>لا توجد بيانات شهرية مسجلة.</p>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:9,padding:16,background:"#F8FAFC"}}>{[["فردي",individual,"#0D40FC"],["جماعي",group,"#7C3AED"],["إجمالي الإشراف",individual+group,"#059669"],["متدربون بلغوا الهدف",`${reachedTarget}/${trainees.length}`,"#0891B2"],["إجمالي المتبقي (كل المتدربين)",totalRemaining,"#C2410C"]].map(([l,v,c])=><div key={String(l)} style={{background:"white",border:"1px solid #E2E8F0",borderRight:`4px solid ${c}`,borderRadius:11,padding:12}}><b style={{display:"block",fontSize:22,color:String(c)}}>{String(v)}</b><span style={{fontSize:11,color:"#64748B"}}>{String(l)}</span></div>)}</div>
      <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",padding:"0 16px 14px"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث بالاسم أو الرخصة" style={{border:"1px solid #DCE5F0",background:"#F8FAFC",borderRadius:9,padding:"9px 12px",fontFamily:"inherit",fontSize:13,minWidth:220,flex:"1 1 220px"}}/>
        <select value={sort} onChange={e=>setSort(e.target.value as any)} style={{border:"1px solid #DCE5F0",background:"#F8FAFC",borderRadius:9,padding:"9px 12px",fontFamily:"inherit",fontSize:13}}>
          <option value="remaining">ترتيب: الأكثر احتياجاً للساعات</option>
          <option value="cumulative">ترتيب: الأكثر ساعات مكتسبة</option>
          <option value="name">ترتيب: الاسم</option>
        </select>
      </div>
      <div style={{overflowX:"auto",maxHeight:520,overflowY:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1080,fontSize:13}}><thead><tr style={{background:"#EAF0F8",position:"sticky",top:0,zIndex:1}}>{["المتدرب","الرخصة","الحالة","ساعات العمل بالشهر","فردي بالشهر","جماعي بالشهر","إشراف هذا الشهر","الإجمالي التراكمي","الهدف","المتبقي","الجلسات","الملف"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{visibleRows.map(({trainee:t,fw,ind,grp,cumulative,target,remaining,sessionsCount})=><tr key={t.id} style={{borderTop:"1px solid #EEF2F7"}}><td style={{...td,fontWeight:800,color:"#001442"}}>{t.name}</td><td style={td}>{t.license||"—"}</td><td style={td}>{t.lifecycleStageLabel||t.status||"مستمر"}</td><td style={td}>{fw}</td><td style={td}>{ind}</td><td style={td}>{grp}</td><td style={{...td,fontWeight:800,color:"#0D40FC"}}>{ind+grp}</td><td style={{...td,fontWeight:900,color:"#047857",background:"#F0FDF8"}}>{cumulative}</td><td style={td}>{target}</td><td style={{...td,color:remaining?"#C2410C":"#047857",fontWeight:800}}>{remaining}</td><td style={td}>{sessionsCount}</td><td style={td}><a href={`/ar/admin/trainees/${t.id}`} style={{color:"#0D40FC",textDecoration:"none",fontWeight:700}}>فتح ←</a></td></tr>)}{!visibleRows.length&&<tr><td colSpan={12} style={{...td,textAlign:"center",padding:26,color:"#64748B"}}>لا توجد نتائج مطابقة للبحث</td></tr>}</tbody></table></div>
      <div style={{padding:18,borderTop:"8px solid #F1F5F9",background:"#F8FAFC"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14}}><div><h3 style={{margin:0,color:"#001442"}}>جلسات {label(selected)}</h3><p style={{margin:"4px 0 0",fontSize:11,color:"#64748B"}}>مرتبة في ملف مستقل لكل متدرب — اضغط على اسم المتدرب لعرض التفاصيل.</p></div><span style={{background:"#E8EEFF",color:"#0D40FC",padding:"6px 10px",borderRadius:99,fontSize:11,fontWeight:700}}>{detailRows.length} سجل</span></div><div style={{display:"grid",gap:10}}>{detailGroups.map(({trainee,rows})=>{const supervisionRows=rows.filter(x=>x.kind==="ساعات إشراف");const ind=supervisionRows.filter(x=>String(x.format||"").toLowerCase()!=="group").reduce((n,x)=>n+num(x.duration),0);const grp=supervisionRows.filter(x=>String(x.format||"").toLowerCase()==="group").reduce((n,x)=>n+num(x.duration),0);const open=!!expanded[trainee.id];return <article key={trainee.id} style={{background:"white",border:"1px solid #DCE5F0",borderRadius:14,overflow:"hidden"}}><header onClick={()=>toggle(trainee.id)} style={{padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",borderBottom:open?"1px solid #EEF2F7":"none",cursor:"pointer"}}><div><span style={{color:"#001442",fontWeight:800}}>{open?"▾":"◂"} {trainee.name}</span><small style={{display:"block",color:"#64748B",marginTop:3}}>{trainee.license||"—"} · {rows.length} سجلات</small></div><div style={{display:"flex",gap:7,alignItems:"center"}}><span style={metric}>فردي <b>{ind}</b></span><span style={{...metric,background:"#F5F3FF",color:"#6D28D9"}}>جماعي <b>{grp}</b></span><span style={{...metric,background:"#ECFDF5",color:"#047857"}}>الإجمالي <b>{ind+grp}</b></span><a href={`/ar/admin/trainees/${trainee.id}`} onClick={e=>e.stopPropagation()} style={{color:"#0D40FC",textDecoration:"none",fontWeight:700,fontSize:12}}>فتح الملف ←</a></div></header>{open&&<div style={{padding:"9px 15px"}}>{rows.map((x,i)=><div key={`${x.kind}-${x.id||i}`} style={{display:"grid",gridTemplateColumns:"105px 95px 85px minmax(180px,1fr)",gap:10,alignItems:"center",padding:"9px 0",borderBottom:i===rows.length-1?"none":"1px solid #F1F5F9",fontSize:12}}><b style={{color:"#001442"}}>{String(x.date||x.createdAt||"—").slice(0,10)}</b><span style={{color:x.kind==="ساعات إشراف"?"#0D40FC":"#7C3AED",fontWeight:700}}>{x.kind}</span><span style={{color:"#475569"}}>{x.duration?`${x.duration} ساعة`:x.status||x.type||"—"}</span><span style={{color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={x.description||x.discussion||x.title||x.notes||""}>{x.description||x.discussion||x.title||x.notes||"—"}</span></div>)}</div>}</article>})}{!detailGroups.length&&<p style={{textAlign:"center",color:"#64748B",padding:20}}>لا توجد جلسات أو محاضر مسجلة تطابق البحث في هذا الشهر.</p>}</div></div></>}</div>
  </section>;
}
const th:React.CSSProperties={padding:11,textAlign:"right",color:"#475569",fontSize:12,whiteSpace:"nowrap"};
const td:React.CSSProperties={padding:12,color:"#475569",whiteSpace:"nowrap"};
const metric:React.CSSProperties={background:"#EEF3FF",color:"#0D40FC",padding:"6px 9px",borderRadius:8,fontSize:10,display:"flex",gap:5,alignItems:"center"};
