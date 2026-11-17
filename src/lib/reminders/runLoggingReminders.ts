import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { buildRoster } from "@/lib/admin/supervisorRoster";
import { sendLoggingReminderEmail } from "@/lib/email/emailService";
import { loggingReminders, remindersActive, REMINDERS_START, type ReminderState } from "./logging";

const DAY = 86400000;
const day = (v: unknown) => { const t = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ""; };
const between = (a: string, b: string) => Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Runs once a day from the scheduled job. Returns how many reminders went out. */
export async function runLoggingReminders(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  if (!remindersActive(today)) return { sent: 0, startsOn: REMINDERS_START };
  const month = today.slice(0, 7);
  const windowStart = new Date(now.getTime() - 45 * DAY).toISOString().slice(0, 10);
  const [traineesSnap, supervisorsSnap, rowsSnap] = await Promise.all([
    adminDb.collection("trainees").get(),
    adminDb.collection("supervisors").select("name", "email", "isActive").get(),
    adminDb.collection("fieldworkActivities").where("date", ">=", windowStart)
      .select("traineeId", "date", "duration", "status", "sessionId", "priorCreditId", "activityType").get(),
  ]);
  const trainees = traineesSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({ id: d.id, ...d.data() } as any));
  const supervisors = new Map(supervisorsSnap.docs.map((d) => [d.id, d.data()]));
  const rows = rowsSnap.docs.map((d) => d.data() as any);
  const { standings } = buildRoster({ supervisors: [], trainees, rows, sessions: [], today, windowStart, currentMonth: month, previousMonth: month });
  const own = (r: any) => r.status !== "rejected" && !r.sessionId && !r.priorCreditId && Number(r.duration) > 0;
  const monthHours = new Map<string, number>();
  for (const r of rows) if (own(r) && String(r.date || "").startsWith(month)) monthHours.set(r.traineeId, (monthHours.get(r.traineeId) || 0) + Number(r.duration));

  // Only trainees who use the platform: signed in at least once, or logged hours here.
  // Files imported but not yet activated would otherwise all look silent.
  const signedIn = new Set<string>();
  const uids = trainees.map((t) => t.authUid).filter((u): u is string => typeof u === "string" && Boolean(u));
  for (let i = 0; i < uids.length; i += 100) {
    const { users } = await adminAuth.getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    users.forEach((u) => { if (u.metadata.lastSignInTime) signedIn.add(u.uid); });
  }

  let sent = 0;
  for (const standing of standings) {
    const trainee = trainees.find((t) => t.id === standing.traineeId);
    if (!trainee?.email) continue;
    if (!signedIn.has(trainee.authUid) && !standing.lastLogged) continue;
    const start = day(trainee.lifecycleStageChangedAt);
    const anchor = standing.lastLogged || start;
    const quiet = anchor ? between(anchor, today) : null;
    const actions = loggingReminders(standing, quiet, anchor, monthHours.get(trainee.id) || 0, today, (trainee.loggingReminders || {}) as ReminderState);
    if (!actions.length) continue;
    const update: Record<string, string> = {};
    for (const action of actions) {
      try {
        await sendLoggingReminderEmail({ to: trainee.email, name: trainee.name || "", kind: action.kind, days: quiet ?? undefined, monthHours: Math.round((monthHours.get(trainee.id) || 0) * 10) / 10 });
        await adminDb.collection("notifications").add({
          targetType: "trainee", traineeId: trainee.id, read: false, type: "logging_reminder",
          title: action.kind === "monthEnd" ? "الشهر يقترب من نهايته" : "تذكير بتسجيل الساعات",
          message: action.kind === "monthEnd" ? `سجّلت ${Math.round((monthHours.get(trainee.id) || 0) * 10) / 10} ساعة هذا الشهر، والحد الأدنى 20.` : `لم تسجّل ساعاتك منذ ${quiet} يومًا.`,
          createdAt: now.toISOString(),
        });
        const supervisor = action.toSupervisor ? supervisors.get(trainee.currentSupervisorId) : null;
        if (supervisor?.email && supervisor.isActive !== false) {
          await sendLoggingReminderEmail({ to: supervisor.email, name: supervisor.name || "", kind: "supervisor", days: quiet ?? undefined, traineeName: trainee.name });
          await adminDb.collection("notifications").add({
            targetType: "supervisor", supervisorId: trainee.currentSupervisorId, traineeId: trainee.id, read: false, type: "logging_reminder",
            title: "متدرب لم يسجّل ساعاته", message: `${trainee.name} لم يسجّل ساعات منذ ${quiet} يومًا.`, createdAt: now.toISOString(),
          });
        }
        update[`loggingReminders.${action.kind}`] = action.key;
        sent += 1;
      } catch (error) {
        console.error("[logging-reminders]", trainee.id, action.kind, error);
      }
    }
    if (Object.keys(update).length) await adminDb.collection("trainees").doc(trainee.id).update(update);
  }
  return { sent, startsOn: REMINDERS_START };
}
