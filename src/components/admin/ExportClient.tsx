"use client";

import { useState } from "react";

const COLORS = {
  primary: "#0D40FC", deep: "#001442", success: "#10B981",
  gray100: "#F8FAFC", gray200: "#E2E8F0", gray500: "#64748B",
};

const MONTHS_AR: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};
const formatMonth = (m: string) => { const [y, mon] = m.split("-"); return `${MONTHS_AR[mon] || mon} ${y}`; };

const STATUS_LABELS: Record<string, string> = {
  active: "نشط", onboarding: "بوردنق", paused: "مؤجل", withdrawn: "منسحب", completed: "مكتمل"
};

export default function ExportClient({ supervisors, trainees, snapshots, bookings, sessions, currentMonth }: {
  supervisors: any[]; trainees: any[]; snapshots: any[];
  bookings: any[]; sessions: any[]; currentMonth: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const allMonths = [...new Set(snapshots.map(s => s.month))].sort().reverse();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const exportXLSX = async (type: string) => {
    setLoading(type);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (type === "trainees") {
        const data = trainees.map(t => {
          const sup = supervisors.find(s => s.id === t.currentSupervisorId);
          return {
            "الاسم": t.name, "الإيميل": t.email, "الجوال": t.phone,
            "الرخصة": t.license, "الساعات المطلوبة": t.requiredHours,
            "فردية (إجمالي)": t.totalIndividualHours || 0,
            "جماعية (إجمالي)": t.totalGroupHours || 0,
            "الإجمالي": t.totalHours || 0,
            "المتبقي": (t.requiredHours || 0) - (t.totalHours || 0),
            "المشرف": sup?.name || "—",
            "الحالة": STATUS_LABELS[t.status] || t.status,
            "تاريخ الإضافة": t.createdAt?.split("T")[0] || "—",
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "المتدربون");
        XLSX.writeFile(wb, `تقرير-المتدربين-${new Date().toISOString().split("T")[0]}.xlsx`);

      } else if (type === "supervisors_month") {
        const monthSnaps = snapshots.filter(s => s.month === selectedMonth);
        const data = supervisors.map(sup => {
          const supSnaps = monthSnaps.filter(s => s.supervisorId === sup.id);
          const totalInd = supSnaps.reduce((a, s) => a + (s.individualHours || 0), 0);
          const totalGrp = supSnaps.reduce((a, s) => a + (s.groupHours || 0), 0);
          return {
            "المشرف": sup.name, "الإيميل": sup.email,
            "عدد المتدربين": trainees.filter(t => t.currentSupervisorId === sup.id && t.status === "active").length,
            "فردية": totalInd, "جماعية": totalGrp, "الإجمالي": totalInd + totalGrp,
            "الشهر": formatMonth(selectedMonth),
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "إنتاجية المشرفين");

        // تفصيل لكل مشرف
        supervisors.forEach(sup => {
          const supTrainees = trainees.filter(t => t.currentSupervisorId === sup.id);
          if (supTrainees.length === 0) return;
          const detail = supTrainees.map(t => {
            const snap = monthSnaps.find(s => s.traineeId === t.id && s.supervisorId === sup.id);
            return {
              "المتدرب": t.name, "الرخصة": t.license,
              "ساعات العمل": snap?.workHours || 0,
              "المطلوب 5%": snap?.requiredHours || 0,
              "فردية": snap?.individualHours || 0,
              "جماعية": snap?.groupHours || 0,
              "الإجمالي": snap?.totalHours || 0,
              "نسبة الجماعية": snap?.groupPercentage ? `${snap.groupPercentage}%` : "0%",
              "غيابات": snap?.absenceCount || 0,
              "إنذارات": snap?.warningCount || 0,
            };
          });
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), sup.name?.slice(0, 28) || sup.id);
        });
        XLSX.writeFile(wb, `إنتاجية-المشرفين-${selectedMonth}.xlsx`);

      } else if (type === "bookings") {
        const data = bookings.map(b => ({
          "الطالب": b.studentName, "الإيميل": b.studentEmail,
          "الجوال": b.studentPhone || "—",
          "التاريخ": b.date, "الوقت": b.time,
          "المشرف": supervisors.find(s => s.id === b.supervisorId)?.name || b.supervisorId,
          "الحالة": b.status === "confirmed" ? "مؤكد" : b.status === "cancelled" ? "ملغى" : "معلق",
          "حالة المقابلة": b.meetingStatus === "completed" ? "تمت" : b.meetingStatus === "missed" ? "لم تتم" : "معلقة",
          "رابط Meet": b.meetLink || "—",
          "تاريخ الحجز": b.createdAt?.split("T")[0] || "—",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "الحجوزات");
        XLSX.writeFile(wb, `الحجوزات-${new Date().toISOString().split("T")[0]}.xlsx`);

      } else if (type === "sessions") {
        const data = sessions.map(s => {
          const sup = supervisors.find(sv => sv.id === s.supervisorId);
          return {
            "المشرف": sup?.name || s.supervisorId,
            "النوع": s.type === "individual" ? "فردية" : s.type === "group" ? "جماعية" : s.type === "absence" ? "غياب" : "إنذار",
            "التاريخ": s.date, "الشهر": s.month,
            "المدة": s.duration || "—",
            "المتدربون": s.traineeIds?.length || 0,
            "ملاحظات": s.notes || "—",
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "الجلسات");
        XLSX.writeFile(wb, `الجلسات-${new Date().toISOString().split("T")[0]}.xlsx`);
      }
    } finally {
      setLoading(null);
    }
  };

  const exportOptions = [
    {
      key: "trainees",
      emoji: "👥",
      title: "تقرير المتدربين",
      desc: "كل المتدربين مع إجمالي ساعاتهم وحالتهم والمشرف المسند",
      color: "#4F46E5", bg: "#EEF2FF", records: trainees.length,
    },
    {
      key: "supervisors_month",
      emoji: "📊",
      title: "إنتاجية المشرفين",
      desc: "تقرير شهري مفصّل لكل مشرف مع ورقة منفصلة لكل متدرب",
      color: "#0D40FC", bg: "#EEF2FF", records: supervisors.length, hasMonthFilter: true,
    },
    {
      key: "bookings",
      emoji: "📋",
      title: "تقرير الحجوزات",
      desc: "كل الحجوزات مع حالة المقابلة ورابط Google Meet",
      color: "#16A34A", bg: "#F0FDF4", records: bookings.length,
    },
    {
      key: "sessions",
      emoji: "⏱️",
      title: "تقرير الجلسات",
      desc: "كل الجلسات المسجّلة (فردية، جماعية، غياب، إنذار)",
      color: "#EA580C", bg: "#FFF7ED", records: sessions.length,
    },
  ];

  return (
    <div style={{ direction: "rtl", maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.deep, marginBottom: 4 }}>تصدير التقارير</h2>
        <p style={{ fontSize: 13, color: COLORS.gray500 }}>جميع التقارير تُصدَّر بصيغة Excel (.xlsx) وتدعم اللغة العربية</p>
      </div>

      {/* فلتر الشهر */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: `1px solid ${COLORS.gray200}`, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.deep, whiteSpace: "nowrap" }}>الشهر للتقارير الشهرية:</span>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 13, border: `1px solid ${COLORS.gray200}`, borderRadius: 8, background: "#fff", color: COLORS.deep }}>
          {allMonths.length > 0 ? allMonths.map(m => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          )) : <option value={currentMonth}>{formatMonth(currentMonth)}</option>}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {exportOptions.map(opt => (
          <div key={opt.key} style={{
            background: "#fff", borderRadius: 16, padding: "20px",
            border: `1px solid ${COLORS.gray200}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: opt.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {opt.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.deep, marginBottom: 4 }}>{opt.title}</div>
                <div style={{ fontSize: 12, color: COLORS.gray500, lineHeight: 1.5 }}>{opt.desc}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: COLORS.gray500, background: COLORS.gray100, padding: "3px 10px", borderRadius: 99, border: `1px solid ${COLORS.gray200}` }}>
                {opt.records} سجل
              </span>
              <button
                onClick={() => exportXLSX(opt.key)}
                disabled={loading === opt.key}
                style={{
                  padding: "8px 18px", border: "none", borderRadius: 10,
                  background: loading === opt.key ? COLORS.gray200 : opt.color,
                  color: loading === opt.key ? COLORS.gray500 : "#fff",
                  fontSize: 13, fontWeight: 600, cursor: loading === opt.key ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s",
                }}>
                {loading === opt.key ? "جاري التصدير..." : "📥 تصدير Excel"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* تصدير CSV للحجوزات */}
      <div style={{ marginTop: 16, background: "#fff", borderRadius: 16, padding: "16px 20px", border: `1px solid ${COLORS.gray200}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📄</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>تصدير CSV للحجوزات</div>
            <div style={{ fontSize: 11, color: COLORS.gray500 }}>للاستخدام في Google Sheets أو Excel</div>
          </div>
        </div>
        <a href="/api/admin/export"
          style={{ padding: "8px 18px", border: `1px solid ${COLORS.gray200}`, borderRadius: 10, background: COLORS.gray100, color: COLORS.gray500, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
          📥 تنزيل CSV
        </a>
      </div>
    </div>
  );
}
