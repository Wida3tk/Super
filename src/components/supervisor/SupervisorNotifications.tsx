"use client";

import { useState } from "react";

interface Notification {
  id: string;
  type: "shoutout" | "reminder" | "warning";
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG = {
  shoutout: { emoji: "🎉", bg: "#EEF2FF", color: "#4F46E5", label: "Shoutout" },
  reminder: { emoji: "🔔", bg: "#F0FDF4", color: "#16A34A", label: "تذكير" },
  warning:  { emoji: "⚠️", bg: "#FFF7ED", color: "#EA580C", label: "تنبيه" },
};

const timeAgo = (iso: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
};

export default function SupervisorNotifications({ notifications: initial, supervisorId }: {
  notifications: Notification[];
  supervisorId: string;
}) {
  const [notifications, setNotifications] = useState(initial);
  const unread = notifications.filter(n => !n.read);

  const markRead = async (id: string) => {
    await fetch('/api/supervisor/notification', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await Promise.all(unread.map(n => markRead(n.id)));
  };

  if (notifications.length === 0) return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🔔</div>
      <div style={{ color: "#94A3B8", fontSize: 13 }}>لا توجد إشعارات</div>
    </div>
  );

  return (
    <div style={{ direction: "rtl" }}>
      {unread.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#64748B" }}>{unread.length} غير مقروء</span>
          <button onClick={markAllRead}
            style={{ fontSize: 12, color: "#0D40FC", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            تحديد الكل كمقروء
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications.map(n => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.reminder;
          return (
            <div key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              style={{
                background: n.read ? "#fff" : "#F8FAFF",
                borderRadius: 12, padding: "12px 14px",
                border: `1px solid ${n.read ? "#E2E8F0" : "#C7D2FE"}`,
                display: "flex", gap: 12, alignItems: "flex-start",
                cursor: n.read ? "default" : "pointer",
                transition: "all 0.15s",
              }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {cfg.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0D40FC", display: "inline-block", flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: 13, color: "#1E293B", lineHeight: 1.5 }}>{n.message}</p>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>من الإدارة · {timeAgo(n.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
