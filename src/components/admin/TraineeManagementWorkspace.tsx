"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TraineeDirectory, { scopeOf, type Jump, type Scope } from "./trainees/TraineeDirectory";
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
  initialScope = "serving",
  standings = [],
}: {
  locale: string;
  initialView: View;
  trainees: any[];
  supervisors: any[];
  transitions: any[];
  initialSupervisor: string | null;
  initialScope?: Scope;
  standings?: TraineeStanding[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  // The supervisors board moved to «المشرفون»; ?supervisor= still filters this list.
  const selected = initialSupervisor && supervisors.some((s) => s.id === initialSupervisor) ? initialSupervisor : undefined;
  const [loading, setLoading] = useState(false);
  const [jump, setJump] = useState<Jump | null>(null);
  const go = (scope: Scope, follow?: Jump["follow"]) => {
    if (view !== "manage") open("manage");
    setJump((j) => ({ scope, follow, n: (j?.n || 0) + 1 }));
  };
  const scopes = { serving: 0, graduates: 0, onboarding: 0 };
  for (const t of trainees) scopes[scopeOf(directoryState(t).stage)] += 1;
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

  const count = (key: string) => standings.filter((t) => t.standing === key && !t.paused && t.serving).length;
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
      <section className="tw-head">
        <div className="tw-head-top">
          <div>
            <h2>المتدربون</h2>
            <p>من هم بالإشراف أولًا، والمتخرجون في قسم مستقل. اضغطي على أي رقم لعرض أصحابه.</p>
          </div>
          <div className="tw-head-actions">
            <button type="button" className="tw-btn" onClick={exportList}><UiIcon name="download" size={16} /> تصدير القائمة</button>
            <button type="button" className="tw-btn" aria-pressed={view === "import"} onClick={() => open(view === "import" ? "manage" : "import")}><UiIcon name="upload" size={16} /> استيراد ملف متدرب</button>
            <button type="button" className="tw-btn is-primary" aria-pressed={view === "add"} onClick={() => open(view === "add" ? "manage" : "add")}><UiIcon name="plus" size={16} /> إضافة متدرب</button>
          </div>
        </div>
        <div className="tw-stats">
          <button type="button" onClick={() => go("serving")}><span>بالإشراف حاليًا</span><b>{scopes.serving}</b><small>من {trainees.length} متدرب</small></button>
          <button type="button" onClick={() => go("serving", "near_finish")}><span>قريبون من الإنهاء</span><b>{count("near_finish")}</b><small>بقي أقل من 20% أو 3 أشهر</small></button>
          <button type="button" className={count("inactive") ? "is-alert" : ""} onClick={() => go("serving", "inactive")}><span>منقطعون</span><b>{count("inactive")}</b><small>لا ساعات منذ 14 يومًا</small></button>
          <button type="button" onClick={() => go("graduates")}><span>المتخرجون</span><b>{scopes.graduates}</b><small>أنهوا الإشراف</small></button>
          <Link href={`/${locale}/admin/onboarding`}><span>قيد الانضمام</span><b>{scopes.onboarding}</b><small>تُدار من لوحة الانضمام ←</small></Link>
        </div>
      </section>
      {view !== "manage" && (
        <button type="button" className="tw-back" onClick={() => open("manage")}><UiIcon name="arrowLeft" size={15} style={{ transform: "scaleX(-1)" }} /> قائمة المتدربين</button>
      )}
      {view === "manage" && (
        <TraineeDirectory
          supervisors={supervisors}
          trainees={trainees}
          transitions={transitions}
          initialSupervisor={selected}
          initialScope={initialScope}
          standings={standings}
          jump={jump}
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
