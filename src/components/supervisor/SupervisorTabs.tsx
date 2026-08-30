"use client";

import { useState } from "react";
import BookingsManager from "./BookingsManager";
import SupervisionHours from "./SupervisionHours";
import FieldworkReview from "./FieldworkReview";
import TraineeSupervisionWorkspace from "./TraineeSupervisionWorkspace";
import SupervisionPolicies from "@/components/policies/SupervisionPolicies";

const COLORS = {
  primary: "#0D40FC",
  deep: "#001442",
  gray200: "#EEF2F7",
  gray500: "#8898AA",
};

interface Props {
  bookings: any[];
  supervisorId: string;
  initialTrainees: any[];
  initialSessions: any[];
  initialSnapshots: any[];
  upcomingCount: number;
  traineesCount: number;
  fieldworkActivities: any[];
  supervisor?: any;
}

export default function SupervisorTabs({
  bookings,
  supervisorId,
  initialTrainees,
  initialSessions,
  initialSnapshots,
  upcomingCount,
  traineesCount,
  fieldworkActivities,
  supervisor,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "bookings" | "hours" | "fieldwork" | "workspace" | "policies"
  >("overview");

  const isConsultant = supervisor?.accountType === "consultant";
  const tabs = [
    { key: "overview", label: "نظرة عامة", icon: "⌂", count: 0 },
    { key: "bookings", label: "المقابلات", icon: "🗓️", count: upcomingCount },
    { key: "hours", label: "ساعات الإشراف", icon: "⏱️", count: traineesCount },
  ];
  if (!isConsultant)
    tabs.push({
      key: "fieldwork",
      label: "ساعات المتدربين",
      icon: "📊",
      count: fieldworkActivities.length,
    });
  if (!isConsultant)
    tabs.push({
      key: "workspace",
      label: "ملفات الإشراف",
      icon: "📁",
      count: traineesCount,
    });
  if (!isConsultant)
    tabs.push({ key: "policies", label: "السياسات", icon: "▤", count: 0 });

  return (
    <div>
      {/* Tab Bar */}
      <div
        className="supervisor-tabs"
        style={{
          display: "flex",
          background: "#fff",
          borderRadius: 16,
          border: `1px solid ${COLORS.gray200}`,
          overflow: "hidden",
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(1,20,66,0.05)",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              flex: 1,
              padding: "16px 20px",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: activeTab === t.key ? 700 : 400,
              color: activeTab === t.key ? COLORS.primary : COLORS.gray500,
              background: activeTab === t.key ? "#F0F5FF" : "#fff",
              borderBottom:
                activeTab === t.key
                  ? `3px solid ${COLORS.primary}`
                  : "3px solid transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.count > 0 && (
              <span
                style={{
                  background:
                    activeTab === t.key ? COLORS.primary : COLORS.gray200,
                  color: activeTab === t.key ? "#fff" : COLORS.gray500,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <SupervisorOverview
          trainees={initialTrainees}
          bookings={bookings}
          activities={fieldworkActivities}
          sessions={initialSessions}
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === "bookings" && <BookingsManager bookings={bookings} />}

      {activeTab === "hours" && (
        <SupervisionHours
          supervisorId={supervisorId}
          initialTrainees={initialTrainees}
          initialSessions={initialSessions}
          initialSnapshots={initialSnapshots}
        />
      )}
      {activeTab === "fieldwork" && (
        <FieldworkReview
          initialActivities={fieldworkActivities}
          trainees={initialTrainees}
        />
      )}
      {activeTab === "workspace" && (
        <TraineeSupervisionWorkspace
          trainees={initialTrainees}
          supervisor={supervisor}
        />
      )}
      {activeTab === "policies" && (
        <SupervisionPolicies audience="supervisor" />
      )}
    </div>
  );
}

function SupervisorOverview({
  trainees,
  bookings,
  activities,
  sessions,
  onNavigate,
}: any) {
  const [traineeSearch, setTraineeSearch] = useState("");
  const [traineePage, setTraineePage] = useState(0);
  const pageSize = 6;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings
    .filter((booking: any) => booking.date >= today)
    .slice(0, 4);
  const pendingByTrainee = activities.reduce(
    (result: Record<string, number>, activity: any) => {
      result[activity.traineeId] = (result[activity.traineeId] || 0) + 1;
      return result;
    },
    {},
  );
  const filteredTrainees = trainees.filter((trainee: any) =>
    `${trainee.name || ""} ${trainee.email || ""} ${trainee.license || ""}`
      .toLowerCase()
      .includes(traineeSearch.toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filteredTrainees.length / pageSize));
  const visibleTrainees = filteredTrainees.slice(
    traineePage * pageSize,
    traineePage * pageSize + pageSize,
  );
  return (
    <div>
      <style>{`.supervisor-tabs{overflow-x:auto}.supervisor-overview{display:grid;grid-template-columns:1.25fr .75fr;gap:14px}.overview-card{background:#fff;border:1px solid #EEF2F7;border-radius:15px;padding:15px;box-shadow:0 3px 14px #00144208}.overview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.overview-head h3{font-size:14px}.overview-list{display:grid;gap:6px}.overview-row{display:flex;align-items:center;gap:9px;padding:8px 9px;border:1px solid #EEF2F7;border-radius:10px;background:#FCFDFE}.overview-avatar{width:32px;height:32px;border-radius:9px;background:#EEF4FF;color:#0D40FC;display:grid;place-items:center;font-size:11px;font-weight:800}.overview-main{flex:1;min-width:0}.overview-main b{display:block;font-size:12px}.overview-main span{font-size:10px;color:#8898AA}.overview-action{border:0;background:#EEF4FF;color:#0D40FC;border-radius:7px;padding:6px 9px;cursor:pointer;font:inherit;font-size:10px}.trainee-tools{display:flex;gap:7px;align-items:center}.trainee-search{border:1px solid #DCE3ED;background:#F8FAFC;border-radius:8px;padding:6px 9px;font:inherit;font-size:11px;width:190px}.pager{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:9px;font-size:11px;color:#64748b}.pager button{border:1px solid #DCE3ED;background:#fff;border-radius:7px;padding:4px 9px;cursor:pointer}.pager button:disabled{opacity:.4}.priority-box{background:linear-gradient(145deg,#001442,#0D40FC);color:#fff;border-radius:15px;padding:16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:18px}.priority-box p{color:#CAD8FF;font-size:11px;margin:4px 0;line-height:1.6}.priority-actions{display:flex;gap:7px;flex-wrap:wrap}.priority-actions button{border:1px solid #ffffff25;background:#ffffff12;color:#fff;border-radius:8px;padding:7px 9px;text-align:right;cursor:pointer;font:inherit;font-size:11px}.empty-overview{padding:20px;text-align:center;color:#8898AA;font-size:12px}@media(max-width:850px){.supervisor-overview{grid-template-columns:1fr}.supervisor-tabs>button{min-width:145px!important}.priority-box{align-items:flex-start;flex-direction:column}.trainee-tools{width:100%}.trainee-search{width:100%}}`}</style>
      <div className="priority-box">
        <h2>مساحة عمل الإشراف</h2>
        <p>
          ابدأ بالطلبات التي تحتاج قرارًا، ثم انتقل إلى ملف المتدرب لتوثيق
          الاجتماع أو التقييم أو تحديث الخطة.
        </p>
        <div className="priority-actions">
          <button onClick={() => onNavigate("fieldwork")}>
            ساعات تنتظر المراجعة <b>{activities.length}</b>
          </button>
          <button onClick={() => onNavigate("bookings")}>
            المقابلات القادمة <b>{upcoming.length}</b>
          </button>
          <button onClick={() => onNavigate("workspace")}>
            فتح ملفات المتدربين <b>{trainees.length}</b>
          </button>
        </div>
      </div>
      <div className="supervisor-overview">
        <section className="overview-card">
          <div className="overview-head">
            <h3>المتدربون المسندون إليك</h3>
            <div className="trainee-tools">
              <input
                className="trainee-search"
                value={traineeSearch}
                placeholder="بحث بالاسم أو الرخصة"
                onChange={(e) => {
                  setTraineeSearch(e.target.value);
                  setTraineePage(0);
                }}
              />
              <button
                className="overview-action"
                onClick={() => onNavigate("workspace")}
              >
                إدارة الملفات
              </button>
            </div>
          </div>
          <div className="overview-list">
            {visibleTrainees.map((trainee: any) => (
              <div className="overview-row" key={trainee.id}>
                <div className="overview-avatar">
                  {String(trainee.name || "م").slice(0, 2)}
                </div>
                <div className="overview-main">
                  <b>{trainee.name}</b>
                  <span>
                    {trainee.license || "QASP-S"} ·{" "}
                    {pendingByTrainee[trainee.id] || 0} ساعة تنتظر المراجعة
                  </span>
                </div>
                <button
                  className="overview-action"
                  onClick={() => onNavigate("workspace")}
                >
                  فتح الملف
                </button>
              </div>
            ))}
            {!filteredTrainees.length && (
              <div className="empty-overview">
                لا يوجد متدربون مسندون حاليًا.
              </div>
            )}
          </div>
          {filteredTrainees.length > pageSize && (
            <div className="pager">
              <button
                disabled={traineePage === 0}
                onClick={() => setTraineePage((p) => Math.max(0, p - 1))}
              >
                السابق
              </button>
              <span>
                {traineePage + 1} / {pageCount}
              </span>
              <button
                disabled={traineePage >= pageCount - 1}
                onClick={() =>
                  setTraineePage((p) => Math.min(pageCount - 1, p + 1))
                }
              >
                التالي
              </button>
            </div>
          )}
        </section>
        <div>
          <section className="overview-card" style={{ marginBottom: 16 }}>
            <div className="overview-head">
              <h3>المقابلات القادمة</h3>
            </div>
            <div className="overview-list">
              {upcoming.map((booking: any) => (
                <div className="overview-row" key={booking.id}>
                  <div className="overview-main">
                    <b>{booking.studentName}</b>
                    <span>
                      {booking.date} · {booking.time}
                    </span>
                  </div>
                </div>
              ))}
              {!upcoming.length && (
                <div className="empty-overview">لا توجد مقابلات قادمة.</div>
              )}
            </div>
          </section>
          <section className="overview-card">
            <div className="overview-head">
              <h3>نشاط الشهر</h3>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                textAlign: "center",
              }}
            >
              <div>
                <b style={{ fontSize: 25, color: "#0D40FC" }}>
                  {sessions.length}
                </b>
                <div className="muted">جلسة مسجلة</div>
              </div>
              <div>
                <b style={{ fontSize: 25, color: "#10B981" }}>
                  {trainees.length}
                </b>
                <div className="muted">متدرب نشط</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
