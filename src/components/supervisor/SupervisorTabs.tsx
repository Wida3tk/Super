"use client";

import { useState } from "react";
import BookingsManager from "./BookingsManager";
import SupervisionHours from "./SupervisionHours";
import FieldworkReview from "./FieldworkReview";
import TraineeSupervisionWorkspace from "./TraineeSupervisionWorkspace";

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
    "overview" | "bookings" | "hours" | "fieldwork" | "workspace"
  >("overview");

  const tabs = [
    { key: "overview", label: "نظرة عامة", icon: "⌂", count: 0 },
    { key: "bookings", label: "المقابلات", icon: "🗓️", count: upcomingCount },
    { key: "hours", label: "ساعات الإشراف", icon: "⏱️", count: traineesCount },
  ];
  tabs.push({
    key: "fieldwork",
    label: "ساعات المتدربين",
    icon: "📊",
    count: fieldworkActivities.length,
  });
  tabs.push({
    key: "workspace",
    label: "ملفات الإشراف",
    icon: "📁",
    count: traineesCount,
  });

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
  return (
    <div>
      <style>{`.supervisor-tabs{overflow-x:auto}.supervisor-overview{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}.overview-card{background:#fff;border:1px solid #EEF2F7;border-radius:18px;padding:20px;box-shadow:0 6px 22px #0014420a}.overview-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.overview-head h3{font-size:16px}.overview-list{display:grid;gap:9px}.overview-row{display:flex;align-items:center;gap:10px;padding:11px;border:1px solid #EEF2F7;border-radius:12px;background:#FCFDFE}.overview-avatar{width:37px;height:37px;border-radius:11px;background:#EEF4FF;color:#0D40FC;display:grid;place-items:center;font-weight:800}.overview-main{flex:1;min-width:0}.overview-main b{display:block;font-size:13px}.overview-main span{font-size:11px;color:#8898AA}.overview-action{border:0;background:#EEF4FF;color:#0D40FC;border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit;font-size:11px}.priority-box{background:linear-gradient(145deg,#001442,#0D40FC);color:#fff;border-radius:18px;padding:22px;margin-bottom:16px}.priority-box p{color:#CAD8FF;font-size:12px;margin:7px 0 17px;line-height:1.7}.priority-actions{display:grid;gap:8px}.priority-actions button{border:1px solid #ffffff25;background:#ffffff12;color:#fff;border-radius:10px;padding:10px;text-align:right;cursor:pointer;font:inherit}.empty-overview{padding:28px;text-align:center;color:#8898AA;font-size:13px}@media(max-width:850px){.supervisor-overview{grid-template-columns:1fr}.supervisor-tabs>button{min-width:145px!important}}`}</style>
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
            <button
              className="overview-action"
              onClick={() => onNavigate("workspace")}
            >
              إدارة الملفات
            </button>
          </div>
          <div className="overview-list">
            {trainees.map((trainee: any) => (
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
            {!trainees.length && (
              <div className="empty-overview">
                لا يوجد متدربون مسندون حاليًا.
              </div>
            )}
          </div>
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
