import "server-only";
import { withContractDates } from "@/lib/qaba/contractDates";
import { requiredSupervisionFor } from "@/lib/qaba/compliance";
import { deliveredHoursBySupervisor } from "@/lib/supervision/supervisorHours";

type AdminDb = FirebaseFirestore.Firestore;

/**
 * Data for AdminSupervisionPanel, shared by «الاعتماد الشهري», «الإسناد والتعاقد»
 * and «الإنتاجية». Moved here unchanged from the months page.
 */
export async function loadSupervisionPanelData(adminDb: AdminDb) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [supervisorsSnap, traineesSnap, approvalsSnap, activitiesSnap] = await Promise.all([
    adminDb.collection('supervisors').get(),
    adminDb.collection('trainees').get(),
    adminDb.collection('monthlyApprovals').where('month', '==', currentMonth).get(),
    adminDb.collection('fieldworkActivities').where('month', '==', currentMonth).get(),
  ]);
  const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const trainees = await withContractDates(traineesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  const approvals = new Map(approvalsSnap.docs.map(document => [document.data().traineeId, { id: document.id, ...document.data() }]));
  const approvedByTrainee = new Map<string, any[]>();
  activitiesSnap.docs.forEach(document => {
    const activity = document.data() as any;
    if (activity.status !== 'approved') return;
    approvedByTrainee.set(activity.traineeId, [...(approvedByTrainee.get(activity.traineeId) || []), activity]);
  });
  const snapshots = trainees
    .filter((trainee: any) => trainee.status === 'active' || approvals.has(trainee.id))
    .map((trainee: any) => {
    const approval: any = approvals.get(trainee.id) || {};
    const activities = approvedByTrainee.get(trainee.id) || [];
    const fieldwork = activities.filter(item => item.activityType === 'direct' || item.activityType === 'indirect').reduce((sum, item) => sum + Number(item.duration || 0), 0);
    const supervisionRows = activities.filter(item => String(item.activityType || '').startsWith('supervision_'));
    const supervision = supervisionRows.reduce((sum, item) => sum + Number(item.duration || 0), 0);
    const group = supervisionRows.filter(item => item.format === 'group').reduce((sum, item) => sum + Number(item.duration || 0), 0);
    return {
      id: approval.id || `${trainee.id}_${currentMonth}`,
      ...approval,
      traineeId: trainee.id,
      supervisorId: approval.supervisorId || trainee.currentSupervisorId || '',
      month: currentMonth,
      individualHours: supervision - group,
      groupHours: group,
      totalHours: supervision,
      // Independent hours: the board takes the 5% of these (official monthly log).
      workHours: fieldwork,
      requiredHours: requiredSupervisionFor(fieldwork),
      groupPercentage: supervision ? Math.round((group / supervision) * 1000) / 10 : 0,
      lockedAt: approval.lockedAt || (approval.locked ? approval.traineeAcknowledgedAt || approval.adminApprovedAt : null),
    };
  });
  // Per supervisor, a group session counts once (summing trainee rows would count it per attendee).
  const supervisorTotals = deliveredHoursBySupervisor(activitiesSnap.docs.map(document => document.data() as any), currentMonth);
  return { supervisors, trainees, snapshots, supervisorTotals };
}
