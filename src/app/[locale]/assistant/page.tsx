import { redirect } from "next/navigation";
import { getAuthenticatedAssistant } from "@/lib/auth/assistantAuth";
import AssistantWorkspace from "@/components/admin/AssistantWorkspace";
import "@/styles/assistant.css";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getAuthenticatedAssistant();
  if (!user) redirect(`/${locale}/login?portal=assistant`);
  return <AssistantWorkspace name={user.name} />;
}
