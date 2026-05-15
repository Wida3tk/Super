"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const COLORS = {
  primary: "#0D40FC",
  deep: "#001442",
  gray100: "#F8FAFC",
  gray200: "#EEF2F7",
  gray500: "#8898AA",
};

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function AdminSidebar({ locale, notifCount = 0 }: { locale: string; notifCount?: number }) {
  const pathname = usePathname();
  const base = `/${locale}/admin`;

  const sections: NavSection[] = [
    {
      title: "الرئيسية",
      items: [
        { href: `${base}`, icon: "ti-layout-dashboard", label: "الداشبورد" },
        { href: `${base}/notifications`, icon: "ti-bell", label: "الإشعارات", badge: notifCount },
      ],
    },
    {
      title: "الإشراف",
      items: [
        { href: `${base}/trainees`, icon: "ti-users", label: "المتدربون" },
        { href: `${base}/supervisors`, icon: "ti-chart-bar", label: "إنتاجية المشرفين" },
        { href: `${base}/onboarding`, icon: "ti-user-check", label: "البوردنق والإسناد" },
        { href: `${base}/months`, icon: "ti-calendar-stats", label: "إدارة الأشهر" },
      ],
    },
    {
      title: "النظام",
      items: [
        { href: `${base}/bookings`, icon: "ti-calendar", label: "الحجوزات" },
        { href: `${base}/export`, icon: "ti-file-export", label: "التصدير" },
        { href: `${base}/cms`, icon: "ti-settings", label: "الإعدادات" },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === base) return pathname === base || pathname === `${base}/`;
    return pathname.startsWith(href);
  };

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "#fff",
      borderLeft: `0.5px solid ${COLORS.gray200}`,
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "1.25rem 1rem", borderBottom: `0.5px solid ${COLORS.gray200}` }}>
        <img src="/logo.svg" alt="سلوكيرا" style={{ height: 30, width: "auto" }} />
        <div style={{ fontSize: 10, color: COLORS.gray500, marginTop: 4, letterSpacing: "0.06em" }}>لوحة الإدارة</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem 0.5rem" }}>
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontSize: 10, color: COLORS.gray500, padding: "6px 0.75rem 4px", letterSpacing: "0.06em", fontWeight: 500 }}>
              {section.title}
            </div>
            {section.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 0.75rem", borderRadius: 8,
                    fontSize: 13, textDecoration: "none",
                    color: active ? COLORS.primary : COLORS.gray500,
                    background: active ? "#E6F1FB" : "transparent",
                    fontWeight: active ? 500 : 400,
                    marginBottom: 2,
                    transition: "all 0.15s",
                  }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: 16, flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span style={{ background: "#E24B4A", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: "0.75rem 0.5rem", borderTop: `0.5px solid ${COLORS.gray200}` }}>
        <Link href={`/${locale}`}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0.75rem", borderRadius: 8, fontSize: 13, color: COLORS.gray500, textDecoration: "none" }}>
          <i className="ti ti-home" style={{ fontSize: 16 }} aria-hidden="true" />
          الموقع الرئيسي
        </Link>
      </div>
    </aside>
  );
}
