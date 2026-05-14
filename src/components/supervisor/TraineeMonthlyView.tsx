"use client";

import { useState, useEffect } from "react";

const COLORS = {
  primary: "#0D40FC", deep: "#001442", success: "#10B981",
  warning: "#EF9F27", danger: "#EF4444",
  gray100: "#F8FAFC", gray200: "#EEF2F7", gray300: "#D1D9E6", gray500: "#8898AA",
};

const MONTHS_AR: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

const formatMonth = (m: string) => {
  const [year, month] = m.split("-");
  return `${MONTHS_AR[month] || month} ${year}`;
};

interface Snapshot {
  id: string;
  month: string;
  workHours: number;
  requiredHours: number;
  individualHours: number;
  groupHours: number;
  totalHours: number;
  groupPercentage: number;
  absenceCount: number;
  warningCount: number;
  lockedAt?: string;
}

export default function TraineeMonthlyView({ traineeId, supervisorId }: { traineeId: string; supervisorId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [workHoursInput, setWorkHoursInput] = useState<string>("");
  const [savingMonth, setSavingMonth] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetch(`/api/supervisor/trainee-snapshots?traineeId=${traineeId}`)
      .then(r => r.json())
      .then(data => {
        setSnapshots(data.snapshots || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [traineeId]);

  const saveWorkHours = async (month: string) => {
    const val = Number(workHoursInput);
    if (!val || val <= 0) return;
    setSavingMonth(month);
    try {
      const res = await fetch('/api/supervisor/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traineeId, month, workHours: val }),
      });
      if (!res.ok) throw new Error('فشل');
      // تحديث محلي
      setSnapshots(prev => prev.map(s =>
        s.month === month
          ? { ...s, workHours: val, requiredHours: Math.round(val * 0.05 * 10) / 10 }
          : s
      ));
      setEditingMonth(null);
    } catch {
      alert('حدث خطأ في الحفظ');
    } finally {
      setSavingMonth(null);
    }
  };

  if (loading) return <div style={{ padding: "1rem", textAlign: "center", color: COLORS.gray500, fontSize: 13 }}>جاري تحميل البيانات الشهرية...</div>;

  if (snapshots.length === 0) return (
    <div style={{ padding: "2rem", textAlign: "center", color: COLORS.gray500, fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>📅</div>
      لا توجد بيانات شهرية بعد — ستظهر هنا بعد تسجيل أول جلسة
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
        <thead>
          <tr style={{ background: COLORS.gray100 }}>
            {["الشهر", "ساعات العمل", "المطلوب (5%)", "فردية", "جماعية", "الإجمالي", "التقدم", "غياب"].map(h => (
              <th key={h} style={{ padding: "10px 14px", fontSize: 11, color: COLORS.gray500, fontWeight: 500, textAlign: "right", borderBottom: `1px solid ${COLORS.gray200}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshots.map(snap => {
            const isCurrentMonth = snap.month === currentMonth;
            const isLocked = !!snap.lockedAt;
            const isEditing = editingMonth === snap.month;
            const pct = snap.requiredHours > 0 ? Math.min(Math.round((snap.totalHours / snap.requiredHours) * 100), 100) : 0;
            const metTarget = snap.totalHours >= snap.requiredHours && snap.requiredHours > 0;

            return (
              <tr key={snap.id} style={{ borderBottom: `1px solid ${COLORS.gray200}`, background: isCurrentMonth ? "#F0F7FF" : "#fff" }}>
                {/* الشهر */}
                <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 13, color: COLORS.deep, whiteSpace: "nowrap" }}>
                  {formatMonth(snap.month)}
                  {isCurrentMonth && <span style={{ marginRight: 6, fontSize: 10, background: "#E6F1FB", color: COLORS.primary, padding: "1px 6px", borderRadius: 99, fontWeight: 400 }}>الحالي</span>}
                  {isLocked && <span style={{ marginRight: 4, fontSize: 10 }}>🔒</span>}
                </td>

                {/* ساعات العمل — قابلة للتعديل */}
                <td style={{ padding: "12px 14px" }}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input
                        type="number" min={0} value={workHoursInput}
                        onChange={e => setWorkHoursInput(e.target.value)}
                        autoFocus
                        style={{ width: 70, padding: "4px 6px", fontSize: 12, border: `1px solid ${COLORS.primary}`, borderRadius: 6, outline: "none" }}
                        onKeyDown={e => { if (e.key === 'Enter') saveWorkHours(snap.month); if (e.key === 'Escape') setEditingMonth(null); }}
                      />
                      <button onClick={() => saveWorkHours(snap.month)} disabled={!!savingMonth}
                        style={{ padding: "4px 8px", background: COLORS.primary, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                        {savingMonth === snap.month ? "..." : "✓"}
                      </button>
                      <button onClick={() => setEditingMonth(null)}
                        style={{ padding: "4px 8px", background: COLORS.gray100, color: COLORS.gray500, border: `1px solid ${COLORS.gray300}`, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: snap.workHours > 0 ? COLORS.deep : COLORS.gray500 }}>
                        {snap.workHours > 0 ? `${snap.workHours} ساعة` : "—"}
                      </span>
                      {!isLocked && (
                        <button onClick={() => { setEditingMonth(snap.month); setWorkHoursInput(String(snap.workHours || "")); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: COLORS.gray500, padding: "2px 4px", borderRadius: 4 }}
                          title="تعديل">
                          ✏️
                        </button>
                      )}
                    </div>
                  )}
                </td>

                {/* المطلوب 5% */}
                <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: snap.requiredHours > 0 ? COLORS.deep : COLORS.gray500 }}>
                  {snap.requiredHours > 0 ? `${snap.requiredHours} ساعة` : "—"}
                </td>

                {/* فردية */}
                <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: COLORS.primary }}>
                  {snap.individualHours || 0}
                </td>

                {/* جماعية */}
                <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: "#0891b2" }}>
                  {snap.groupHours || 0}
                  {snap.groupPercentage > 25 && <span style={{ marginRight: 4, fontSize: 10, color: COLORS.warning }}>⚠️{snap.groupPercentage}%</span>}
                </td>

                {/* الإجمالي */}
                <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700, color: metTarget ? COLORS.success : COLORS.deep }}>
                  {snap.totalHours || 0}
                  {metTarget && <span style={{ marginRight: 4, fontSize: 12 }}>✓</span>}
                </td>

                {/* التقدم */}
                <td style={{ padding: "12px 14px" }}>
                  {snap.requiredHours > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 60, height: 5, background: COLORS.gray200, borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: metTarget ? COLORS.success : COLORS.primary, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, color: metTarget ? COLORS.success : COLORS.gray500, fontWeight: metTarget ? 600 : 400 }}>{pct}%</span>
                    </div>
                  ) : <span style={{ fontSize: 11, color: COLORS.gray500 }}>—</span>}
                </td>

                {/* غياب */}
                <td style={{ padding: "12px 14px", fontSize: 13, color: (snap.absenceCount || 0) > 0 ? COLORS.warning : COLORS.gray500 }}>
                  {snap.absenceCount || 0}
                  {(snap.warningCount || 0) > 0 && <span style={{ marginRight: 6, fontSize: 11, color: COLORS.danger }}>🚨{snap.warningCount}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
