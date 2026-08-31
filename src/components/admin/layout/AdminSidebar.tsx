"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  emoji?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function AdminSidebar({
  locale,
  notifCount = 0,
}: {
  locale: string;
  notifCount?: number;
}) {
  const pathname = usePathname();
  const base = `/${locale}/admin`;

  const sections: NavSection[] = [
    {
      title: "الرئيسية",
      items: [
        {
          href: `${base}`,
          icon: "ti-layout-dashboard",
          label: "لوحة التحكم",
          emoji: "🏠",
        },
        {
          href: `${base}/notifications`,
          icon: "ti-bell",
          label: "الإشعارات",
          badge: notifCount,
          emoji: "🔔",
        },
      ],
    },
    {
      title: "الإشراف",
      items: [
        {
          href: `${base}/trainees`,
          icon: "ti-users",
          label: "المتدربون",
          emoji: "👥",
        },
        {
          href: `${base}/supervisors`,
          icon: "ti-chart-bar",
          label: "إنتاجية المشرفين",
          emoji: "📊",
        },
        {
          href: `${base}/onboarding`,
          icon: "ti-user-check",
          label: "طلبات الانضمام والإسناد",
          emoji: "🎯",
        },
        {
          href: `${base}/months`,
          icon: "ti-calendar-stats",
          label: "إدارة الأشهر",
          emoji: "📅",
        },
      ],
    },
    {
      title: "النظام",
      items: [
        {
          href: `${base}/accounts`,
          icon: "ti-user-cog",
          label: "حسابات المسجلين",
          emoji: "👤",
        },
        {
          href: `${base}/trainee-requests`,
          icon: "ti-file-description",
          label: "طلبات المتدربين",
          emoji: "📨",
        },
        {
          href: `${base}/bookings`,
          icon: "ti-calendar",
          label: "الحجوزات",
          emoji: "📋",
        },
        {
          href: `${base}/export`,
          icon: "ti-file-export",
          label: "التصدير",
          emoji: "📤",
        },
        {
          href: `${base}/cms`,
          icon: "ti-settings",
          label: "الإعدادات",
          emoji: "⚙️",
        },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === base) return pathname === base || pathname === `${base}/`;
    return pathname.startsWith(href);
  };

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "linear-gradient(180deg, #001442 0%, #021B56 100%)",
        borderLeft: "1px solid rgba(255,255,255,.08)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        boxShadow: "-8px 0 30px rgba(0,20,66,.12)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "22px 18px 18px",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <img
          src="/logo.svg"
          alt="سلوكيرا"
          style={{
            height: 32,
            width: "auto",
            filter: "brightness(0) invert(1)",
          }}
        />
        <div
          style={{
            fontSize: 10,
            color: "#55D7FF",
            marginTop: 14,
            background: "rgba(85,215,255,.08)",
            border: "1px solid rgba(85,215,255,.16)",
            padding: "2px 8px",
            borderRadius: 99,
            display: "inline-block",
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          لوحة الإدارة
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: "4px" }}>
            <div
              style={{
                fontSize: 10,
                color: "rgba(85,215,255,.58)",
                padding: "8px 8px 4px",
                letterSpacing: "0.08em",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {section.title}
            </div>
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "9px 10px",
                    borderRadius: 10,
                    fontSize: 13,
                    textDecoration: "none",
                    color: active ? "#fff" : "rgba(255,255,255,.65)",
                    background: active
                      ? "linear-gradient(135deg,#0D40FC,#315DFF)"
                      : "transparent",
                    fontWeight: active ? 700 : 400,
                    marginBottom: 2,
                    transition: "all 0.15s",
                    border: active
                      ? "1px solid rgba(85,215,255,.35)"
                      : "1px solid transparent",
                  }}
                  onMouseOver={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,.07)";
                  }}
                  onMouseOut={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {item.emoji}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      style={{
                        background: "#FF5D6C",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 99,
                        minWidth: 18,
                        textAlign: "center",
                      }}
                    >
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
      <div
        style={{
          padding: "12px 10px",
          borderTop: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <Link
          href={`/${locale}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 10px",
            borderRadius: 10,
            fontSize: 13,
            color: "rgba(255,255,255,.55)",
            textDecoration: "none",
            transition: "all 0.15s",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,.07)";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <span style={{ fontSize: 16 }}>🌐</span>
          <span>الموقع الرئيسي</span>
        </Link>
      </div>
    </aside>
  );
}
