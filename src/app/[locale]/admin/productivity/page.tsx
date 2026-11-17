import { redirect } from "next/navigation";

// Productivity now lives in each supervisor's file on «المشرفون». Keep the URL working.
export default async function ProductivityRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/admin/supervisors`);
}
