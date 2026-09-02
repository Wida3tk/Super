import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import NewTraineeRequests from "@/components/admin/NewTraineeRequests";

export default async function OnboardingPage({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;
  const session=(await cookies()).get("__session")?.value;
  if(!session)redirect(`/${locale}/login?portal=admin`);
  const {adminAuth,adminDb}=await import("@/lib/firebase/admin");
  const decoded=await adminAuth.verifySessionCookie(session,true);
  if(decoded.email?.toLowerCase()!==process.env.ADMIN_EMAIL?.toLowerCase())redirect(`/${locale}/login?portal=admin`);
  const snapshot=await adminDb.collection("trainees").get();
  const trainees=snapshot.docs.map(d=>({id:d.id,...d.data()} as any)).filter(t=>t.lifecycleStage==="registered" || (!t.lifecycleStage && t.registrationSource==="self_registration" && t.onboardingStage==="initial_interview"));
  return <AdminPageLayout locale={locale} title="طلبات التسجيل الجديدة"><NewTraineeRequests trainees={trainees} locale={locale}/></AdminPageLayout>;
}
