"use client";
import { useState } from "react";
const typeLabel: Record<string, string> = {
  defer: "تأجيل الإشراف",
  withdraw: "انسحاب",
  change_supervisor: "تغيير المشرف",
};
const statusLabel: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};
export default function TraineeRequestsManager({
  initialRequests,
  supervisors,
}: {
  initialRequests: any[];
  supervisors: any[];
}) {
  const [items, setItems] = useState(initialRequests),
    [selected, setSelected] = useState<any>(null),
    [note, setNote] = useState(""),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const [newSupervisorId, setNewSupervisorId] = useState("");
  async function decide(decision: "approved" | "rejected") {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const r = await fetch("/api/admin/trainee-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        decision,
        adminNote: note,
        newSupervisorId,
      }),
    });
    if (r.ok) {
      setItems((c) =>
        c.map((x) =>
          x.id === selected.id
            ? { ...x, status: decision, adminNote: note }
            : x,
        ),
      );
      setSelected(null);
      setNote("");
      setNewSupervisorId("");
    } else setMessage("تعذر حفظ القرار.");
    setSaving(false);
  }
  return (
    <div
      dir="rtl"
      style={{
        display: "grid",
        gridTemplateColumns: selected ? "1fr 360px" : "1fr",
        gap: 16,
      }}
    >
      <section style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 16,
            borderBottom: "1px solid #eef2f7",
          }}
        >
          <strong>طلبات المتدربين</strong>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {items.filter((x) => x.status === "pending").length} بانتظار القرار
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["المتدرب", "الطلب", "التاريخ", "الحالة", ""].map((h) => (
                  <th key={h} style={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={cell}>
                    <b>{item.traineeName}</b>
                    <div style={{ color: "#94a3b8" }}>{item.traineeEmail}</div>
                  </td>
                  <td style={cell}>{typeLabel[item.type]}</td>
                  <td style={cell}>{item.createdAt?.slice(0, 10)}</td>
                  <td style={cell}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 99,
                        background:
                          item.status === "pending"
                            ? "#eef4ff"
                            : item.status === "approved"
                              ? "#ecfdf5"
                              : "#fef2f2",
                        color:
                          item.status === "pending"
                            ? "#0d40fc"
                            : item.status === "approved"
                              ? "#047857"
                              : "#b91c1c",
                      }}
                    >
                      {statusLabel[item.status]}
                    </span>
                  </td>
                  <td style={cell}>
                    <button
                      onClick={() => {
                        setSelected(item);
                        setNote(item.adminNote || "");
                        setMessage("");
                        setNewSupervisorId(item.newSupervisorId || "");
                      }}
                      style={button}
                    >
                      {item.status === "pending" ? "مراجعة" : "التفاصيل"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <aside style={{ ...card, padding: 18, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{typeLabel[selected.type]}</strong>
            <button
              onClick={() => setSelected(null)}
              style={{ border: 0, background: "none" }}
            >
              ✕
            </button>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.8,
              marginTop: 14,
            }}
          >
            {selected.reason}
          </p>
          {selected.type === "defer" && (
            <div
              style={{
                fontSize: 12,
                background: "#f8fafc",
                padding: 10,
                borderRadius: 8,
              }}
            >
              من {selected.startDate} إلى {selected.returnDate}
            </div>
          )}
          {selected.type === "change_supervisor" &&
            selected.status === "pending" && (
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#64748b",
                  marginTop: 14,
                }}
              >
                المشرف الجديد
                <select
                  value={newSupervisorId}
                  onChange={(e) => setNewSupervisorId(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: 9,
                    border: "1px solid #dce3ed",
                    borderRadius: 8,
                  }}
                >
                  <option value="">اختر المشرف</option>
                  {supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} · {supervisor.availableSeats} مقعد متاح
                    </option>
                  ))}
                </select>
              </label>
            )}
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#64748b",
              marginTop: 14,
            }}
          >
            ملاحظة الإدارة
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={selected.status !== "pending"}
              style={{
                width: "100%",
                minHeight: 90,
                marginTop: 6,
                padding: 9,
                border: "1px solid #dce3ed",
                borderRadius: 8,
                font: "inherit",
              }}
            />
          </label>
          {message && (
            <div style={{ color: "#b91c1c", fontSize: 12 }}>{message}</div>
          )}
          {selected.status === "pending" && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                disabled={saving}
                onClick={() => decide("approved")}
                style={{
                  ...button,
                  background: "#10b981",
                  color: "#fff",
                  flex: 1,
                }}
              >
                موافقة
              </button>
              <button
                disabled={saving}
                onClick={() => decide("rejected")}
                style={{
                  ...button,
                  background: "#ef4444",
                  color: "#fff",
                  flex: 1,
                }}
              >
                رفض
              </button>
            </div>
          )}
          {selected.type === "defer" && selected.status === "approved" && (
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const response = await fetch("/api/admin/trainee-requests", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "resume",
                    traineeId: selected.traineeId,
                  }),
                });
                setMessage(
                  response.ok
                    ? "تمت إعادة تفعيل المتدرب."
                    : "تعذر إعادة التفعيل.",
                );
                setSaving(false);
              }}
              style={{
                ...button,
                width: "100%",
                marginTop: 14,
                background: "#10b981",
                color: "#fff",
              }}
            >
              إعادة المتدرب إلى الحالة النشطة
            </button>
          )}
          <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 12 }}>
            {selected.type === "change_supervisor" &&
            selected.status === "pending"
              ? "بعد الموافقة يتم اختيار المشرف الجديد واستكمال النقل من إدارة الإسناد."
              : "يحتفظ النظام بالطلب والقرار ضمن السجل."}
          </p>
        </aside>
      )}
    </div>
  );
}
const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    overflow: "hidden",
  },
  cell: React.CSSProperties = { padding: 12, textAlign: "right" },
  button: React.CSSProperties = {
    border: 0,
    borderRadius: 8,
    padding: "7px 11px",
    background: "#eef4ff",
    color: "#0d40fc",
    cursor: "pointer",
  };
