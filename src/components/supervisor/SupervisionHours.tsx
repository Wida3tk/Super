"use client";

import { useState, useEffect } from "react";
import { useSupervisorSupervision } from "@/lib/hooks/useSupervision";
import type { Trainee, SessionType, AbsenceReason, WarningReason } from "@/lib/types/index";

// ===========================
// الألوان والثوابت
// ===========================
const COLORS = {
  primary: "#0D40FC",
  deep: "#001442",
  neon: "#55D7FF",
  success: "#10B981",
  warning: "#EF9F27",
  danger: "#EF4444",
  gray100: "#F8FAFC",
  gray200: "#EEF2F7",
  gray300: "#D1D9E6",
  gray500: "#8898AA",
};

const MONTHS_AR: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

const formatMonth = (m: string) => {
  const [year, month] = m.split("-");
  return `${MONTHS_AR[month]} ${year}`;
};

const getLast6Months = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
};

// ===========================
// Modal تسجيل جلسة
// ===========================
function SessionModal({
  trainees,
  onClose,
  onSubmit,
}: {
  trainees: Trainee[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [type, setType] = useState<SessionType>("individual");
  const [selectedTrainee, setSelectedTrainee] = useState("");
  const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState(1);
  const [absenceReason, setAbsenceReason] = useState<AbsenceReason>("health");
  const [warningReason, setWarningReason] = useState<WarningReason>("repeated_absence");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleTrainee = (id: string) => {
    setSelectedTrainees((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const isGroupValid = type === "group" && selectedTrainees.length >= 2;
  const isIndividualValid = type === "individual" && selectedTrainee;
  const isAbsenceValid = (type === "absence" || type === "warning") && selectedTrainee;
  const canSubmit = isGroupValid || isIndividualValid || isAbsenceValid;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        type,
        traineeIds: type === "group" ? selectedTrainees : [selectedTrainee],
        date,
        duration: type === "individual" || type === "group" ? duration : undefined,
        absenceReason: type === "absence" ? absenceReason : undefined,
        warningReason: type === "warning" ? warningReason : undefined,
        notes,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const typeConfig: Record<SessionType, { label: string; color: string; bg: string }> = {
    individual: { label: "فردية", color: COLORS.primary, bg: "#E6F1FB" },
    group: { label: "جماعية", color: "#0891b2", bg: "#E0F7FC" },
    absence: { label: "غياب", color: "#854F0B", bg: "#FAEEDA" },
    warning: { label: "إنذار", color: "#791F1F", bg: "#FCEBEB" },
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 16, padding: "1.5rem",
        width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
        direction: "rtl",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.deep }}>تسجيل جلسة جديدة</p>
          <span style={{ fontSize: 12, color: COLORS.gray500 }}>{formatMonth(new Date().toISOString().slice(0, 7))}</span>
        </div>

        {/* نوع الجلسة */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>نوع السجل</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {(["individual", "group", "absence", "warning"] as SessionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: "8px 4px", border: `1px solid ${type === t ? typeConfig[t].color : COLORS.gray300}`,
                  borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: type === t ? 600 : 400,
                  background: type === t ? typeConfig[t].bg : "#fff",
                  color: type === t ? typeConfig[t].color : COLORS.gray500,
                  transition: "all 0.15s",
                }}
              >
                {typeConfig[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* المتدرب — فردي */}
        {(type === "individual" || type === "absence" || type === "warning") && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>المتدرب</label>
            <select
              value={selectedTrainee}
              onChange={(e) => setSelectedTrainee(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: "#fff" }}
            >
              <option value="">اختر متدرباً...</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {t.license}</option>
              ))}
            </select>
          </div>
        )}

        {/* المتدربون — جماعي */}
        {type === "group" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>المتدربون المشاركون</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {trainees.map((t) => (
                <div
                  key={t.id}
                  onClick={() => toggleTrainee(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    border: `1px solid ${selectedTrainees.includes(t.id) ? COLORS.primary : COLORS.gray300}`,
                    borderRadius: 8, cursor: "pointer",
                    background: selectedTrainees.includes(t.id) ? "#E6F1FB" : "#fff",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${selectedTrainees.includes(t.id) ? COLORS.primary : COLORS.gray300}`,
                    background: selectedTrainees.includes(t.id) ? COLORS.primary : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {selectedTrainees.includes(t.id) && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: selectedTrainees.includes(t.id) ? "#0C447C" : COLORS.deep }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: COLORS.gray500, marginRight: "auto" }}>{t.license}</span>
                </div>
              ))}
            </div>
            {type === "group" && selectedTrainees.length === 1 && (
              <p style={{ fontSize: 12, color: "#854F0B", background: "#FAEEDA", padding: "8px 10px", borderRadius: 8, marginTop: 6 }}>
                ⚠️ الجلسة الجماعية تتطلب متدربَين على الأقل
              </p>
            )}
            {type === "group" && selectedTrainees.length >= 2 && (
              <p style={{ fontSize: 12, color: "#185FA5", background: "#E6F1FB", padding: "8px 10px", borderRadius: 8, marginTop: 6 }}>
                ✓ ستُحتسب ساعة واحدة على المشرف، وساعة لكل متدرب
              </p>
            )}
          </div>
        )}

        {/* سبب الغياب */}
        {type === "absence" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>سبب الغياب</label>
            <select
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value as AbsenceReason)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }}
            >
              <option value="health">ظرف صحي</option>
              <option value="emergency">ظرف طارئ</option>
              <option value="notified_absence">غياب بإشعار مسبق</option>
              <option value="unnotified_absence">غياب بدون إشعار</option>
              <option value="trainee_postpone">تأجيل بطلب من المتدرب</option>
              <option value="other">أخرى</option>
            </select>
            <p style={{ fontSize: 12, color: "#854F0B", background: "#FAEEDA", padding: "8px 10px", borderRadius: 8, marginTop: 8 }}>
              في حال تكرار الغياب، يُرجى إبلاغ المرشد الأكاديمي للمتابعة مع المتدرب واتخاذ الإجراء المناسب.
            </p>
          </div>
        )}

        {/* سبب الإنذار */}
        {type === "warning" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>سبب الإنذار</label>
            <select
              value={warningReason}
              onChange={(e) => setWarningReason(e.target.value as WarningReason)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }}
            >
              <option value="repeated_absence">تكرار الغياب</option>
              <option value="late_attendance">عدم الالتزام بالمواعيد</option>
              <option value="late_documents">تأخر في تسليم المستندات</option>
              <option value="policy_violation">مخالفة سياسات البرنامج</option>
              <option value="other">أخرى</option>
            </select>
            <p style={{ fontSize: 12, color: "#791F1F", background: "#FCEBEB", padding: "8px 10px", borderRadius: 8, marginTop: 8 }}>
              سيُسجَّل هذا الإنذار في ملف المتدرب ويكون مرئياً للإدارة.
            </p>
          </div>
        )}

        {/* التاريخ والمدة */}
        <div style={{ display: "grid", gridTemplateColumns: type === "individual" || type === "group" ? "1fr 1fr" : "1fr", gap: 10, marginBottom: "1rem" }}>
          <div>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>التاريخ</label>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }}
            />
          </div>
          {(type === "individual" || type === "group") && (
            <div>
              <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>المدة</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }}
              >
                <option value={0.5}>نصف ساعة (0.5)</option>
                <option value={1}>ساعة واحدة (1)</option>
                <option value={1.5}>ساعة ونصف (1.5)</option>
                <option value={2}>ساعتان (2)</option>
                <option value={2.5}>ساعتان ونصف (2.5)</option>
                <option value={3}>ثلاث ساعات (3)</option>
              </select>
            </div>
          )}
        </div>

        {/* ملاحظات */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>ملاحظات (اختياري)</label>
          <input
            type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="أضف ملاحظة..."
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: COLORS.danger, background: "#FCEBEB", padding: "8px 10px", borderRadius: 8, marginBottom: "1rem" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: 10, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: "#fff", color: COLORS.gray500, cursor: "pointer", fontSize: 13 }}
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            style={{
              flex: 1, padding: 10, border: "none", borderRadius: 8, cursor: canSubmit ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              background: !canSubmit ? COLORS.gray200 : type === "absence" ? "#BA7517" : type === "warning" ? "#A32D2D" : COLORS.primary,
              color: !canSubmit ? COLORS.gray500 : "#fff",
            }}
          >
            {loading ? "جاري الحفظ..." : type === "absence" ? "تسجيل الغياب" : type === "warning" ? "إصدار الإنذار" : "حفظ الجلسة"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================
// بطاقة المتدرب
// ===========================
function TraineeCard({
  trainee,
  snapshot,
  onSelect,
}: {
  trainee: Trainee;
  snapshot: any;
  onSelect: () => void;
}) {
  const total = snapshot?.totalHours || 0;
  const required = trainee.requiredHours;
  const pct = Math.min(Math.round((total / required) * 100), 100);
  const groupPct = snapshot?.groupPercentage || 0;
  const isGroupWarn = groupPct > 25;

  return (
    <div
      onClick={onSelect}
      style={{
        background: "#fff", borderRadius: 12, padding: "14px 16px",
        border: `1px solid ${COLORS.gray200}`, cursor: "pointer",
        transition: "all 0.15s", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 12,
      }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = COLORS.primary)}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = COLORS.gray200)}
    >
      <div style={{
        width: 36, height: 36, borderRadius: "50%", background: "#E6F1FB",
        color: "#0C447C", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 600, flexShrink: 0,
      }}>
        {trainee.name.slice(0, 2)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>{trainee.name}</span>
          <span style={{ fontSize: 11, color: COLORS.gray500, background: COLORS.gray100, padding: "2px 8px", borderRadius: 99, border: `1px solid ${COLORS.gray200}` }}>
            {trainee.license}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: COLORS.gray200, borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99, width: `${pct}%`,
              background: pct >= 100 ? COLORS.success : COLORS.primary,
              transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: 11, color: COLORS.gray500, minWidth: 60, textAlign: "left" }}>
            {total}/{required} ساعة
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: COLORS.gray500 }}>
            🎯 فردية: <strong>{snapshot?.individualHours || 0}</strong>
          </span>
          <span style={{ fontSize: 11, color: isGroupWarn ? COLORS.warning : COLORS.gray500 }}>
            {isGroupWarn ? "⚠️" : "👥"} جماعية: <strong>{snapshot?.groupHours || 0}</strong>
            {isGroupWarn && <span style={{ color: COLORS.warning }}> ({groupPct}%)</span>}
          </span>
          {(snapshot?.absenceCount || 0) > 0 && (
            <span style={{ fontSize: 11, color: COLORS.warning }}>
              🚫 غياب: <strong>{snapshot.absenceCount}</strong>
            </span>
          )}
        </div>
      </div>

      <span style={{ color: COLORS.gray300, fontSize: 18 }}>‹</span>
    </div>
  );
}

// ===========================
// المكوّن الرئيسي
// ===========================
export default function SupervisionHours({ supervisorId }: { supervisorId: string }) {
  const {
    trainees, sessions, snapshots, selectedMonth, setSelectedMonth,
    loading, error, submitSession, submitWorkHours, getTraineeSnapshot, monthTotals,
  } = useSupervisorSupervision(supervisorId);

  const [showModal, setShowModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
  const months = getLast6Months();
  const totals = monthTotals();

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: COLORS.gray500 }}>
        جاري التحميل...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: COLORS.danger }}>
        {error}
      </div>
    );
  }

  // عرض ملف متدرب
  if (selectedTrainee) {
    const snap = getTraineeSnapshot(selectedTrainee.id);
    const traineeSessions = sessions.filter((s) => s.traineeIds.includes(selectedTrainee.id));

    return (
      <div style={{ direction: "rtl" }}>
        <button
          onClick={() => setSelectedTrainee(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.gray500, cursor: "pointer", fontSize: 13, marginBottom: "1rem", padding: "6px 0" }}
        >
          → رجوع
        </button>

        <div style={{ background: "#fff", borderRadius: 14, padding: "1.25rem", border: `1px solid ${COLORS.gray200}`, marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E6F1FB", color: "#0C447C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>
              {selectedTrainee.name.slice(0, 2)}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.deep }}>{selectedTrainee.name}</p>
              <p style={{ fontSize: 12, color: COLORS.gray500 }}>{selectedTrainee.license} · {selectedTrainee.requiredHours} ساعة مطلوبة</p>
            </div>
          </div>

          {/* ساعات العمل الشهرية */}
          <div style={{ background: COLORS.gray100, borderRadius: 10, padding: "12px 14px", marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 8 }}>
              ساعات عمل المتدرب هذا الشهر (لحساب نسبة الـ5%)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number" min={0} placeholder="مثال: 120"
                defaultValue={snap?.workHours || ""}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0) submitWorkHours(selectedTrainee.id, val);
                }}
                style={{ flex: 1, padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }}
              />
              <div style={{ background: "#E6F1FB", color: "#185FA5", padding: "8px 12px", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                المطلوب: <strong style={{ marginRight: 4 }}>{snap?.requiredHours || 0} ساعة</strong>
              </div>
            </div>
          </div>

          {/* إحصائيات */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "فردية", value: snap?.individualHours || 0, color: COLORS.primary },
              { label: "جماعية", value: snap?.groupHours || 0, color: "#0891b2" },
              { label: "الإجمالي", value: snap?.totalHours || 0, color: COLORS.success },
            ].map((s) => (
              <div key={s.label} style={{ background: COLORS.gray100, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: COLORS.gray500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* جدول الجلسات */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${COLORS.gray200}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.gray200}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.gray100 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>جلسات {formatMonth(selectedMonth)}</span>
            <span style={{ fontSize: 12, color: COLORS.gray500 }}>{traineeSessions.length} جلسة</span>
          </div>

          {traineeSessions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: COLORS.gray500, fontSize: 13 }}>
              لا توجد جلسات مسجّلة هذا الشهر
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.gray100 }}>
                  {["التاريخ", "النوع", "المدة", "ملاحظات"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, color: COLORS.gray500, fontWeight: 500, textAlign: "right", borderBottom: `1px solid ${COLORS.gray200}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traineeSessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: COLORS.gray500 }}>{s.date}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{
                        fontSize: 11, padding: "3px 9px", borderRadius: 99,
                        background: s.type === "individual" ? "#E6F1FB" : s.type === "group" ? "#E0F7FC" : s.type === "absence" ? "#FAEEDA" : "#FCEBEB",
                        color: s.type === "individual" ? "#185FA5" : s.type === "group" ? "#0E6E7A" : s.type === "absence" ? "#854F0B" : "#791F1F",
                      }}>
                        {s.type === "individual" ? "فردية" : s.type === "group" ? "جماعية" : s.type === "absence" ? "غياب" : "إنذار"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500 }}>
                      {s.duration ? `${s.duration} ساعة` : "—"}
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: COLORS.gray500 }}>{s.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // الواجهة الرئيسية
  return (
    <div style={{ direction: "rtl" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.deep }}>ساعات الإشراف</h2>
          <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 2 }}>{formatMonth(selectedMonth)}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: COLORS.deep, color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          + تسجيل جلسة
        </button>
      </div>

      {/* فلتر الشهر */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem", overflowX: "auto", paddingBottom: 4 }}>
        {months.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            style={{
              padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${selectedMonth === m ? COLORS.primary : COLORS.gray300}`,
              background: selectedMonth === m ? COLORS.deep : "#fff",
              color: selectedMonth === m ? "#fff" : COLORS.gray500,
              fontWeight: selectedMonth === m ? 600 : 400,
            }}
          >
            {formatMonth(m)}
          </button>
        ))}
      </div>

      {/* إحصائيات الشهر */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "إجمالي الساعات", value: totals.total, color: COLORS.primary },
          { label: "فردية", value: totals.individual, color: COLORS.primary },
          { label: "جماعية", value: totals.group, color: "#0891b2" },
          { label: "المتدربون النشطون", value: trainees.length, color: COLORS.success },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px", border: `1px solid ${COLORS.gray200}` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: COLORS.gray500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* قائمة المتدربين */}
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${COLORS.gray200}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.gray200}`, background: COLORS.gray100, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>متدربو هذا الشهر</span>
          <span style={{ fontSize: 12, color: COLORS.gray500 }}>{trainees.length} متدرب</span>
        </div>
        <div style={{ padding: "12px 16px" }}>
          {trainees.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: COLORS.gray500, fontSize: 13 }}>
              لا يوجد متدربون مسندون إليك حالياً
            </div>
          ) : (
            trainees.map((t) => (
              <TraineeCard
                key={t.id}
                trainee={t}
                snapshot={getTraineeSnapshot(t.id)}
                onSelect={() => setSelectedTrainee(t)}
              />
            ))
          )}
        </div>
      </div>

      {showModal && (
        <SessionModal
          trainees={trainees}
          onClose={() => setShowModal(false)}
          onSubmit={submitSession}
        />
      )}
    </div>
  );
}
