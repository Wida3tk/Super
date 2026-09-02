import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const KEEP = new Set(["rehabalsalmi22@gmail.com", "osamaalsegaih@gmail.com"]);
const RELATED = ["fieldworkActivities","monthlySnapshots","monthlyApprovals","supervisionPlans","supervisionPlanVersions","supervisionDocuments","supervisionAgreements","assignments","performanceImprovementPlans","progressReports","competencyAssessments","meetingMinutes","traineeRequests","financialPlans","notifications","traineeLifecycleTransitions"];

export async function POST(request:NextRequest){
  if(!(await requireAdmin()))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
  const body=await request.json(); if(body.confirmation!=="KEEP_REHAB_AND_OSAMA_ONLY")return NextResponse.json({error:"CONFIRMATION_REQUIRED"},{status:400});
  const snapshot=await adminDb.collection("trainees").get();
  const removed:any[]=[]; const skipped:any[]=[];
  for(const doc of snapshot.docs){
    const data=doc.data() as any; const email=String(data.email||"").trim().toLowerCase();
    if(KEEP.has(email)){skipped.push({id:doc.id,email});continue;}
    if(email===process.env.ADMIN_EMAIL?.trim().toLowerCase())return NextResponse.json({error:"ADMIN_ACCOUNT_IN_TRAINEES",id:doc.id},{status:409});
    const refs:any[]=[doc.ref];
    for(const collection of RELATED){
      if(collection==="financialPlans"||collection==="supervisionPlans"||collection==="supervisionAgreements")refs.push(adminDb.collection(collection).doc(doc.id));
      else (await adminDb.collection(collection).where("traineeId","==",doc.id).get()).docs.forEach(item=>refs.push(item.ref));
    }
    (await adminDb.collection("sessions").where("traineeIds","array-contains",doc.id).get()).docs.forEach(item=>refs.push(item.ref));
    (await adminDb.collection("bookings").where("studentEmail","==",email).get()).docs.forEach(item=>refs.push(item.ref));
    for(let index=0;index<refs.length;index+=400){const batch=adminDb.batch();refs.slice(index,index+400).forEach(ref=>batch.delete(ref));await batch.commit();}
    if(data.authUid){try{const user=await adminAuth.getUser(String(data.authUid));if(user.email?.toLowerCase()!==process.env.ADMIN_EMAIL?.toLowerCase())await adminAuth.deleteUser(user.uid);}catch(error:any){if(error?.code!=="auth/user-not-found")console.error("Auth cleanup failed",error);}}
    removed.push({id:doc.id,email,name:data.name,relatedDocuments:refs.length-1});
  }
  return NextResponse.json({ok:true,removed,kept:skipped});
}
