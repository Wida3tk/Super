// Admin information architecture: six sections, each with its own tabs and colour.
// Every tab points at an existing route, so old links keep working.

export type AdminTab = { path: string; label: string };
export type AdminSection = {
  key: string;
  label: string;
  icon: string;
  /** The section's colour, used on the sidebar, tabs and its pages. */
  color: string;
  tabs: AdminTab[];
  /** Extra path prefixes (detail pages) that belong to this section. */
  match?: string[];
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: "today", label: "الرئيسية", icon: "home", color: "#0d40fc", tabs: [{ path: "", label: "الرئيسية" }] },
  {
    key: "supervisors",
    label: "المشرفون",
    icon: "user",
    color: "#6a46f5",
    tabs: [
      { path: "/supervisors", label: "المشرفون" },
      { path: "/bookings", label: "المقابلات والحجوزات" },
    ],
    // Productivity and the old per-supervisor page now live in the supervisor's file.
    match: ["/import-supervisor", "/productivity"],
  },
  {
    key: "trainees",
    label: "المتدربون",
    icon: "users",
    color: "#0b8f7a",
    tabs: [
      { path: "/trainees", label: "قائمة المتدربين" },
      { path: "/onboarding", label: "الانضمام" },
      { path: "/trainee-requests", label: "طلبات المتدربين" },
      { path: "/assignment", label: "الإسناد والتعاقد" },
      { path: "/accounts", label: "حسابات المسجلين" },
    ],
    match: ["/import"],
  },
  { key: "months", label: "الاعتماد الشهري", icon: "calendarCheck", color: "#d97706", tabs: [{ path: "/months", label: "الاعتماد الشهري" }] },
  { key: "messages", label: "المحادثات", icon: "message", color: "#0891b2", tabs: [{ path: "/messages", label: "المحادثات" }] },
  {
    key: "system",
    label: "الإعدادات",
    icon: "settings",
    color: "#55627a",
    tabs: [
      { path: "/cms", label: "محتوى الموقع" },
      { path: "/notifications", label: "الإشعارات" },
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
