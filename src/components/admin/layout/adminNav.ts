// Admin information architecture: six sections, each with its own tabs.
// Every tab points at an existing route, so old links keep working.

export type AdminTab = { path: string; label: string };
export type AdminSection = {
  key: string;
  label: string;
  icon: string;
  tabs: AdminTab[];
  /** Extra path prefixes (detail pages) that belong to this section. */
  match?: string[];
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: "today", label: "اليوم", icon: "home", tabs: [{ path: "", label: "اليوم" }] },
  {
    key: "trainees",
    label: "المتدربون",
    icon: "users",
    tabs: [
      { path: "/trainees", label: "قائمة المتدربين" },
      { path: "/onboarding", label: "طلبات التسجيل" },
      { path: "/assignment", label: "الإسناد والتعاقد" },
      { path: "/trainee-requests", label: "طلبات المتدربين" },
      { path: "/accounts", label: "حسابات المسجلين" },
    ],
    match: ["/import"],
  },
  {
    key: "supervisors",
    label: "المشرفون",
    icon: "user",
    tabs: [
      { path: "/supervisors", label: "الحسابات" },
      { path: "/bookings", label: "المقابلات والحجوزات" },
      { path: "/productivity", label: "الإنتاجية" },
    ],
    match: ["/import-supervisor"],
  },
  { key: "months", label: "الاعتماد الشهري", icon: "calendarCheck", tabs: [{ path: "/months", label: "الاعتماد الشهري" }] },
  { key: "notifications", label: "الإشعارات", icon: "bell", tabs: [{ path: "/notifications", label: "الإشعارات" }] },
  {
    key: "system",
    label: "النظام",
    icon: "settings",
    tabs: [
      { path: "/cms", label: "الإعدادات" },
      { path: "/export", label: "التصدير" },
      { path: "/operations", label: "المراقبة وسجل التدقيق" },
    ],
  },
];

/** Strips the locale and `/admin` prefix: `/ar/admin/trainees/x` → `/trainees/x`. */
export function adminSubpath(pathname: string) {
  const match = pathname.match(/^\/[a-z]{2}\/admin(\/.*)?$/);
  const rest = (match?.[1] || "").replace(/\/+$/, "");
  return rest;
}

const startsWithSegment = (subpath: string, prefix: string) =>
  subpath === prefix || subpath.startsWith(`${prefix}/`);

/** Finds the section and the active tab for an admin path. */
export function resolveAdminLocation(pathname: string) {
  const subpath = adminSubpath(pathname);
  if (!subpath) return { section: ADMIN_SECTIONS[0], tab: ADMIN_SECTIONS[0].tabs[0], isDetail: false };
  for (const section of ADMIN_SECTIONS) {
    for (const tab of section.tabs) {
      if (tab.path && startsWithSegment(subpath, tab.path))
        return { section, tab, isDetail: subpath !== tab.path };
    }
    if (section.match?.some((prefix) => startsWithSegment(subpath, prefix)))
      return { section, tab: section.tabs[0], isDetail: true };
  }
  return { section: ADMIN_SECTIONS[0], tab: ADMIN_SECTIONS[0].tabs[0], isDetail: true };
}
