import { notFound } from 'next/navigation';
import BookingSection from '@/components/booking/BookingSection';
import Link from 'next/link';

interface SupervisorPageProps {
  params: { locale: string; id: string };
}

export default async function SupervisorPage({ params }: SupervisorPageProps) {
  const { locale, id } = await params;

  let supervisor: any = null;
  let availableDates: string[] = [];

  try {
    const { adminDb } = await import('@/lib/firebase/admin');

    const supervisorSnap = await adminDb.collection('supervisors').doc(id).get();
    if (!supervisorSnap.exists) notFound();

    supervisor = { id: supervisorSnap.id, ...supervisorSnap.data() };
    if (!supervisor.isActive) notFound();

    const slotsSnap = await adminDb
      .collection('availability')
      .where('supervisorId', '==', id)
      .where('isBooked', '==', false)
      .get();

    const dates = slotsSnap.docs.map(d => d.data().date as string);
    availableDates = [...new Set(dates)].sort();

  } catch (error) {
    console.error('Error:', error);
    if (!supervisor) notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Link href={`/${locale}`} className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
          {locale === 'ar' ? '→ العودة' : '← Back'}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 md:p-8 mb-8 flex flex-col md:flex-row gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-700 flex-shrink-0 flex items-center justify-center text-4xl">
            👤
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-2">{supervisor?.name}</h1>
            <p className="text-slate-400 mb-4">{supervisor?.bio}</p>
            <div className="flex gap-6">
              <div>
                <span className="text-sky-400 font-bold text-xl">{supervisor?.totalSessions || 0}</span>
                <span className="text-slate-500 text-sm ms-1">إجمالي الجلسات</span>
              </div>
              <div>
                <span className="text-amber-400 font-bold text-xl">
                  {supervisor?.ratingAverage?.toFixed(1) || '0.0'}
                </span>
                <span className="text-slate-500 text-sm ms-1">متوسط التقييم</span>
              </div>
            </div>
          </div>
        </div>

        <BookingSection
          supervisor={supervisor}
          availableDates={availableDates}
          locale={locale}
        />
      </div>
    </div>
  );
}
