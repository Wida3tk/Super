import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import AdminSupervisionPanel from '@/components/admin/AdminSupervisionPanel';

interface Props { params: { locale: string }; }

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);
    const [supervisorsSnap, traineesSnap] = await Promise.all([
      adminDb.collection('supervisors').get(),
      adminDb.collection('trainees').where('status', '==', 'onboarding').get(),
    ]);
    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const trainees = traineesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const readyToAssign = trainees.filter((t: any) => t.onboardingStage === 'contracting').length;
    return (
      <AdminPageLayout locale={locale} title="البوردنق والإسناد">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { emoji: '🎓', val: trainees.length, label: 'قيد البوردنق', color: '#D97706', border: '#D97706' },
            { emoji: '🎯', val: readyToAssign, label: 'جاهزون للإسناد', color: '#DC2626', border: '#DC2626' },
            { emoji: '📝', val: trainees.filter((t: any) => t.onboardingStage === 'initial_interview').length, label: 'مقابلة أولية', color: '#64748B', border: '#64748B' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #E2E8F0', borderTop: `3px solid ${s.border}` }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <AdminSupervisionPanel supervisors={supervisors} initialTrainees={trainees} initialSnapshots={[]} />
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
