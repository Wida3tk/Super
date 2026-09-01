import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/serverAuth";
import LegacyImportClient from "@/components/admin/LegacyImportClient";

export default async function LegacyImportPage() {
  if (!(await requireAdmin())) redirect("/ar/login?portal=admin");
  return <LegacyImportClient />;
}
