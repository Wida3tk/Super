"use client";

import { useState } from "react";
import type {
  Trainee,
  MonthlySnapshot,
  TraineeStatus,
  OnboardingStage,
  License,
} from "@/types";
import { downloadCsv, type CsvRow } from "@/lib/export/csv";

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
  if (!m) return "";
  const [year, month] = m.split("-");
  return `${MONTHS_AR[month] || month} ${year}`;
};

const STATUS_LABELS: Record<TraineeStatus, string> = {
  onboarding: "بوردنق", active: "نشط", paused: "مؤجل",
  withdrawn: "منسحب", completed: "مكتمل",
};

const STATUS_COLORS: Record<TraineeStatus, { bg: string; color: string }> = {
  onboarding: { bg: "#F1EFE8", color: "#5F5E5A" },
  active: { bg: "#EAF3DE", color: "#3B6D11" },
  paused: { bg: "#FAEEDA", color: "#854F0B" },
  withdrawn: { bg: "#F1EFE8", color: "#5F5E5A" },
  completed: { bg: "#E1F5EE", color: "#0F6E56" },
};

const ONBOARDING_STAGES: { key: OnboardingStage; label: string }[] = [
  { key: "initial_interview", label: "مقابلة أولية" },
  { key: "post_interview", label: "ما بعد المقابلة" },
  { key: "contracting", label: "التعاقد" },
];

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: bg, color, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}
    </span>
  );
}

