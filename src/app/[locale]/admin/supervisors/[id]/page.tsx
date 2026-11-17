import { redirect } from "next/navigation";

// The supervisor's file now opens on «المشرفون». Keep old links working.
export default async function SupervisorFileRedirect({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { locale, id } = await params;
  const { view } = await searchParams;
  redirect(`/${locale}/admin/supervisors?supervisor=${encodeURIComponent(id)}&tab=${view === "schedule" ? "schedule" : "work"}`);
}
