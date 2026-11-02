"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import UiIcon from "@/components/ui/UiIcon";
import { ADMIN_SECTIONS, resolveAdminLocation } from "./adminNav";

export type AdminBadges = Partial<Record<string, number>>;

/**
 * The admin frame: sidebar (a drawer below 1024px), top bar with breadcrumb,
 * and the active section's tabs. Every page keeps its own data loading.
 */
export default function AdminFrame({
  locale,
  title,
  badges = {},
  adminEmail = "",
  children,
}: {
  locale: string;
  title: string;
  badges?: AdminBadges;
  adminEmail?: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const base = `/${locale}/admin`;
  const { section, tab, isDetail } = resolveAdminLocation(pathname);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const logout = async () => {
    setLeaving(true);
    try {
      await signOut(auth);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push(`/${locale}/login?portal=admin`);
    } catch {
      setLeaving(false);
    }
  };

  const hrefFor = (path: string) => `${base}${path}`;
  const showTabs = section.tabs.length > 1;
  const notifications = Number(badges.notifications || 0);

  return (
    <div className="sk-admin" dir="rtl" data-nav-open={open}>
      <button type="button" className="sk-overlay" aria-label="إغلاق القائمة" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
      <aside className="sk-side" id="sk-admin-nav" aria-label="قائمة الإدارة">
        <div className="sk-side-brand">
          <Link href={base} aria-label="سلوكيرا — اليوم">
            <img src="/logo.svg" alt="سلوكيرا" />
          </Link>
          <small>الإدارة</small>
          <button type="button" className="sk-icon-btn sk-side-close" aria-label="إغلاق القائمة" onClick={() => setOpen(false)}>
            <UiIcon name="close" size={18} />
          </button>
        </div>
        <nav className="sk-nav">
          {ADMIN_SECTIONS.map((item) => {
            const count = Number(badges[item.key] || 0);
            return (
              <Link
                key={item.key}
                prefetch={false}
                href={hrefFor(item.tabs[0].path)}
                className="sk-nav-item"
                aria-current={item.key === section.key ? "page" : undefined}
              >
                <UiIcon name={item.icon} size={19} />
                <span>{item.label}</span>
                {count > 0 && <em className="sk-nav-count" aria-label={`${count} بانتظار الإجراء`}>{count}</em>}
              </Link>
            );
          })}
        </nav>
        <div className="sk-side-foot">
          <div className="sk-side-user">
            <span className="sk-avatar" aria-hidden="true">إ</span>
            <div style={{ minWidth: 0 }}>
              <b>مدير المنصة</b>
              {adminEmail && <small dir="ltr" style={{ overflow: "hidden", textOverflow: "ellipsis", textAlign: "right" }}>{adminEmail}</small>}
            </div>
          </div>
          <Link href={`/${locale}`} className="sk-nav-item">
            <UiIcon name="globe" size={18} />
            <span>الموقع العام</span>
          </Link>
          <button type="button" className="sk-logout" onClick={logout} disabled={leaving}>
            <UiIcon name="logout" size={18} />
            {leaving ? "جارٍ الخروج…" : "تسجيل الخروج"}
          </button>
        </div>
      </aside>

      <div className="sk-main">
        <header className="sk-top">
          <button
            type="button"
            className="sk-icon-btn sk-menu-btn"
            aria-label="فتح القائمة"
            aria-controls="sk-admin-nav"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <UiIcon name="menu" size={20} />
          </button>
          <div className="sk-top-title">
            <ol className="sk-crumbs" aria-label="مسار الصفحة">
              <li><Link href={base}>الإدارة</Link></li>
              {section.key !== "today" && (
                <li>{isDetail || showTabs ? <Link href={hrefFor(section.tabs[0].path)}>{section.label}</Link> : section.label}</li>
              )}
            </ol>
            <h1>{title}</h1>
          </div>
          <Link
            href={hrefFor("/notifications")}
            className="sk-icon-btn"
            aria-label={notifications ? `الإشعارات: ${notifications} تنبيه للإدارة` : "الإشعارات"}
          >
            <UiIcon name="bell" size={19} />
            {notifications > 0 && <em className="sk-nav-count sk-dot">{notifications}</em>}
          </Link>
        </header>
        {showTabs && (
          <nav className="sk-tabs" aria-label={`أقسام ${section.label}`}>
            {section.tabs.map((item) => (
              <Link
                key={item.path}
                prefetch={false}
                href={hrefFor(item.path)}
                className="sk-tab"
                aria-current={item.path === tab.path && !isDetail ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <main className="sk-content">
          {isDetail && section.key !== "today" && (
            <Link href={hrefFor(tab.path)} className="sk-back">
              <UiIcon name="arrowLeft" size={15} /> العودة إلى {tab.label}
            </Link>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
