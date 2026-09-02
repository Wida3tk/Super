"use client";

import Link from "next/link";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function TraineePreAssignmentPortal({ trainee, booking, locale }: any) {
  const [decision, setDecision] = useState(trainee.traineeContinuationIntent || booking?.traineeContinuationIntent || "pending");
  const [loading, setLoading] = useState(false);
  const completed = booking?.meetingStatus === "completed";
  const stage = trainee.lifecycleStage || (trainee.status === "paused" ? "approved_pause" : "initial_interview");
  const stageMessages: Record<string, {icon:string; title:string; body:string}> = {
    contracting: { icon:"📝", title:"أنت الآن في مرحلة التعاقد", body:"تعمل الإدارة على تجهيز العقد واستكمال التوقيع والمتطلبات. ستُفتح خدمات الإشراف بعد اكتمال الإجراءات وإسنادك للمشرف." },
    approved_pause: { icon:"⏸️", title:"إشرافك في تأجيل معتمد", body:"تم تعليق خدمات الإشراف مؤقتًا حسب السياسة. ستعود خدماتك عند اعتماد استئنافك من الإدارة." },
    supervisor_transfer: { icon:"🔄", title:"أنت في مرحلة الانتقال إلى مشرف آخر", body:"يتم الآن حفظ انتقال ملفك وساعاتك وإسنادك إلى المشرف الجديد. ستعود الخدمات عند اكتمال الانتقال." },
    platform_suspension: { icon:"⛔", title:"الحساب موقوف من المنصة", body:"خدمات الحساب معلقة حاليًا. يرجى التواصل مع الإدارة لمعرفة المتطلبات اللازمة لاستعادة الخدمة." },
    financial_clearance: { icon:"💳", title:"ملفك في مرحلة المخالصة المالية", body:"تراجع الإدارة المالية الالتزامات وإجراءات الإغلاق. ستظهر لك أي تحديثات عند اكتمال المراجعة." },
    completed: { icon:"🎓", title:"تم إنهاء وإكمال رحلة الإشراف", body:"اكتملت خدمتك، وملفك محفوظ لدى المنصة للرجوع إليه وفق الإجراءات المعتمدة." },
  };
  const stageMessage = stageMessages[stage];
  const choose = async (value: "continue" | "decline") => {
    if (!booking?.id) return;
    setLoading(true);
    const response = await fetch("/api/continuation-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id, decision: value }),
    });
    if (response.ok) setDecision(value);
    setLoading(false);
  };
  return (
    <main dir="rtl" style={{minHeight:"100vh",background:"linear-gradient(145deg,#F4FAFF,#EEF4FF)",fontFamily:"inherit",padding:"28px"}}>
      <header style={{maxWidth:960,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <img src="/logo.svg" alt="سلوكيرا" style={{height:42}} />
        <LogoutButton />
      </header>
      <section style={{maxWidth:720,margin:"12vh auto 0",background:"#fff",border:"1px solid #DCE6F4",borderRadius:24,padding:"40px",boxShadow:"0 22px 65px rgba(0,20,66,.1)",textAlign:"center"}}>
        <div style={{width:58,height:58,borderRadius:18,background:"#EAF0FF",display:"grid",placeItems:"center",margin:"0 auto 18px",fontSize:28}}>{stageMessage?.icon || "👋"}</div>
        <h1 style={{color:"#001442",fontSize:28,margin:"0 0 10px"}}>أهلًا {trainee.name}</h1>
        {stageMessage ? <><h2 style={{color:"#001442",fontSize:22}}>{stageMessage.title}</h2><p style={{color:"#64748B",lineHeight:1.9,maxWidth:560,margin:"0 auto"}}>{stageMessage.body}</p></> : !booking ? <>
          <p style={{color:"#64748B",lineHeight:1.9,margin:"0 auto 24px",maxWidth:540}}>ابدأ باختيار المشرف وحجز المقابلة الأولية. ستُفتح لك خدمات الإشراف وملف الساعات بعد إتمام المقابلة واعتماد الإسناد.</p>
          <Link href={`/${locale}#supervisors`} style={{display:"inline-block",background:"#0D40FC",color:"#fff",padding:"13px 24px",borderRadius:12,textDecoration:"none",fontWeight:800}}>اختيار المشرف وحجز مقابلة</Link>
        </> : !completed ? <>
          <h2 style={{color:"#001442",fontSize:20}}>تم حجز مقابلتك الأولية</h2>
          <p style={{color:"#64748B",lineHeight:1.8}}>موعدك بتاريخ <strong>{booking.date}</strong> الساعة <strong>{booking.time}</strong>. سيظهر قرار الاستمرار هنا بعد أن يسجل المشرف اكتمال المقابلة.</p>
          {booking.meetLink && <a href={booking.meetLink} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:12,color:"#0D40FC",fontWeight:800}}>دخول الاجتماع</a>}
        </> : decision === "pending" ? <>
          <h2 style={{color:"#001442",fontSize:22}}>هل ترغب في الاستمرار مع المشرف؟</h2>
          <p style={{color:"#64748B"}}>سيصل قرارك إلى الإدارة لاستكمال التعاقد والإسناد.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:24,flexWrap:"wrap"}}>
            <button disabled={loading} onClick={()=>choose("continue")} style={{border:0,borderRadius:12,padding:"13px 22px",background:"#0D40FC",color:"#fff",fontWeight:800,cursor:"pointer"}}>أرغب في الاستمرار</button>
            <button disabled={loading} onClick={()=>choose("decline")} style={{border:"1px solid #D5DEEA",borderRadius:12,padding:"13px 22px",background:"#fff",color:"#334155",fontWeight:700,cursor:"pointer"}}>لا أرغب في الاستمرار</button>
          </div>
        </> : <>
          <h2 style={{color:"#001442",fontSize:22}}>{decision === "continue" ? "تم تسجيل رغبتك في الاستمرار" : "تم تسجيل عدم رغبتك في الاستمرار"}</h2>
          <p style={{color:"#64748B",lineHeight:1.8}}>{decision === "continue" ? "ستظهر لوحة الإشراف الكاملة بعد أن تعتمد الإدارة إسنادك للمشرف." : "يمكنك العودة لاختيار مشرف آخر وحجز مقابلة جديدة."}</p>
          {decision === "decline" && <Link href={`/${locale}#supervisors`} style={{color:"#0D40FC",fontWeight:800}}>اختيار مشرف آخر</Link>}
        </>}
      </section>
    </main>
  );
}
