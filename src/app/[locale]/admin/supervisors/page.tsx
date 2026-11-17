import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import SupervisorsWorkspace, { type FileData } from '@/components/admin/supervisors/SupervisorsWorkspace';
import { withContractDates } from '@/lib/qaba/contractDates';
import { buildRoster, monthStart } from '@/lib/admin/supervisorRoster';
import { ledgerHistory, supervisorLedger } from '@/lib/admin/supervisorLedger';

interface Props { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string; supervisor?: string; tab?: string }>; }

const serial = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).map(([k, v]: [string, any]) => [k, v?.toDate ? v.toDate().toISOString() : v]));

/**
 * Everything about supervisors on one page: the board of supervisors, and
 * the selected supervisor's file (seats, hours by month and in total,
 * trainees, schedule, public page, account).
 */
export default async function SupervisorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { view, supervisor: selectedId, tab } = await searchParams;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login?portal=admin`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login?portal=admin`);

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const previousMonth = monthStart(currentMonth, 1).slice(0, 7);
    const windowStart = monthStart(currentMonth, 2);
    const [supervisorsSnap, traineesSnap, bookingsSnap, rowsSnap, sessionsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('bookings').where('date', '>=', today).get(),
      adminDb.collection('fieldworkActivities').where('date', '>=', windowStart)
        .select('traineeId', 'supervisorId', 'date', 'month', 'duration', 'format', 'status', 'sessionId', 'priorCreditId', 'activityType', 'traineeAcknowledgment').get(),
      adminDb.collection('sessions').where('month', 'in', [currentMonth, previousMonth]).select('supervisorId', 'type', 'duration', 'month', 'date', 'traineeIds').get(),
    ]);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const supervisors = supervisorsSnap.docs.filter((d) => !d.data().isDemo).map((d) => ({ id: d.id, ...serial(d.data()) })) as any[];
    const trainees = await withContractDates(traineesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any)).filter((t) => !t.isDemo));
    const roster = buildRoster({
      supervisors,
      trainees,
      rows: rowsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any)),
      sessions: sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any)),
      today, windowStart, currentMonth, previousMonth,
    });
    const upcoming = new Map<string, number>();
    bookingsSnap.docs.forEach((d) => {
      const b = d.data();
      if (b.status === 'confirmed' && b.supervisorId) upcoming.set(b.supervisorId, (upcoming.get(b.supervisorId) || 0) + 1);
    });
    const people = supervisors.map((s) => ({
      ...s,
      upcomingBookings: upcoming.get(s.id) || 0,
      assignedTrainees: trainees.filter((t: any) => t.currentSupervisorId === s.id).length,
      isProtectedAdmin: String(s.email || '').trim().toLowerCase() === adminEmail,
    }));

    // The selected supervisor's file: all of their history, read only when opened.
    let file: FileData | null = null;
    const selected = people.find((s) => s.id === selectedId);
    if (selected) {
      let authUid = selected.authUid || '';
      if (!authUid && selected.email) {
        try { authUid = (await adminAuth.getUserByEmail(String(selected.email).toLowerCase())).uid; } catch {}
      }
      const [slots, activitiesSnap, allSessionsSnap, minutesSnap, documentsSnap] = await Promise.all([
        adminDb.collection('availability').where('supervisorId', '==', selected.id).where('date', '>=', today).orderBy('date', 'asc').get(),
        adminDb.collection('fieldworkActivities').where('supervisorId', '==', selected.id).get(),
        adminDb.collection('sessions').where('supervisorId', '==', selected.id).get(),
        adminDb.collection('meetingMinutes').where('supervisorId', '==', selected.id).get(),
        adminDb.collection('supervisionDocuments').where('supervisorId', '==', selected.id).get(),
      ]);
      const clean = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => docs.map((d) => ({ id: d.id, ...serial(d.data()) }));
      const sessions = clean(allSessionsSnap.docs).filter((s: any) => !s.deleted) as any[];
      const activities = clean(activitiesSnap.docs) as any[];
      file = {
        supervisor: { ...selected, authUid },
        history: ledgerHistory(supervisorLedger(sessions, activities).get(selected.id)),
        slots: slots.docs.map((d) => ({ id: d.id, ...serial(d.data()) })),
        work: {
          trainees: trainees.filter((t: any) => t.currentSupervisorId === selected.id).map((t: any) => serial(t)),
          activities, sessions, minutes: clean(minutesSnap.docs), documents: clean(documentsSnap.docs),
        },
      };
    }

    return (
      <AdminPageLayout locale={locale} title={file ? `المشرف: ${file.supervisor.name || ''}` : 'المشرفون'}>
        <SupervisorsWorkspace
          locale={locale}
          people={JSON.parse(JSON.stringify(people))}
          roster={JSON.parse(JSON.stringify(roster))}
          months={{ current: currentMonth, previous: previousMonth }}
          file={file ? JSON.parse(JSON.stringify(file)) : null}
          initialTab={tab}
          initialImport={view === 'import'}
        />
      </AdminPageLayout>
    );
  } catch (error) {
    if (String((error as { code?: string }).code || '').startsWith('auth/')) redirect(`/${locale}/login?portal=admin`);
    throw error;
  }
}