// ===========================
// API helpers
// ===========================
async function apiPost(data: any) {
  const res = await fetch('/api/admin/trainee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPatch(data: any) {
  const res = await fetch('/api/admin/trainee', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const messages: Record<string, string> = {
      EMAIL_ROLE_CONFLICT: 'هذا البريد مستخدم لحساب مدير أو مشرف ولا يمكن استخدامه للمتدرب',
      'auth/email-already-exists': 'البريد مستخدم مسبقًا في حساب آخر',
      'auth/invalid-email': 'بريد المتدرب غير صالح',
    };
    throw new Error(messages[payload?.error] || payload?.detail || payload?.error || `تعذر تنفيذ الإسناد (${res.status})`);
  }
  return res.json();
}

async function apiPut(data: any) {
  const res = await fetch('/api/admin/trainee', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===========================
// Modal إضافة متدرب
// ===========================
function AddTraineeModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState<License>("QASP-S");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name || !email || !phone) { setError("يرجى تعبئة جميع الحقول"); return; }
    setLoading(true);
    try {
      await apiPost({ name, email, phone, license });
      window.location.reload();
    } catch (e: any) {
      setError(e.message || "حدث خطأ");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 440, direction: "rtl" }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.deep, marginBottom: "1.25rem" }}>إضافة متدرب جديد</p>
        <p style={{ fontSize: 12, color: COLORS.gray500, marginBottom: "1.25rem", background: COLORS.gray100, padding: "8px 12px", borderRadius: 8 }}>
          سيُضاف في مرحلة &quot;مقابلة أولية&quot; — الإسناد لمشرف يتم لاحقاً بعد التعاقد
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "1rem" }}>
          <div>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>الاسم *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل"
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>الجوال *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr"
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }} />
          </div>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>الإيميل *</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" dir="ltr"
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }} />
        </div>
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>الرخصة المستهدفة *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["QASP-S", "QBA"] as License[]).map(l => (
              <div key={l} onClick={() => setLicense(l)}
                style={{ padding: "12px", border: `1px solid ${license === l ? COLORS.primary : COLORS.gray300}`, borderRadius: 10, cursor: "pointer", textAlign: "center", background: license === l ? "#E6F1FB" : "#fff" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: license === l ? "#0C447C" : COLORS.deep }}>{l}</div>
                <div style={{ fontSize: 11, color: COLORS.gray500, marginTop: 2 }}>{l === "QASP-S" ? "50 ساعة" : "100 ساعة"}</div>
              </div>
            ))}
          </div>
        </div>
        {error && <p style={{ fontSize: 12, color: COLORS.danger, background: "#FCEBEB", padding: "8px 10px", borderRadius: 8, marginBottom: "1rem" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: "#fff", color: COLORS.gray500, cursor: "pointer", fontSize: 13 }}>إلغاء</button>
          <button onClick={handleSubmit} disabled={loading}
            style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, background: loading ? COLORS.gray300 : COLORS.deep, color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            {loading ? "جاري الإضافة..." : "إضافة المتدرب"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================
// Modal إسناد متدرب
// ===========================
function AssignModal({ trainee, supervisors, onClose }: {
  trainee: Trainee;
  supervisors: any[];
  onClose: () => void;
}) {
  const [selectedSup, setSelectedSup] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!selectedSup) { setError("يرجى اختيار مشرف"); return; }
    setLoading(true);
    try {
      const result = await apiPatch({ traineeId: trainee.id, action: 'assign', supervisorId: selectedSup, startDate });
      if (result.inviteLink) {
        setInviteLink(result.inviteLink);
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch (e: any) {
      setError(e.message || "حدث خطأ");
      setLoading(false);
    }
  };

  if (inviteLink) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 500, direction: "rtl" }}>
        <div style={{width:48,height:48,borderRadius:'50%',background:'#EAF3DE',color:'#059669',display:'grid',placeItems:'center',fontSize:24,marginBottom:12}}>✓</div>
        <h3 style={{margin:'0 0 6px',color:COLORS.deep}}>تم الإسناد وإنشاء الحساب</h3>
        <p style={{fontSize:13,color:COLORS.gray500,lineHeight:1.7}}>تم إنشاء رابط تعيين كلمة المرور للمتدرب. انسخي الرابط وأرسليه له إذا لم تكن خدمة البريد مفعلة.</p>
        <div dir="ltr" style={{margin:'14px 0',padding:11,background:COLORS.gray100,border:`1px solid ${COLORS.gray200}`,borderRadius:9,fontSize:11,wordBreak:'break-all'}}>{inviteLink}</div>
        <div style={{display:'flex',gap:8}}><button onClick={async()=>{await navigator.clipboard.writeText(inviteLink);setCopied(true)}} style={{flex:1,padding:10,border:'none',borderRadius:8,background:COLORS.primary,color:'#fff',cursor:'pointer'}}>{copied?'تم النسخ ✓':'نسخ الرابط'}</button><button onClick={()=>window.location.reload()} style={{flex:1,padding:10,border:`1px solid ${COLORS.gray300}`,borderRadius:8,background:'#fff',cursor:'pointer'}}>إغلاق</button></div>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 440, direction: "rtl" }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.deep, marginBottom: 4 }}>إسناد — {trainee.name}</p>
        <p style={{ fontSize: 12, color: COLORS.gray500, marginBottom: "1.25rem" }}>رخصة {trainee.license}</p>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>اختر المشرف *</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {supervisors.map(s => (
              <div key={s.id} onClick={() => setSelectedSup(s.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${selectedSup === s.id ? COLORS.primary : COLORS.gray300}`, borderRadius: 10, cursor: "pointer", background: selectedSup === s.id ? "#E6F1FB" : "#fff" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#E6F1FB", color: "#0C447C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                  {s.name?.slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: selectedSup === s.id ? "#0C447C" : COLORS.deep }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.gray500 }}>{s.availableSeats ?? 0} مقعد متاح</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ fontSize: 12, color: COLORS.gray500, display: "block", marginBottom: 6 }}>تاريخ بدء الإشراف *</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${COLORS.gray300}`, borderRadius: 8 }} />
        </div>
        {error && <p style={{ fontSize: 12, color: COLORS.danger, background: "#FCEBEB", padding: "8px 10px", borderRadius: 8, marginBottom: "1rem" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: "#fff", color: COLORS.gray500, cursor: "pointer", fontSize: 13 }}>إلغاء</button>
          <button onClick={handleSubmit} disabled={loading}
            style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, background: loading ? COLORS.gray300 : COLORS.success, color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            {loading ? "جاري الإسناد..." : "✓ تأكيد الإسناد"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================
// Export to CSV
// ===========================
async function exportToExcel(type: "supervisors" | "trainees", trainees: Trainee[], supervisors: any[], snapshots: MonthlySnapshot[], selectedMonth: string) {
  if (type === "supervisors") {
    const summaryData: CsvRow[] = supervisors.map(sup => {
      const supSnaps = snapshots.filter(s => s.supervisorId === sup.id);
      const totalInd = supSnaps.reduce((a, s) => a + (s.individualHours || 0), 0);
      const totalGrp = supSnaps.reduce((a, s) => a + (s.groupHours || 0), 0);
      return { "المشرف": sup.name, "الإيميل": sup.email, "عدد المتدربين": trainees.filter(t => t.currentSupervisorId === sup.id).length, "فردية": totalInd, "جماعية": totalGrp, "الإجمالي": totalInd + totalGrp };
    });
    downloadCsv(`تقرير-المشرفين-${selectedMonth}.csv`, summaryData);
  } else {
    const summaryData: CsvRow[] = trainees.map(t => {
      const sup = supervisors.find(s => s.id === t.currentSupervisorId);
      return { "المتدرب": t.name, "الإيميل": t.email, "الجوال": t.phone, "الرخصة": t.license, "الساعات المطلوبة": t.requiredHours, "فردية": t.totalIndividualHours || 0, "جماعية": t.totalGroupHours || 0, "الإجمالي": t.totalHours || 0, "المتبقي": t.requiredHours - (t.totalHours || 0), "المشرف الحالي": sup?.name || "—", "الحالة": STATUS_LABELS[t.status] };
    });
    downloadCsv(`تقرير-المتدربين-${selectedMonth}.csv`, summaryData);
  }
}

// ===========================
// Main Component
// ===========================
export default function AdminSupervisionPanel({ supervisors, initialTrainees = [], initialSnapshots = [] }: {
  supervisors: any[];
  initialTrainees?: any[];
  initialSnapshots?: any[];
}) {
  const [trainees] = useState<Trainee[]>(initialTrainees as Trainee[]);
  const [snapshots] = useState<MonthlySnapshot[]>(initialSnapshots as MonthlySnapshot[]);
  const [activeTab, setActiveTab] = useState<"supervisors" | "trainees" | "onboarding" | "months">("supervisors");
  const [selectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAddModal, setShowAddModal] = useState(false);
  const [assigningTrainee, setAssigningTrainee] = useState<Trainee | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);

  const stats = {
    total: trainees.length,
    active: trainees.filter(t => t.status === "active").length,
    onboarding: trainees.filter(t => t.status === "onboarding").length,
    paused: trainees.filter(t => t.status === "paused").length,
  };

  const handleSetStage = async (traineeId: string, stage: OnboardingStage) => {
    setLoadingStage(traineeId + stage);
    try {
      await apiPatch({ traineeId, action: 'updateOnboarding', stage });
      window.location.reload();
    } catch (e: any) {
      alert("حدث خطأ: " + e.message);
      setLoadingStage(null);
    }
  };

  const handleChangeStatus = async (traineeId: string, status: TraineeStatus) => {
    await apiPatch({ traineeId, action: 'updateStatus', status });
    window.location.reload();
  };

  const handleLock = async (supervisorId: string, traineeId: string, month: string) => {
    await apiPut({ supervisorId, traineeId, month, action: 'lock' });
    window.location.reload();
  };

  const handleUnlock = async (supervisorId: string, traineeId: string, month: string) => {
    await apiPut({ supervisorId, traineeId, month, action: 'unlock' });
    window.location.reload();
  };

  const handleExport = async (type: "supervisors" | "trainees") => {
    setExportLoading(true);
    try { await exportToExcel(type, trainees, supervisors, snapshots, selectedMonth); }
    finally { setExportLoading(false); }
  };

  const tabs = [
    { key: "supervisors", label: "إنتاجية المشرفين" },
    { key: "trainees", label: "المتدربون" },
    { key: "onboarding", label: "البوردنق" },
    { key: "months", label: "إدارة الأشهر" },
  ];

  return (
    <div style={{ direction: "rtl", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "إجمالي المتدربين", value: stats.total, color: COLORS.primary },
            { label: "نشط", value: stats.active, color: COLORS.success },
            { label: "مؤجل", value: stats.paused, color: COLORS.warning },
            { label: "قيد البوردنق", value: stats.onboarding, color: COLORS.gray500 },
          ].map(s => (
            <div key={s.label} style={{ background: COLORS.gray100, borderRadius: 10, padding: "10px 16px", border: `1px solid ${COLORS.gray200}` }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: COLORS.gray500 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => handleExport("supervisors")} disabled={exportLoading}
            style={{ padding: "8px 14px", border: `1px solid ${COLORS.gray300}`, borderRadius: 10, background: "#fff", color: COLORS.gray500, fontSize: 13, cursor: "pointer" }}>
            📊 تصدير المشرفين
          </button>
          <button onClick={() => handleExport("trainees")} disabled={exportLoading}
            style={{ padding: "8px 14px", border: `1px solid ${COLORS.gray300}`, borderRadius: 10, background: "#fff", color: COLORS.gray500, fontSize: 13, cursor: "pointer" }}>
            📋 تصدير المتدربين
          </button>
          <button onClick={() => setShowAddModal(true)}
            style={{ padding: "8px 16px", border: "none", borderRadius: 10, background: COLORS.deep, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + إضافة متدرب
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.gray200}`, marginBottom: "1.25rem" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", border: "none", borderBottom: activeTab === t.key ? `2px solid ${COLORS.primary}` : "2px solid transparent", background: "none", color: activeTab === t.key ? COLORS.primary : COLORS.gray500, fontWeight: activeTab === t.key ? 600 : 400, fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== تبويب المشرفين ===== */}
      {activeTab === "supervisors" && (
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${COLORS.gray200}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.gray200}`, background: COLORS.gray100, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>تقرير الإنتاجية — {formatMonth(selectedMonth)}</span>
            <span style={{ fontSize: 12, color: COLORS.gray500 }}>{supervisors.length} مشرف</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr style={{ background: COLORS.gray100 }}>
                  {["المشرف", "المتدربون", "فردية", "جماعية", "الإجمالي"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: COLORS.gray500, fontWeight: 500, textAlign: "right", borderBottom: `1px solid ${COLORS.gray200}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supervisors.map(sup => {
                  const supSnaps = snapshots.filter(s => s.supervisorId === sup.id);
                  const totalInd = supSnaps.reduce((a, s) => a + (s.individualHours || 0), 0);
                  const totalGrp = supSnaps.reduce((a, s) => a + (s.groupHours || 0), 0);
                  const traineeCount = trainees.filter(t => t.currentSupervisorId === sup.id && t.status === "active").length;
                  return (
                    <tr key={sup.id} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E6F1FB", color: "#0C447C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{sup.name?.slice(0, 2)}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{sup.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.gray500 }}>{sup.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>{traineeCount}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: COLORS.primary }}>{totalInd}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "#0891b2" }}>{totalGrp}</td>
                      <td style={{ padding: "12px 16px", fontSize: 15, fontWeight: 700 }}>{totalInd + totalGrp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== تبويب المتدربين ===== */}
      {activeTab === "trainees" && (
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${COLORS.gray200}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.gray200}`, background: COLORS.gray100 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>قائمة المتدربين ({trainees.filter(t => t.status !== "onboarding").length})</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ background: COLORS.gray100 }}>
                  {["المتدرب", "الرخصة", "المشرف", "فردية", "جماعية", "التقدم", "الحالة", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: COLORS.gray500, fontWeight: 500, textAlign: "right", borderBottom: `1px solid ${COLORS.gray200}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trainees.filter(t => t.status !== "onboarding").map(t => {
                  const sup = supervisors.find(s => s.id === t.currentSupervisorId);
                  const pct = Math.min(Math.round(((t.totalHours || 0) / t.requiredHours) * 100), 100);
                  const statusStyle = STATUS_COLORS[t.status];
                  return (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#E6F1FB", color: "#0C447C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>{t.name?.slice(0, 2)}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.gray500 }}>{t.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}><Badge label={t.license} bg={COLORS.gray100} color={COLORS.gray500} /></td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: COLORS.gray500 }}>{sup?.name || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500 }}>{t.totalIndividualHours || 0}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500 }}>{t.totalGroupHours || 0}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 5, background: COLORS.gray200, borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? COLORS.success : COLORS.primary, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: COLORS.gray500 }}>{t.totalHours || 0}/{t.requiredHours}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <select value={t.status} onChange={e => handleChangeStatus(t.id, e.target.value as TraineeStatus)}
                          style={{ padding: "4px 8px", fontSize: 11, border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: statusStyle.bg, color: statusStyle.color, cursor: "pointer", fontFamily: "inherit" }}>
                          {(Object.keys(STATUS_LABELS) as TraineeStatus[]).filter(s => s !== "onboarding").map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {!t.currentSupervisorId && t.status === "active" && (
                          <button onClick={() => setAssigningTrainee(t)}
                            style={{ padding: "5px 10px", border: `1px solid ${COLORS.success}`, borderRadius: 8, background: "#E1F5EE", color: COLORS.success, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                            إسناد
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {trainees.filter(t => t.status !== "onboarding").length === 0 && (
                  <tr><td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: COLORS.gray500, fontSize: 13 }}>لا يوجد متدربون بعد</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== تبويب البوردنق ===== */}
      {activeTab === "onboarding" && (
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${COLORS.gray200}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.gray200}`, background: COLORS.gray100, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>المتدربون قيد البوردنق</span>
            <span style={{ fontSize: 12, color: COLORS.gray500 }}>{stats.onboarding} متدرب</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.gray100 }}>
                  {["المتدرب", "الرخصة", "الجوال", "المرحلة", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: COLORS.gray500, fontWeight: 500, textAlign: "right", borderBottom: `1px solid ${COLORS.gray200}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trainees.filter(t => t.status === "onboarding").map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${COLORS.gray200}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F1EFE8", color: "#5F5E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>{t.name?.slice(0, 2)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: COLORS.gray500 }}>{t.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}><Badge label={t.license} bg={COLORS.gray100} color={COLORS.gray500} /></td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: COLORS.gray500, direction: "ltr", textAlign: "right" }}>{t.phone}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {/* أزرار المراحل */}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {ONBOARDING_STAGES.map(stage => {
                          const isCurrent = t.onboardingStage === stage.key;
                          const isLoading = loadingStage === t.id + stage.key;
                          return (
                            <button
                              key={stage.key}
                              onClick={() => !isCurrent && handleSetStage(t.id, stage.key)}
                              disabled={isLoading}
                              style={{
                                padding: "5px 10px",
                                fontSize: 11,
                                borderRadius: 8,
                                cursor: isCurrent ? "default" : "pointer",
                                fontFamily: "inherit",
                                fontWeight: isCurrent ? 600 : 400,
                                border: isCurrent ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.gray300}`,
                                background: isCurrent ? "#E6F1FB" : "#fff",
                                color: isCurrent ? COLORS.primary : COLORS.gray500,
                                opacity: isLoading ? 0.6 : 1,
                              }}
                            >
                              {isCurrent ? "✓ " : ""}{isLoading ? "..." : stage.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {t.onboardingStage === "contracting" && (
                        <button onClick={() => setAssigningTrainee(t)}
                          style={{ padding: "6px 14px", border: `1px solid ${COLORS.success}`, borderRadius: 8, background: "#E1F5EE", color: COLORS.success, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                          ✓ إسناد لمشرف
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {trainees.filter(t => t.status === "onboarding").length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: COLORS.gray500, fontSize: 13 }}>لا يوجد متدربون قيد البوردنق حالياً</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== تبويب الأشهر ===== */}
      {activeTab === "months" && (
        <div>
          <div style={{ background: "#E6F1FB", border: "1px solid #85B7EB", borderRadius: 10, padding: "10px 14px", marginBottom: "1rem", display: "flex", gap: 10, fontSize: 13, color: "#185FA5" }}>
            <span>ℹ️</span>
            <div>
              <strong>القفل التلقائي مفعّل</strong>
              <p style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>مع بداية كل شهر جديد، يُقفل الشهر السابق تلقائياً. يمكن للأدمن إعادة فتح أي شهر عند الحاجة.</p>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${COLORS.gray200}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.gray200}`, background: COLORS.gray100 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.deep }}>إدارة الأشهر — {formatMonth(selectedMonth)}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: COLORS.gray100 }}>
                    {["المشرف", "المتدرب", "فردية", "جماعية", "الإجمالي", "الحالة", ""].map(h => (
                      <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: COLORS.gray500, fontWeight: 500, textAlign: "right", borderBottom: `1px solid ${COLORS.gray200}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(snap => {
                    const sup = supervisors.find(s => s.id === snap.supervisorId);
                    const trainee = trainees.find(t => t.id === snap.traineeId);
                    const isLocked = !!snap.lockedAt;
                    return (
                      <tr key={snap.id} style={{ borderBottom: `1px solid ${COLORS.gray200}`, opacity: isLocked ? 0.75 : 1 }}>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>{sup?.name || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>{trainee?.name || "—"}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500 }}>{snap.individualHours}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500 }}>{snap.groupHours}</td>
                        <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700 }}>{snap.totalHours}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {isLocked
                            ? <Badge label={`🔒 مقفول${snap.lockedBy === "auto" ? " تلقائياً" : ""}`} bg={COLORS.gray100} color={COLORS.gray500} />
                            : <Badge label="🔓 مفتوح" bg="#EAF3DE" color="#3B6D11" />}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {isLocked
                            ? <button onClick={() => handleUnlock(snap.supervisorId, snap.traineeId, snap.month)} style={{ padding: "5px 10px", border: `1px solid ${COLORS.success}`, borderRadius: 8, background: "#E1F5EE", color: COLORS.success, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>فتح</button>
                            : <button onClick={() => handleLock(snap.supervisorId, snap.traineeId, snap.month)} style={{ padding: "5px 10px", border: `1px solid ${COLORS.gray300}`, borderRadius: 8, background: COLORS.gray100, color: COLORS.gray500, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>قفل</button>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {snapshots.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: COLORS.gray500, fontSize: 13 }}>لا توجد بيانات لهذا الشهر</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddModal && <AddTraineeModal onClose={() => setShowAddModal(false)} />}
      {assigningTrainee && <AssignModal trainee={assigningTrainee} supervisors={supervisors} onClose={() => setAssigningTrainee(null)} />}
    </div>
  );
}
