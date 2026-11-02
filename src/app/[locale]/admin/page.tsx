import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/layout/AdminPageLayout";
import UiIcon from "@/components/ui/UiIcon";
import { withContractDates } from "@/lib/qaba/contractDates";
import { exceedsGroupSupervisionLimit, traineeRules } from "@/lib/qaba/compliance";
import { LIFECYCLE_STAGES, resolveLifecycleStage } from "@/lib/lifecycle/stages";
import "@/styles/admin-today.css";

interface Props {
  params: Promise<{ locale: string }>;
}

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return null;
  try {
    const { adminAuth, adminDb } = await import("@/lib/firebase/admin");
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase())
      return null;
    return { adminDb };
  } catch {
    return null;
  }
}

export default async function AdminTodayPage({ params }: Props) {
  const { locale } = await params;
  const auth = await verifyAdmin();
  if (!auth) redirect(`/${locale}/login?portal=admin`);
  const { adminDb } = auth;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    traineesSnap,
    supervisorsSnap,
    sessionsSnap,
    snapshotsSnap,
    activitySnap,
    notifsSnap,
    pendingRequestsSnap,
    openIncidentsSnap,
  ] = await Promise.all([
    adminDb.collection("trainees").get(),
    adminDb.collection("supervisors").get(),
    adminDb.collection("sessions").where("month", "==", currentMonth).get(),
    adminDb.collection("monthlySnapshots").where("month", "==", currentMonth).get(),
    adminDb.collection("activityLog").orderBy("createdAt", "desc").limit(8).get(),
    adminDb.collection("notifications").where("read", "==", false).get(),
    adminDb.collection("traineeRequests").where("status", "==", "pending").count().get(),
    adminDb.collection("operationalIncidents").where("status", "==", "open").count().get(),
  ]);

  const allTrainees = traineesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const trainees = (await withContractDates(traineesSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({
    id: d.id,
    ...d.data(),
  })))) as any[];
  const supervisors = supervisorsSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
  const sessions = sessionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((session: any) => !session.deleted) as any[];
  const snapshots = snapshotsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const activities = activitySnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const adminAlerts = (notifsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[])
    .filter((n) => n.targetType === "admin")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 6);

  // Same rules as before the redesign; only the layout changed.
  const activeTrainees = trainees.filter((t) => t.status === "active");
  const onboardingTrainees = trainees.filter((t) => t.status === "onboarding");
  const readyToAssign = trainees.filter(
    (t) => t.status === "onboarding" && t.onboardingStage === "contracting",
  );
  // Same filter as the «طلبات التسجيل» page, so the two counts always agree.
  const newRegistrations = allTrainees.filter(
    (t) => t.lifecycleStage === "registered" || (!t.lifecycleStage && t.registrationSource === "self_registration" && t.onboardingStage === "initial_interview"),
  );
  const totalHours = trainees.reduce((sum, trainee) => sum + Number(trainee.totalIndividualHours || 0) + Number(trainee.totalGroupHours || 0), 0);
  const weekSessions = sessions.filter((s) => s.date >= weekAgo);
  const over25 = snapshots.filter((s) => exceedsGroupSupervisionLimit(s));
  const atRisk = trainees.filter((t) => {
    if (t.status !== "active") return false;
    const snap = snapshots.find((s) => s.traineeId === t.id);
    return snap && (snap.absenceCount || 0) >= 3;
  });

  const traineeProgress = activeTrainees
    .map((t) => {
      const snap = snapshots.find((s) => s.traineeId === t.id);
      const targetHours = traineeRules(t).supervisionTarget;
      const approvedHours = Number(t.totalIndividualHours || 0) + Number(t.totalGroupHours || 0);
      const pct = Math.round((approvedHours / targetHours) * 100);
      return { ...t, pct, targetHours, totalHours: approvedHours, snap };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  const supervisorLoad = supervisors
    .map((sup) => ({
      ...sup,
      traineeCount: activeTrainees.filter((t) => t.currentSupervisorId === sup.id).length,
      hours: snapshots
        .filter((s) => s.supervisorId === sup.id)
        .reduce((a, s) => a + (s.totalHours || 0), 0),
    }))
    .sort((a, b) => b.traineeCount - a.traineeCount);
  const maxLoad = Math.max(1, ...supervisorLoad.map((s) => s.traineeCount));

  const stageCounts = LIFECYCLE_STAGES.map((stage) => ({
    ...stage,
    count: trainees.filter((t) => resolveLifecycleStage(t) === stage.key).length,
  })).filter((stage) => stage.count > 0);

  const timeAgo = (iso: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  const base = `/${locale}/admin`;
  const queue = [
    { label: "طلبات تسجيل جديدة", hint: "سجّلوا من الموقع وتنتظر بدء المقابلة", count: newRegistrations.length, href: `${base}/onboarding`, tone: "info", icon: "inbox" },
    { label: "جاهزون للإسناد", hint: "أكملوا مرحلة التعاقد", count: readyToAssign.length, href: `${base}/assignment`, tone: "info", icon: "target" },
    { label: "طلبات متدربين بانتظار القرار", hint: "تأجيل، نقل، مستندات وغيرها", count: pendingRequestsSnap.data().count, href: `${base}/trainee-requests`, tone: "warning", icon: "file" },
    { label: "متدربون في خطر", hint: "3 غيابات أو أكثر هذا الشهر", count: atRisk.length, href: `${base}/trainees`, tone: "danger", icon: "alert" },
    { label: "تجاوز نسبة الإشراف الجماعي", hint: "سجلات هذا الشهر فوق الحد المسموح", count: over25.length, href: `${base}/months`, tone: "warning", icon: "users" },
    { label: "أعطال تشغيلية مفتوحة", hint: "البريد أو التقويم أو المزامنة", count: openIncidentsSnap.data().count, href: `${base}/operations`, tone: "danger", icon: "activity" },
  ];
  const openItems = queue.filter((item) => item.count > 0);
  const todayLabel = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <AdminPageLayout locale={locale} title="اليوم">
      <div className="sk-today">
        <p className="sk-today-date">
          {todayLabel} · {openItems.length ? `${openItems.reduce((n, item) => n + item.count, 0)} عنصر يحتاج إجراء` : "لا توجد عناصر عاجلة"}
        </p>

        <section className="sk-card sk-queue" aria-labelledby="queue-title">
          <header className="sk-card-head">
            <div>
              <h2 id="queue-title">يحتاج إجراء</h2>
              <p>كل صف يفتح القائمة المطلوبة مباشرة.</p>
            </div>
          </header>
          <ul>
            {queue.map((item) => (
              <li key={item.label} className={item.count ? "" : "is-clear"}>
                <Link href={item.href}>
                  <span className={`sk-queue-icon ${item.count ? item.tone : ""}`}><UiIcon name={item.icon} size={18} /></span>
                  <span className="sk-queue-text">
                    <b>{item.label}</b>
                    <small>{item.hint}</small>
                  </span>
                  <span className={`sk-queue-count ${item.count ? item.tone : ""}`}>{item.count || "لا شيء"}</span>
                  <UiIcon name="arrowLeft" size={16} className="sk-queue-go" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="sk-kpis" aria-label="مؤشرات عامة">
          <div className="sk-kpi">
            <span>ساعات الإشراف المعتمدة</span>
            <b>{totalHours}</b>
            <small>مجموع ساعات المتدربين الفردية والجماعية</small>
          </div>
          <div className="sk-kpi">
            <span>متدربون نشطون</span>
            <b>{activeTrainees.length}</b>
            <small>من أصل {trainees.length} متدرب</small>
          </div>
          <div className="sk-kpi">
            <span>جلسات آخر 7 أيام</span>
            <b>{weekSessions.length}</b>
            <small>فردية وجماعية</small>
          </div>
          <div className="sk-kpi">
            <span>قيد الانضمام</span>
            <b>{onboardingTrainees.length}</b>
            <small>منهم {readyToAssign.length} جاهز للإسناد</small>
          </div>
        </section>

        <div className="sk-today-grid">
          <div className="sk-today-col">
            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>تقدم نحو هدف الإشراف</h2>
                  <p>أعلى 6 متدربين نشطين</p>
                </div>
                <Link className="sk-link" href={`${base}/trainees`}>كل المتدربين</Link>
              </header>
              {traineeProgress.length === 0 ? (
                <p className="sk-empty">لا يوجد متدربون نشطون</p>
              ) : (
                <ul className="sk-progress">
                  {traineeProgress.map((t) => (
                    <li key={t.id}>
                      <Link href={`${base}/trainees/${t.id}`} className="sk-progress-name">{t.name}</Link>
                      <span className="sk-bar" aria-hidden="true">
                        <i className={t.pct >= 100 ? "done" : t.pct >= 75 ? "near" : ""} style={{ width: `${Math.min(t.pct, 100)}%` }} />
                      </span>
                      <span className="sk-progress-val">{t.totalHours}/{t.targetHours} · {t.pct}%</span>
                      <span className="sk-progress-tags">
                        {t.pct >= 100 && <em className="sk-chip success">مكتمل</em>}
                        {t.pct >= 85 && t.pct < 100 && <em className="sk-chip warning">قريب</em>}
                        {(t.snap?.absenceCount || 0) >= 3 && <em className="sk-chip danger">خطر</em>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>توزيع المتدربين على مراحل الرحلة</h2>
                  <p>{trainees.length} متدرب</p>
                </div>
              </header>
              {stageCounts.length === 0 ? (
                <p className="sk-empty">لا يوجد متدربون بعد</p>
              ) : (
                <>
                  <div className="sk-stagebar" aria-hidden="true">
                    {stageCounts.map((stage) => (
                      <i key={stage.key} style={{ flex: stage.count, background: stage.color }} title={`${stage.short}: ${stage.count}`} />
                    ))}
                  </div>
                  <ul className="sk-stages">
                    {stageCounts.map((stage) => (
                      <li key={stage.key}>
                        <i style={{ background: stage.color }} aria-hidden="true" />
                        <span>{stage.short}</span>
                        <b>{stage.count}</b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <div className="sk-today-col">
            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>حمل المشرفين</h2>
                  <p>المتدربون النشطون وساعات الإشراف هذا الشهر</p>
                </div>
                <Link className="sk-link" href={`${base}/productivity`}>الإنتاجية</Link>
              </header>
              {supervisorLoad.length === 0 ? (
                <p className="sk-empty">لا يوجد مشرفون</p>
              ) : (
                <ul className="sk-load">
                  {supervisorLoad.map((sup) => (
                    <li key={sup.id}>
                      <Link href={`${base}/supervisors/${sup.id}`}>{sup.name}</Link>
                      <span className="sk-bar" aria-hidden="true"><i style={{ width: `${(sup.traineeCount / maxLoad) * 100}%` }} /></span>
                      <span className="sk-load-val"><b>{sup.traineeCount}</b> متدرب</span>
                      <span className="sk-load-val"><b>{sup.hours}</b> ساعة</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>تنبيهات للإدارة</h2>
                  <p>تنبيهات النظام غير المقروءة الموجّهة للإدارة</p>
                </div>
              </header>
              {adminAlerts.length === 0 ? (
                <p className="sk-empty">لا توجد تنبيهات جديدة</p>
              ) : (
                <ul className="sk-feed">
                  {adminAlerts.map((n) => (
                    <li key={n.id}>
                      <span>{n.message || n.title || "تنبيه"}</span>
                      <time>{timeAgo(n.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sk-card">
              <header className="sk-card-head">
                <div>
                  <h2>آخر النشاطات</h2>
                  <p>{activities.length} حدث</p>
                </div>
                <Link className="sk-link" href={`${base}/operations`}>سجل التدقيق</Link>
              </header>
              {activities.length === 0 ? (
                <p className="sk-empty">لا توجد نشاطات بعد</p>
              ) : (
                <ul className="sk-feed">
                  {activities.map((a) => (
                    <li key={a.id}>
                      <span>{a.message || a.type}</span>
                      <time>{timeAgo(a.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
