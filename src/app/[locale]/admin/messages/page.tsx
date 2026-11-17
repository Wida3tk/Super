import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';
import { ChatInbox, type ChatPerson } from '@/components/messages/Chat';
import { resolveLifecycleStage } from '@/lib/lifecycle/stages';

interface Props { params: Promise<{ locale: string }>; searchParams: Promise<{ chat?: string }>; }

export default async function MessagesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { chat } = await searchParams;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login?portal=admin`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login?portal=admin`);
    const [supervisorsSnap, traineesSnap] = await Promise.all([
      adminDb.collection('supervisors').select('name', 'isActive', 'isDemo', 'accountType').get(),
      adminDb.collection('trainees').select('name', 'isDemo', 'status', 'lifecycleStage', 'onboardingStage', 'license').get(),
    ]);
    const people: ChatPerson[] = [
      ...traineesSnap.docs.filter(d => !d.data().isDemo && resolveLifecycleStage(d.data()) !== 'completed')
        .map(d => ({ id: d.id, name: String(d.data().name || d.id), kind: 'at' as const, detail: d.data().license })),
      ...supervisorsSnap.docs.filter(d => !d.data().isDemo && d.data().isActive !== false)
        .map(d => ({ id: d.id, name: String(d.data().name || d.id), kind: 'as' as const, detail: d.data().accountType === 'consultant' ? 'مستشار' : undefined })),
    ].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return (
      <AdminPageLayout locale={locale} title="المحادثات">
        <ChatInbox as="admin" people={people} initialId={chat || null} emptyHint="لا محادثات بعد. ابدأ محادثة جديدة مع متدرب أو مشرف." />
      </AdminPageLayout>
    );
  } catch (error) {
    if (String((error as { code?: string }).code || '').startsWith('auth/')) redirect(`/${locale}/login?portal=admin`);
    throw error;
  }
}
