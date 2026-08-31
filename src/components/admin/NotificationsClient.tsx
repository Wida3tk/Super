"use client";

import { useState } from "react";

const COLORS = {
  primary: "#0D40FC", deep: "#001442", success: "#10B981",
  warning: "#EF9F27", danger: "#EF4444",
  gray100: "#F8FAFC", gray200: "#EEF2F7", gray300: "#D1D9E6", gray500: "#8898AA",
};

interface Notification {
  id: string;
  type: "shoutout" | "reminder" | "warning";
  message: string;
  targetType: "all" | "all_supervisors" | "supervisor" | "all_trainees" | "trainee";
  targetId?: string;
  targetName?: string;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG = {
  shoutout: { label: "إشادة 🎉", bg: "#E6F1FB", color: "#185FA5", icon: "ti-star" },
  reminder: { label: "تذكير", bg: "#EAF3DE", color: "#3B6D11", icon: "ti-bell" },
  warning: { label: "تنبيه", bg: "#FCEBEB", color: "#A32D2D", icon: "ti-alert-circle" },
};

const timeAgo = (iso: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
};

export default function NotificationsClient({ notifications: initial, supervisors, trainees }: {
  notifications: Notification[];
  supervisors: any[];
  trainees: any[];
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"shoutout" | "reminder" | "warning">("shoutout");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all_supervisors" | "supervisor" | "all_trainees" | "trainee">("all_supervisors");
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendNotification = async () => {
    if (!message.trim()) { setError("يرجى كتابة رسالة"); return; }
    if ((targetType === "supervisor" || targetType === "trainee") && !targetId) { setError("يرجى اختيار المستلم"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch('/api/admin/notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, targetType, targetId: ["supervisor", "trainee"].includes(targetType) ? targetId : null }),
      });
      if (!res.ok) throw new Error('فشل الإرسال');
      const data = await res.json();
      const recipient = targetType === "supervisor" ? supervisors.find(s => s.id === targetId) : trainees.find(t => t.id === targetId);
      setNotifications(prev => [{
        id: data.id,
        type, message,
        targetType,
        targetId: ["supervisor", "trainee"].includes(targetType) ? targetId : undefined,
        targetName: recipient?.name,
        read: false,
        createdAt: new Date().toISOString(),
      }, ...prev]);
      setMessage("");
      setShowForm(false);
    } catch (e: any) {
      setError(e.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ direction: "rtl", maxWidth: 800 }}>

      {/* زر إنشاء */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: COLORS.deep }}>الإشعارات المرسلة</h2>
          <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 2 }}>{notifications.length} إشعار</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: "9px 18px", border: "none", borderRadius: 10, background: COLORS.deep, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-speakerphone" style={{ fontSize: 15 }} aria-hidden="true" />
          إنشاء إشعار
        </button>
      </div>

      {/* فورم الإنشاء */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "1.25rem", border: `1px solid ${COLORS.gray200}`, marginBottom: "1.25rem", boxShadow: "0 2px 12px rgba(1,20,66,0.06)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.deep, marginBottom: "1rem" }}>إنشاء إشعار جديد</p>

          {/* نوع الإشعار */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>النوع</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["shoutout", "reminder", "warning"] as const).map(t => {
                const cfg = TYPE_CONFIG[t];
                return (
                  <button key={t} onClick={() => setType(t)}
                    style={{ padding: "7px 14px", border: `1px solid ${type === t ? cfg.color : COLORS.gray300}`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: type === t ? 600 : 400, background: type === t ? cfg.bg : "#fff", color: type === t ? cfg.color : COLORS.gray500 }}>
                    <i className={`ti ${cfg.icon}`} style={{ marginLeft: 4, fontSize: 13 }} aria-hidden="true" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* المستهدف */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>المستهدف</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {[{ key: "all_supervisors", label: "جميع المشرفين" }, { key: "supervisor", label: "مشرف محدد" }, { key: "all_trainees", label: "جميع المتدربين" }, { key: "trainee", label: "متدرب محدد" }].map(t => (
                <button key={t.key} onClick={() => setTargetType(t.key as any)}
                  style={{ padding: "7px 14px", border: `1px solid ${targetType === t.key ? COLORS.primary : COLORS.gray300}`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: targetType === t.key ? 600 : 400, background: targetType === t.key ? "#E6F1FB" : "#fff", color: targetType === t.key ? COLORS.primary : COLORS.gray500 }}>
                  {t.label}
                </button>
              ))}
            </div>
            {targetType === "supervisor" && (
              <select value={targetId} onChange={e => setTargetId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: "#fff" }}>
                <option value="">اختر مشرفاً...</option>
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {targetType === "trainee" && (
              <select value={targetId} onChange={e => setTargetId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: "#fff" }}>
                <option value="">اختر متدرباً...</option>
                {trainees.map(t => <option key={t.id} value={t.id}>{t.name} — {t.email || "دون بريد"}</option>)}
              </select>
            )}
          </div>

          {/* الرسالة */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>الرسالة</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder={type === "shoutout" ? "أحسنت! أعلى إنتاجية هذا الشهر..." : type === "reminder" ? "تذكير: يرجى إدخال ساعات العمل..." : "تنبيه: يرجى مراجعة..."}
              rows={3}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, resize: "vertical" }} />
          </div>

          {error && <p style={{ fontSize: 12, color: COLORS.danger, background: "#FCEBEB", padding: "8px 10px", borderRadius: 8, marginBottom: "1rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: 10, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: "#fff", color: COLORS.gray500, cursor: "pointer", fontSize: 13 }}>
              إلغاء
            </button>
            <button onClick={sendNotification} disabled={loading}
              style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, background: loading ? COLORS.gray300 : COLORS.deep, color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
              {loading ? "جاري الإرسال..." : "إرسال"}
            </button>
          </div>
        </div>
      )}

      {/* قائمة الإشعارات */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notifications.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "3rem", textAlign: "center", border: `1px solid ${COLORS.gray200}` }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🔔</div>
            <div style={{ color: COLORS.gray500, fontSize: 13 }}>لا توجد إشعارات مرسلة حتى الآن.</div>
          </div>
        ) : notifications.map(n => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.reminder;
          return (
            <div key={n.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: `1px solid ${n.read ? COLORS.gray200 : "#B5D4F4"}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className={`ti ${cfg.icon}`} style={{ color: cfg.color, fontSize: 17 }} aria-hidden="true" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: COLORS.gray500 }}>
                    {{ all: "جميع المشرفين", all_supervisors: "جميع المشرفين", all_trainees: "جميع المتدربين", supervisor: `المشرف: ${n.targetName || "مستلم محدد"}`, trainee: `المتدرب: ${n.targetName || "مستلم محدد"}` }[n.targetType] || "مستلم محدد"}
                  </span>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0D40FC", display: "inline-block" }} />}
                </div>
                <p style={{ fontSize: 13, color: COLORS.deep, lineHeight: 1.5 }}>{n.message}</p>
                <div style={{ fontSize: 11, color: COLORS.gray500, marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
