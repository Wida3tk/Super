"use client";

import { FormEvent, useMemo, useState } from "react";

export interface ClientAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  bookingIntent?: string;
  license?: string;
  qualification?: string;
}

const intentLabels: Record<string, string> = {
  initial_interview: "مقابلة أولية",
  consultation: "استشارة إدارة سلوك تنظيمي",
};
const licenseLabels: Record<string, string> = {
  behavior_analyst: "محلل سلوك",
  assistant_behavior_analyst: "مساعد محلل سلوك",
  post_license_supervision: "إشراف بعد الرخصة",
  consultant: "مستشار",
  expert: "خبير",
};

export default function ClientAccountsManager({
  initialClients,
}: {
  initialClients: ClientAccount[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClientAccount | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const visible = useMemo(
    () =>
      clients.filter((c) =>
        `${c.name} ${c.email} ${c.phone}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [clients, query],
  );

  function edit(client: ClientAccount) {
    setSelected(client);
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone || "",
      password: "",
    });
    setMessage("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/client-auth", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: selected.id, ...form }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(
        data.error === "EMAIL_EXISTS"
          ? "البريد مستخدم في حساب آخر."
          : data.error === "WEAK_PASSWORD"
            ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
            : "تعذر حفظ التعديلات.",
      );
    } else {
      setClients((current) =>
        current.map((c) =>
          c.id === selected.id
            ? { ...c, name: form.name, email: form.email, phone: form.phone }
            : c,
        ),
      );
      setSelected((current) =>
        current
          ? {
              ...current,
              name: form.name,
              email: form.email,
              phone: form.phone,
            }
          : current,
      );
      setForm((current) => ({ ...current, password: "" }));
      setMessage("تم حفظ بيانات الحساب بنجاح.");
    }
    setSaving(false);
  }

  return (
    <div
      dir="rtl"
      style={{
        display: "grid",
        gridTemplateColumns: selected ? "minmax(0,1fr) 360px" : "1fr",
        gap: 18,
      }}
    >
      <section
        style={{
          background: "#fff",
          border: "1px solid #EEF2F7",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid #EEF2F7",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <strong>الحسابات المسجلة ({clients.length})</strong>
          <input
            aria-label="بحث"
            placeholder="بحث بالاسم أو البريد أو الرقم"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: 280,
              maxWidth: "55%",
              padding: "9px 12px",
              border: "1px solid #DCE3ED",
              borderRadius: 9,
            }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr style={{ background: "#F8FAFC", color: "#64748B" }}>
                {["الاسم", "البريد", "نوع الخدمة", "الصفة", ""].map((h) => (
                  <th key={h} style={{ textAlign: "right", padding: 12 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((client) => (
                <tr key={client.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>
                    {client.name}
                  </td>
                  <td style={{ padding: 12 }}>{client.email}</td>
                  <td style={{ padding: 12 }}>
                    {intentLabels[client.bookingIntent || ""] || "—"}
                  </td>
                  <td style={{ padding: 12 }}>
                    {licenseLabels[client.license || ""] || "—"}
                  </td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => edit(client)}
                      style={{
                        border: 0,
                        borderRadius: 8,
                        padding: "7px 12px",
                        color: "#0D40FC",
                        background: "#EEF4FF",
                        cursor: "pointer",
                      }}
                    >
                      إدارة الحساب
                    </button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: 30,
                      color: "#94A3B8",
                    }}
                  >
                    لا توجد حسابات مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <aside
          style={{
            background: "#fff",
            border: "1px solid #DCE3ED",
            borderRadius: 16,
            padding: 18,
            alignSelf: "start",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>تعديل الحساب</strong>
            <button
              onClick={() => setSelected(null)}
              aria-label="إغلاق"
              style={{ border: 0, background: "none", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
          <form onSubmit={save}>
            {[
              { key: "name", label: "الاسم الثلاثي", type: "text" },
              { key: "email", label: "البريد الإلكتروني", type: "email" },
              { key: "phone", label: "رقم الهاتف", type: "tel" },
              {
                key: "password",
                label: "كلمة مرور جديدة (اختياري)",
                type: "password",
              },
            ].map((field) => (
              <label
                key={field.key}
                style={{
                  display: "block",
                  marginTop: 14,
                  fontSize: 12,
                  color: "#64748B",
                  fontWeight: 700,
                }}
              >
                {field.label}
                <input
                  type={field.type}
                  value={form[field.key as keyof typeof form]}
                  onChange={(e) =>
                    setForm({ ...form, [field.key]: e.target.value })
                  }
                  minLength={field.key === "password" ? 8 : undefined}
                  required={field.key !== "password"}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: 10,
                    border: "1px solid #DCE3ED",
                    borderRadius: 9,
                    font: "inherit",
                  }}
                />
              </label>
            ))}
            {message && (
              <div
                style={{
                  marginTop: 13,
                  padding: 10,
                  borderRadius: 8,
                  background: message.startsWith("تم") ? "#ECFDF5" : "#FEF2F2",
                  color: message.startsWith("تم") ? "#047857" : "#B91C1C",
                  fontSize: 12,
                }}
              >
                {message}
              </div>
            )}
            <button
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 11,
                border: 0,
                borderRadius: 9,
                background: "#0D40FC",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}
