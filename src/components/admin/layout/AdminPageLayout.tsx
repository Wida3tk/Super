import "@/styles/admin.css";
import AdminFrame, { type AdminBadges } from "./AdminSidebar";

/** Counts shown on the sidebar. Only items the admin can act on and clear. */
async function loadBadges(): Promise<AdminBadges> {
  try {
    const { adminDb } = await import("@/lib/firebase/admin");
    const pending = await adminDb.collection("traineeRequests").where("status", "==", "pending").count().get();
    return { trainees: pending.data().count };
  } catch {
    return {};
  }
}

export default async function AdminPageLayout({
  locale,
  title,
  children,
}: {
  locale: string;
  title: string;
  children: React.ReactNode;
  /** @deprecated kept for older call sites; the sidebar loads its own counts. */
  notifCount?: number;
}) {
  const badges = await loadBadges();
  return (
    <AdminFrame locale={locale} title={title} badges={badges} adminEmail={process.env.ADMIN_EMAIL?.trim() || ""}>
      {children}
    </AdminFrame>
  );
}
