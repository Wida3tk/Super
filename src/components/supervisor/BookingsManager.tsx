"use client";

import { useState } from "react";

type MeetingStatus = "pending" | "completed" | "missed";

interface Booking {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  date: string;
  time: string;
  meetLink?: string;
  meetingStatus?: MeetingStatus;
}

const COLORS = {
  primary: "#0D40FC", deep: "#001442", success: "#10B981",
  warning: "#EF9F27", danger: "#EF4444",
  gray100: "#F8FAFC", gray200: "#EEF2F7", gray300: "#D1D9E6", gray500: "#8898AA",
};

export default function BookingsManager({ bookings: initialBookings }: { bookings: Booking[] }) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed" | "missed">("upcoming");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  // تصنيف الحجوزات
  const upcoming = bookings.filter(b => {
    const isPast = b.date < today || (b.date === today);
    return !isPast || (!b.meetingStatus || b.meetingStatus === "pending");
  }).filter(b => b.date >= today);

  const completed = bookings.filter(b => b.meetingStatus === "completed");
  const missed = bookings.filter(b => b.meetingStatus === "missed");

  const updateStatus = async (bookingId: string, status: MeetingStatus) => {
    setLoadingId(bookingId);
    try {
      const res = await fetch('/api/supervisor/booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, meetingStatus: status }),
      });
      if (!res.ok) throw new Error('فشل التحديث');
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, meetingStatus: status } : b));
    } catch (e) {
      alert('حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoadingId(null);
    }
  };

  const tabs = [
    { key: "upcoming", label: "القادمة", count: upcoming.length, color: COLORS.primary },
    { key: "completed", label: "تمت", count: completed.length, color: COLORS.success },
    { key: "missed", label: "لم تتم", count: missed.length, color: COLORS.danger },
  ];

  const currentList = activeTab === "upcoming" ? upcoming : activeTab === "completed" ? completed : missed;

  const renderBooking = (b: Booking) => {
    const isPast = b.date < today;
    const isLoading = loadingId === b.id;

    return (
      <div key={b.id} style={{
        background: COLORS.gray100, borderRadius: 10, padding: "12px 14px",
        marginBottom: 8, border: `1px solid ${COLORS.gray200}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>{b.studentName || "—"}</div>
            <div style={{ fontSize: 11, color: COLORS.gray500 }}>{b.studentEmail || "—"}</div>
            {b.meetLink && (
              <a href={b.meetLink} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", fontSize: 11, color: COLORS.success, marginTop: 3, textDecoration: "none" }}>
                🎥 Google Meet
              </a>
            )}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary }}>{b.date}</div>
            <div style={{ fontSize: 11, color: COLORS.gray500 }}>{b.time}</div>
          </div>
        </div>

        {/* أزرار التحديث — تظهر للقادمة واليوم فقط */}
        {activeTab === "upcoming" && (
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              onClick={() => updateStatus(b.id, "completed")}
              disabled={isLoading}
              style={{
                flex: 1, padding: "6px 10px", border: `1px solid ${COLORS.success}`,
                borderRadius: 8, background: "#E1F5EE", color: COLORS.success,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                opacity: isLoading ? 0.6 : 1,
              }}>
              {isLoading ? "..." : "✓ تمت المقابلة"}
            </button>
            <button
              onClick={() => updateStatus(b.id, "missed")}
              disabled={isLoading}
              style={{
                flex: 1, padding: "6px 10px", border: `1px solid ${COLORS.danger}`,
                borderRadius: 8, background: "#FCEBEB", color: COLORS.danger,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                opacity: isLoading ? 0.6 : 1,
              }}>
              {isLoading ? "..." : "✗ لم تتم"}
            </button>
          </div>
        )}

        {/* زر إعادة تعيين للمكتملة والفائتة */}
        {(activeTab === "completed" || activeTab === "missed") && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => updateStatus(b.id, "pending")}
              disabled={isLoading}
              style={{
                padding: "5px 12px", border: `1px solid ${COLORS.gray300}`,
                borderRadius: 8, background: "#fff", color: COLORS.gray500,
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              }}>
              {isLoading ? "..." : "↩ إعادة تعيين"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${COLORS.gray200}`, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.gray200}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(13,64,252,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🗓️</div>
        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.deep }}>المقابلات</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.gray200}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{
              flex: 1, padding: "10px 8px", border: "none", cursor: "pointer",
              borderBottom: activeTab === t.key ? `2px solid ${t.color}` : "2px solid transparent",
              background: "none", fontFamily: "inherit", fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? t.color : COLORS.gray500,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
            {t.label}
            <span style={{
              background: activeTab === t.key ? t.color : COLORS.gray200,
              color: activeTab === t.key ? "#fff" : COLORS.gray500,
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px", maxHeight: 400, overflowY: "auto" }}>
        {currentList.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 6 }}>
              {activeTab === "upcoming" ? "📭" : activeTab === "completed" ? "✅" : "❌"}
            </div>
            <div style={{ color: COLORS.gray500, fontSize: 13 }}>
              {activeTab === "upcoming" ? "لا توجد مقابلات قادمة" : activeTab === "completed" ? "لا توجد مقابلات مكتملة" : "لا توجد مقابلات فائتة"}
            </div>
          </div>
        ) : (
          currentList.map(renderBooking)
        )}
      </div>
    </div>
  );
}
