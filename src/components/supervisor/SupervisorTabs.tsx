"use client";

import { useState } from "react";
import BookingsManager from "./BookingsManager";
import SupervisionHours from "./SupervisionHours";

const COLORS = {
  primary: "#0D40FC", deep: "#001442",
  gray200: "#EEF2F7", gray500: "#8898AA",
};

interface Props {
  bookings: any[];
  supervisorId: string;
  initialTrainees: any[];
  initialSessions: any[];
  initialSnapshots: any[];
  upcomingCount: number;
  traineesCount: number;
}

export default function SupervisorTabs({
  bookings, supervisorId, initialTrainees,
  initialSessions, initialSnapshots, upcomingCount, traineesCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<"bookings" | "hours">("bookings");

  const tabs = [
    { key: "bookings", label: "المقابلات", icon: "🗓️", count: upcomingCount },
    { key: "hours", label: "ساعات الإشراف", icon: "⏱️", count: traineesCount },
  ];

  return (
    <div>
      {/* Tab Bar */}
      <div style={{
        display: "flex", background: "#fff", borderRadius: 16,
        border: `1px solid ${COLORS.gray200}`, overflow: "hidden",
        marginBottom: 20, boxShadow: "0 1px 4px rgba(1,20,66,0.05)",
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              flex: 1, padding: "16px 20px", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: activeTab === t.key ? 700 : 400,
              color: activeTab === t.key ? COLORS.primary : COLORS.gray500,
              background: activeTab === t.key ? "#F0F5FF" : "#fff",
              borderBottom: activeTab === t.key ? `3px solid ${COLORS.primary}` : "3px solid transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.count > 0 && (
              <span style={{
                background: activeTab === t.key ? COLORS.primary : COLORS.gray200,
                color: activeTab === t.key ? "#fff" : COLORS.gray500,
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "bookings" && (
        <BookingsManager bookings={bookings} />
      )}

      {activeTab === "hours" && (
        <SupervisionHours
          supervisorId={supervisorId}
          initialTrainees={initialTrainees}
          initialSessions={initialSessions}
          initialSnapshots={initialSnapshots}
        />
      )}
    </div>
  );
}
