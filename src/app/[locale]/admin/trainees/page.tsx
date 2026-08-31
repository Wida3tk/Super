import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import AdminSupervisionPanel from '@/components/admin/AdminSupervisionPanel';

interface Props { params: Promise<{ locale: string }>; }

export default async function TraineesPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [supervisorsSnap, traineesSnap, snapshotsSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').get(),
      adminDb.collection('monthlySnapshots').where('month', '==', currentMonth).get(),
    ]);
    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const snapshots = snapshotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const active = trainees.filter((t: any) => t.status === 'active').length;
    const onboarding = trainees.filter((t: any) => t.status === 'onboarding').length;
    return (
      <AdminPageLayout locale={locale} title="المتدربون">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { emoji: '👥', val: trainees.length, label: 'إجمالي المتدربين', color: '#4F46E5', border: '#4F46E5' },
            { emoji: '✅', val: active, label: 'نشطون', color: '#16A34A', border: '#16A34A' },
            { emoji: '🎓', val: onboarding, label: 'قيد الانضمام', color: '#D97706', border: '#D97706' },
            { emoji: '⏸️', val: trainees.filter((t: any) => t.status === 'paused').length, label: 'مؤجل', color: '#64748B', border: '#64748B' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #E2E8F0', borderTop: `3px solid ${s.border}` }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <AdminSupervisionPanel supervisors={supervisors} initialTrainees={trainees} initialSnapshots={snapshots} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
