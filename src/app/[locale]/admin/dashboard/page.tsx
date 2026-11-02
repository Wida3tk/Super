import { redirect } from "next/navigation";

// The old duplicate dashboard. "اليوم" at /admin replaces it; keep the URL working.
export default async function AdminDashboardRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/admin`);
}
