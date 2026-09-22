"use client";

import { useState } from "react";
import EditSupervisorPanel from "./EditSupervisorPanel";
import ManageSupervisorAuth from "./ManageSupervisorAuth";
import AddSupervisorButton from "./AddSupervisorButton";
import SupervisorImportClient from "./SupervisorImportClient";
import SupervisorHoursUpdate from "./SupervisorHoursUpdate";

interface Supervisor {
  id: string; name: string; email: string; photo?: string; isActive: boolean;
  availableSeats?: number; upcomingBookings?: number; assignedTrainees?: number;
  accountType?: string; publicProfileId?: string; isProtectedAdmin?: boolean;
}
type Tab = "table" | "edit" | "import";

export default function SupervisorTabs({ supervisors, initialTab = "table", locale = "ar" }: { supervisors: Supervisor[]; initialTab?: Tab; locale?: string }) {
  const [records, setRecords] = useState(supervisors);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [authSupervisor, setAuthSupervisor] = useState<Supervisor | null>(null);
  const [hoursSupervisor, setHoursSupervisor] = useState<Supervisor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "stopped">("all");
  const [workingId, setWorkingId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const activeCount = records.filter((item) => item.isActive).length;
  const visible = records.filter((item) => (statusFilter === "all" || (statusFilter === "active" ? item.isActive : !item.isActive)) && [item.name, item.email].some((value) => String(value || "").toLowerCase().includes(search.trim().toLowerCase())));

  const toggleStatus = async (supervisor: Supervisor) => {
    const nextActive = !supervisor.isActive;
    if (!nextActive && !window.confirm(`إيقاف حساب ${supervisor.name}؟ لن يتمكن من تسجيل الدخول حتى إعادة تفعيله.`)) return;
    setWorkingId(supervisor.id); setActionMessage("");
    const response = await fetch("/api/admin/supervisor", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supervisorId: supervisor.id, isActive: nextActive }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setRecords((current) => current.map((item) => item.id === supervisor.id ? { ...item, isActive: nextActive } : item));
    else setActionMessage(data.error === "ADMIN_PROTECTED" ? "لا يمكن إيقاف حساب الإدارة الرئيسي." : "تعذر تحديث حالة الحساب.");
    setWorkingId("");
  };

  const deleteSupervisor = async (supervisor: Supervisor) => {
    if (supervisor.isProtectedAdmin) return setActionMessage("حساب الإدارة الرئيسي محمي ولا يمكن حذفه.");
    if (Number(supervisor.assignedTrainees || 0) > 0) return setActionMessage(`لا يمكن حذف ${supervisor.name} قبل نقل المتدربين المسندين إليه.`);
    if (Number(supervisor.upcomingBookings || 0) > 0) return setActionMessage(`لا يمكن حذف ${supervisor.name} لوجود مقابلات قادمة.`);
    if (window.prompt(`حذف حساب ${supervisor.name} نهائيًا؟\nاكتبي كلمة حذف للتأكيد:`)?.trim() !== "حذف") return;
    setWorkingId(supervisor.id); setActionMessage("");
    const response = await fetch("/api/admin/supervisor", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supervisorId: supervisor.id, confirmation: "DELETE_SUPERVISOR" }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setRecords((current) => current.filter((item) => item.id !== supervisor.id)); setActionMessage(`تم حذف حساب ${supervisor.name}.`); }
    else { const messages: Record<string, string> = { ADMIN_PROTECTED: "حساب الإدارة الرئيسي محمي.", HAS_ASSIGNED_TRAINEES: "المشرف مرتبط بمتدربين؛ انقليهم أولًا.", HAS_UPCOMING_BOOKINGS: "يوجد للمشرف مقابلات قادمة؛ ألغِيها أو انقليها أولًا." }; setActionMessage(messages[data.error] || "تعذر حذف الحساب."); }
    setWorkingId("");
  };

  return <>
    <style>{css}</style>
    <section className="accounts-hero"><div><h2>إدارة المشرفين من مكان واحد</h2><p>أنشئ الحسابات، راقب الإسناد والمواعيد، وأوقف أو احذف الحسابات غير المستخدمة.</p></div><div className="account-stats"><div className="account-stat"><b>{records.length}</b><span>إجمالي الحسابات</span></div><div className="account-stat"><b>{activeCount}</b><span>حساب نشط</span></div><div className="account-stat"><b>{records.reduce((sum, item) => sum + Number(item.assignedTrainees || 0), 0)}</b><span>متدربون مسندون</span></div></div></section>
    <div className="sup-tabs"><button className={`sup-tab${tab === "table" ? " active" : ""}`} onClick={() => setTab("table")}>الحسابات والعمليات</button><button className={`sup-tab${tab === "edit" ? " active" : ""}`} onClick={() => setTab("edit")}>الصفحات التعريفية</button><button className={`sup-tab${tab === "import" ? " active" : ""}`} onClick={() => setTab("import")}>استيراد ملف مشرف</button></div>
    {tab === "edit" && <EditSupervisorPanel supervisors={records} />}
    {tab === "import" && <SupervisorImportClient embedded onImported={() => setTab("table")} />}
    {tab === "table" && <div className="table-shell">
      <div className="account-tools"><div className="tool-filters"><input className="account-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم المشرف أو بريده..." />{([["all", "الكل"], ["active", "النشطون"], ["stopped", "الموقوفون"]] as const).map(([key, label]) => <button key={key} className={`filter-btn${statusFilter === key ? " active" : ""}`} onClick={() => setStatusFilter(key)}>{label}</button>)}</div><AddSupervisorButton supervisors={records} /></div>
      {actionMessage && <div className="action-message">{actionMessage}</div>}
      {!records.length ? <div className="empty-filter">لا يوجد مشرفون حتى الآن.</div> : !visible.length ? <div className="empty-filter">لا توجد حسابات تطابق البحث أو التصفية الحالية.</div> : <div className="table-wrap"><table><thead><tr><th>المشرف والحساب</th><th>الحالة</th><th>الإشراف</th><th>المواعيد</th><th>الحساب والصفحة</th><th>إجراءات</th></tr></thead><tbody>{visible.map((supervisor) => {
        const cannotDelete = Boolean(supervisor.isProtectedAdmin || Number(supervisor.assignedTrainees || 0) || Number(supervisor.upcomingBookings || 0));
        return <tr key={supervisor.id}>
          <td><div className="identity"><div className="avatar">{supervisor.photo ? <img src={supervisor.photo} alt="" /> : (supervisor.name || "م")[0]}</div><div><a className="name" href={`/${locale}/admin/supervisors/${supervisor.id}?view=work`}>{supervisor.name || "—"}</a><small>{supervisor.email || "—"}</small><div className="supervisor-meta"><span>{supervisor.accountType === "consultant" ? "مستشار" : "مشرف"}</span>{supervisor.isProtectedAdmin && <span>حساب الإدارة</span>}</div></div></div></td>
          <td><span className={`badge ${supervisor.isActive ? "active" : "stopped"}`}>{supervisor.isActive ? "نشط" : "موقوف"}</span></td>
          <td><b>{supervisor.assignedTrainees || 0} متدرب</b><small>{supervisor.accountType === "consultant" ? "لا توجد مقاعد" : `${supervisor.availableSeats || 0} مقعد متاح`}</small></td>
          <td><div className="operation-stack"><small>{supervisor.upcomingBookings || 0} مقابلة قادمة</small><a className="schedule" href={`/${locale}/admin/supervisors/${supervisor.id}?view=schedule`}>{supervisor.accountType === "consultant" ? "إدارة المواعيد" : "المواعيد والمقاعد"}</a></div></td>
          <td><div className="row-actions"><button className="account" onClick={() => setAuthSupervisor(supervisor)}>إدارة الدخول</button><button className="hours" onClick={() => setHoursSupervisor(supervisor)}>تحديث الساعات</button><a href={`/${locale}/supervisor/${supervisor.publicProfileId || supervisor.id}`} target="_blank" rel="noreferrer">الصفحة العامة</a><a href={`/${locale}/admin/supervisors/${supervisor.id}?view=work`}>ملف العمل</a></div></td>
          <td><div className="row-actions"><button className={supervisor.isActive ? "stop" : "start"} disabled={workingId === supervisor.id || supervisor.isProtectedAdmin} onClick={() => toggleStatus(supervisor)}>{supervisor.isActive ? "إيقاف" : "تفعيل"}</button><button className="delete" disabled={workingId === supervisor.id || cannotDelete} title={cannotDelete ? "الحذف غير متاح لوجود ارتباطات أو لأن الحساب محمي" : "حذف الحساب"} onClick={() => deleteSupervisor(supervisor)}>حذف</button></div></td>
        </tr>;
      })}</tbody></table></div>}
    </div>}
    {authSupervisor && <ManageSupervisorAuth supervisor={authSupervisor} onClose={() => { setAuthSupervisor(null); window.location.reload(); }} />}
    {hoursSupervisor && <SupervisorHoursUpdate supervisor={hoursSupervisor} onClose={() => setHoursSupervisor(null)} />}
  </>;
}

