"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TraineeLifecyclePanel from "./TraineeLifecyclePanel";
import LegacyImportClient from "./LegacyImportClient";
import { directoryState } from "@/lib/lifecycle/directory";
import UiIcon from "@/components/ui/UiIcon";
import type { TraineeStanding } from "@/lib/admin/supervisorRoster";
import "@/styles/admin-trainees.css";

type View = "manage" | "add" | "import";

export default function TraineeManagementWorkspace({
  locale,
  initialView,
  trainees,
  supervisors,
  transitions,
  initialSupervisor,
  standings = [],
}: {
  locale: string;
  initialView: View;
  trainees: any[];
  supervisors: any[];
  transitions: any[];
  initialSupervisor: string | null;
  standings?: TraineeStanding[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  // The supervisors board moved to «المشرفون»; ?supervisor= still filters this list.
  const selected = initialSupervisor && supervisors.some((s) => s.id === initialSupervisor) ? initialSupervisor : undefined;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    license: "QASP-S",
    supervisorId: "",
  });

  function open(next: View) {
    setView(next);
    setMessage("");
    window.history.replaceState(
      null,
      "",
      `/${locale}/admin/trainees${next === "manage" ? "" : `?view=${next}`}`,
    );
  }

  const count = (key: string) => standings.filter((t) => t.standing === key && !t.paused).length;
  function exportList() {
    const byId = new Map(standings.map((t) => [t.traineeId, t]));
    const names = new Map(supervisors.map((s) => [s.id, s.name]));
    const rows = [["الاسم", "البريد", "الجوال", "الرخصة", "المشرف", "المرحلة", "الساعات المعتمدة", "المطلوب", "المتبقي", "آخر تسجيل ساعات", "الحالة"], ...trainees.map((t) => {
      const s = byId.get(t.id);
      return [t.name, t.email, t.phone, t.license, names.get(t.currentSupervisorId) || "", directoryState(t).main.label, s?.hours ?? "", s?.required ?? "", s?.remaining ?? "", s?.lastLogged || "", s?.standing ? ({ near_finish: "قريب من الإنهاء", inactive: "منقطع", watch: "تحت المراقبة", new: "بداية الإشراف", on_track: "على المسار" } as Record<string, string>)[s.standing] : ""];
    })];
    const csv = "\ufeff" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `المتدربون-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function addTrainee(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/admin/trainee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(
        result.error === "EMAIL_EXISTS"
          ? "هذا البريد مسجل مسبقًا."
          : "تعذر إضافة المتدرب. تحققي من البيانات.",
      );
      return;
    }
    setMessage(
      result.assignmentError
        ? "تمت إضافة المتدرب، لكن تعذر إسناده. افتحي ملفه لإكمال الإسناد؛ لا تعيدي إضافته."
        : result.assigned
          ? "تمت إضافة المتدرب وإسناده للمشرف وتفعيل الإشراف مباشرة."
          : "تمت إضافة المتدرب إلى مرحلة المقابلة الأولية.",
    );
    setForm({
      name: "",
      email: "",
      phone: "",
      license: "QASP-S",
      supervisorId: "",
    });
    if (result.assignmentError) {
      router.refresh();
      return;
    }
    setTimeout(() => {
      open("manage");
      router.refresh();
    }, 900);
  }

  return (
    <div dir="rtl">
      <style>{css}</style>
      <section className="tw-head">
        <div className="tw-head-top">
          <div>
            <h2>المتدربون</h2>
            <p>كل المتدربين في قائمة واحدة: من يحتاج متابعة أولًا، ثم الباقون. اضغط على الاسم لفتح ملفه.</p>
          </div>
          <div className="tw-head-actions">
            <button type="button" className="tw-btn" onClick={exportList}><UiIcon name="download" size={16} /> تصدير القائمة</button>
            <button type="button" className="tw-btn" aria-pressed={view === "import"} onClick={() => open(view === "import" ? "manage" : "import")}><UiIcon name="upload" size={16} /> استيراد ملف متدرب</button>
            <button type="button" className="tw-btn is-primary" aria-pressed={view === "add"} onClick={() => open(view === "add" ? "manage" : "add")}><UiIcon name="plus" size={16} /> إضافة متدرب</button>
          </div>
        </div>
        <div className="tw-stats">
          <div><span>بالإشراف حاليًا</span><b>{trainees.filter((t) => directoryState(t).stage === "active_service").length}</b><small>من {trainees.length} متدرب</small></div>
          <div><span>قريبون من الإنهاء</span><b>{count("near_finish")}</b><small>بقي أقل من 20% أو 3 أشهر</small></div>
          <div className={count("inactive") ? "is-alert" : ""}><span>منقطعون</span><b>{count("inactive")}</b><small>لا ساعات منذ 14 يومًا</small></div>
          <div><span>قيد الانضمام</span><b>{trainees.filter((t) => t.status === "onboarding").length}</b><small>تسجيل، مقابلة، تعاقد</small></div>
          <div><span>مكتملون</span><b>{trainees.filter((t) => directoryState(t).completed).length}</b><small>أنهوا الإشراف</small></div>
        </div>
      </section>
      {view !== "manage" && (
        <button type="button" className="tw-back" onClick={() => open("manage")}><UiIcon name="arrowLeft" size={15} style={{ transform: "scaleX(-1)" }} /> قائمة المتدربين</button>
      )}
      {view === "manage" && (
        <TraineeLifecyclePanel
          supervisors={supervisors}
          trainees={trainees}
          transitions={transitions}
          initialSupervisor={selected}
          standings={standings}
        />
      )}
      {view === "add" && (
        <section className="tm-card">
          <div className="tm-card-head">
            <div>
              <h3>إضافة متدرب جديد</h3>
              <p>
                اختاري المشرف لتفعيل الإشراف مباشرة، أو أضيفي المتدرب دون إسناد.
              </p>
            </div>
            <span>01</span>
          </div>
          <form className="tm-form" onSubmit={addTrainee}>
            <label>
              الاسم الكامل <b>*</b>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اسم المتدرب"
              />
            </label>
            <label>
              البريد الإلكتروني <b>*</b>
              <input
                required
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
              />
            </label>
            <label>
              رقم الجوال <b>*</b>
              <input
                required
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="05XXXXXXXX"
              />
            </label>
            <label>
              المسار <b>*</b>
              <select
                value={form.license}
                onChange={(e) => setForm({ ...form, license: e.target.value })}
              >
                <option value="QASP-S">
                  مساعد محلل سلوك — 1000 ساعة / 50 إشراف
                </option>
                <option value="QBA">محلل سلوك — 2000 ساعة / 100 إشراف</option>
              </select>
            </label>
            <label>
              المشرف (اختياري)
              <select
                value={form.supervisorId}
                onChange={(event) =>
                  setForm({ ...form, supervisorId: event.target.value })
                }
              >
                <option value="">دون إسناد حاليًا</option>
                {supervisors
                  .filter(
                    (s) =>
                      s.isActive !== false && s.accountType !== "consultant",
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="tm-note">
              اختيار مشرف يفعّل الإشراف مباشرة للمتدرب المضاف يدويًا. دون اختيار
              مشرف، يبقى الملف في مرحلة المقابلة الأولية.
            </div>
            {message && <div className="tm-message">{message}</div>}
            <div className="tm-actions">
              <button type="button" onClick={() => open("manage")}>
                إلغاء
              </button>
              <button className="primary" disabled={loading}>
                {loading ? "جارٍ الإضافة..." : "إضافة المتدرب"}
              </button>
            </div>
          </form>
        </section>
      )}
      {view === "import" && (
        <LegacyImportClient
          embedded
          onImported={() => {
            open("manage");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

const css = `.tm-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:16px 20px;border-radius:14px;background:#fff;border:1px solid #E6EBF2;color:#0F1B33;margin-bottom:14px}.tm-hero span{font-size:12px;color:#0D40FC;font-weight:600}.tm-hero h2{font-size:17px;margin:3px 0}.tm-hero p{font-size:13px;color:#6B7A92;margin:0}.tm-stats{display:flex;gap:8px}.tm-stats div{min-width:95px;padding:2px 16px;border-inline-start:1px solid #EFF3F8;text-align:center}.tm-stats b{display:block;font-size:22px;color:#001442}.tm-stats small{font-size:12px;color:#6B7A92}.tm-tabs{display:flex;gap:4px;padding:6px;background:#fff;border:1px solid #E2E8F0;border-radius:13px;margin-bottom:14px;overflow:auto}.tm-tabs button{border:0;background:transparent;color:#64748B;font:inherit;font-size:12px;font-weight:800;padding:10px 16px;border-radius:9px;cursor:pointer;white-space:nowrap}.tm-tabs button.active{background:#0D40FC;color:#fff;box-shadow:0 5px 12px #0D40FC30}.tm-card{background:#fff;border:1px solid #E2E8F0;border-radius:18px;overflow:hidden;max-width:850px;margin:auto}.tm-card-head{display:flex;justify-content:space-between;padding:22px 24px;background:#F8FAFF;border-bottom:1px solid #E6ECF5}.tm-card-head h3{margin:0 0 5px;color:#001442}.tm-card-head p{margin:0;color:#64748B;font-size:12px}.tm-card-head span{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#E8EEFF;color:#0D40FC;font-weight:900}.tm-form{display:grid;grid-template-columns:1fr 1fr;gap:17px;padding:24px}.tm-form label{display:grid;gap:7px;font-size:12px;font-weight:800;color:#334155}.tm-form label b{color:#DC2626}.tm-form input,.tm-form select{width:100%;padding:11px 12px;border:1px solid #CBD5E1;border-radius:9px;background:#fff;font:inherit}.tm-form input:focus,.tm-form select:focus{outline:0;border-color:#0D40FC;box-shadow:0 0 0 3px #0D40FC12}.tm-note,.tm-message,.tm-actions{grid-column:1/-1}.tm-note{padding:11px 13px;background:#EFF6FF;color:#1D4ED8;border-radius:9px;font-size:11px}.tm-message{padding:11px 13px;background:#ECFDF5;color:#047857;border-radius:9px;font-size:12px;font-weight:800}.tm-actions{display:flex;justify-content:flex-end;gap:8px}.tm-actions button{padding:10px 18px;border:0;border-radius:9px;background:#F1F5F9;color:#475569;font:inherit;font-weight:800;cursor:pointer}.tm-actions .primary{background:#0D40FC;color:#fff}.tm-actions button:disabled{opacity:.55}@media(max-width:760px){.tm-hero{align-items:flex-start;flex-direction:column}.tm-stats{width:100%}.tm-stats div{min-width:0;flex:1}.tm-form{grid-template-columns:1fr}.tm-note,.tm-message,.tm-actions{grid-column:auto}}`;
