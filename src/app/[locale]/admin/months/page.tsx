import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import MonthWorkspace from '@/components/admin/months/MonthWorkspace';
import { requireAdmin } from '@/lib/auth/serverAuth';
import { adminDb } from '@/lib/firebase/admin';
import { withContractDates } from '@/lib/qaba/contractDates';
import { buildMonthCycle } from '@/lib/admin/controlRoom';
import { ackState } from '@/lib/supervision/sessionAcknowledgment';
import type { FieldworkActivity } from '@/types';

interface Props { params: Promise<{ locale: string }>; searchParams: Promise<{ month?: string; stage?: string; alert?: string }>; }

const monthsBack = (count: number) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
};

/**
 * «الاعتماد الشهري»: the whole month in one place: where every trainee stands
 * in the cycle, the alerts, sessions the trainee has not confirmed, and the
 * admin's lock and reopen.
 */
export default async function MonthsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  if (!(await requireAdmin())) redirect(`/${locale}/login?portal=admin`);
  const months = monthsBack(6);
  const month = months.includes(String(query.month)) ? String(query.month) : months[0];
  const [traineesSnap, supervisorsSnap, activitiesSnap, sessionsSnap, approvalsSnap] = await Promise.all([
    adminDb.collection('trainees').get(),
    adminDb.collection('supervisors').select('name', 'isDemo').get(),
    adminDb.collection('fieldworkActivities').where('month', '==', month).get(),
    adminDb.collection('sessions').where('month', '==', month).get(),
    adminDb.collection('monthlyApprovals').where('month', '==', month).get(),
  ]);
  const trainees = (await withContractDates(traineesSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({ id: d.id, ...d.data() } as any)))) as any[];
  const activities = activitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FieldworkActivity[];
  const approvals = approvalsSnap.docs.map((d) => d.data()) as any[];
  const inMonth = new Set([...activities.map((a) => a.traineeId), ...approvals.map((a) => a.traineeId)]);
  const cycle = buildMonthCycle({
    trainees: trainees.filter((t) => t.status === 'active' || inMonth.has(t.id)),
    activities,
    sessions: sessionsSnap.docs.filter((d) => !d.data().deleted).map((d) => ({ id: d.id, data: d.data() })),
    approvals,
    monthClosed: month < months[0],
  });
  const names = new Map(trainees.map((t) => [t.id, String(t.name || t.id)]));
  const openSessions = activities.flatMap((row) => {
    const state = ackState(row);
    if (state !== 'pending' && state !== 'disputed') return [];
    return [{ activityId: row.id, traineeId: row.traineeId, traineeName: names.get(row.traineeId) || row.traineeId, supervisorId: row.supervisorId, date: String(row.date || ''), duration: Number(row.duration) || 0, format: row.format || 'individual', state, note: row.traineeAcknowledgment?.note || null }];
  });
  const locked = Object.fromEntries(approvals.map((a) => [a.traineeId, Boolean(a.locked)]));
  const supervisors = Object.fromEntries(supervisorsSnap.docs.filter((d) => !d.data().isDemo).map((d) => [d.id, String(d.data().name || d.id)]));

  return (
    <AdminPageLayout locale={locale} title="الاعتماد الشهري">
      <MonthWorkspace
        locale={locale}
        month={month}
        months={months}
        cycle={JSON.parse(JSON.stringify(cycle))}
        locked={locked}
        supervisors={supervisors}
        openSessions={openSessions}
        initialStage={query.stage}
        initialAlert={query.alert}
      />
    </AdminPageLayout>
  );
}