const css = `.accounts-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:21px 23px;background:linear-gradient(125deg,#001442,#0D40FC);border-radius:18px;margin-bottom:14px;color:#fff}.accounts-hero h2{font-size:18px;margin:0 0 4px}.accounts-hero p{font-size:12px;color:#cad8ff;margin:0}.account-stats{display:flex;gap:8px}.account-stat{background:#ffffff12;border:1px solid #ffffff20;border-radius:12px;padding:9px 14px;text-align:center;min-width:92px}.account-stat b{display:block;font-size:20px}.account-stat span{font-size:10px;color:#cbd8ff}.sup-tabs{display:flex;border-bottom:1px solid #DFE6F0;overflow:auto}.sup-tab{padding:13px 22px;font:inherit;font-size:12px;font-weight:700;color:#7B8BA2;cursor:pointer;border:0;border-bottom:2px solid transparent;background:none;white-space:nowrap}.sup-tab.active{color:#0D40FC;border-bottom-color:#0D40FC}.table-shell{background:#fff;border:1px solid #E2E8F0;border-radius:0 0 15px 15px;overflow:hidden}.account-tools{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid #EEF2F7}.tool-filters{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.account-search{width:min(310px,100%);padding:9px 12px;border:1px solid #D1D9E6;border-radius:9px;font:inherit}.filter-btn{border:1px solid #D8E0EC;background:#fff;color:#64748B;padding:8px 11px;border-radius:9px;font:inherit;font-size:11px;cursor:pointer}.filter-btn.active{background:#EAF0FF;color:#0D40FC;border-color:#B8C8FF;font-weight:800}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px;min-width:920px}th{background:#F8FAFC;padding:11px 14px;color:#7B8BA2;font-size:10px;text-align:right;border-bottom:1px solid #E9EEF5}td{padding:13px 14px;border-bottom:1px solid #EEF2F7;vertical-align:middle;color:#475569}tbody tr:hover{background:#FAFCFF}.identity{display:flex;align-items:center;gap:10px}.avatar{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#0D40FC,#55D7FF);display:grid;place-items:center;color:#fff;font-weight:800;overflow:hidden;flex:0 0 auto}.avatar img{width:100%;height:100%;object-fit:cover}.name{display:block;color:#001442;font-weight:800;text-decoration:none;font-size:13px}.identity small,td>small,.operation-stack small{display:block;color:#8A9AAF;font-size:10px;margin-top:3px}.supervisor-meta{display:flex;gap:5px;margin-top:5px}.supervisor-meta span{background:#F1F5F9;color:#64748B;padding:2px 6px;border-radius:99px;font-size:9px}.badge{display:inline-flex;padding:5px 10px;border-radius:99px;font-size:10px;font-weight:800}.badge.active{background:#E8F8F2;color:#047857}.badge.stopped{background:#F1F5F9;color:#64748B}.operation-stack{display:grid;gap:6px;justify-items:start}.schedule{white-space:nowrap;color:#047857;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:6px 9px;text-decoration:none;font-weight:700}.row-actions{display:flex;gap:5px;flex-wrap:wrap}.row-actions button,.row-actions a{border:0;border-radius:7px;padding:6px 8px;font:inherit;font-size:9.5px;font-weight:750;cursor:pointer;text-decoration:none;white-space:nowrap}.row-actions a{background:#EEF4FF;color:#0D40FC}.row-actions .account{background:#FFF7E8;color:#B96B00}.row-actions .hours{background:#ECFDF5;color:#047857}.row-actions .stop{background:#FFF7ED;color:#C2410C}.row-actions .start{background:#ECFDF5;color:#047857}.row-actions .delete{background:#FEF2F2;color:#DC2626}.row-actions button:disabled{opacity:.35;cursor:not-allowed}.action-message{margin:10px 16px;padding:10px 12px;border-radius:9px;background:#EFF6FF;color:#1D4ED8;font-size:12px}.empty-filter{padding:40px;text-align:center;color:#64748B;font-size:12px}@media(max-width:760px){.accounts-hero{align-items:flex-start;flex-direction:column}.account-stats{width:100%}.account-stat{flex:1}.account-tools{align-items:stretch;flex-direction:column}.tool-filters{align-items:stretch}.account-search{width:100%}}`;
