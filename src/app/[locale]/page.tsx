import Link from 'next/link';

interface HomePageProps {
  params: { locale: string };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  let supervisors: any[] = [];

  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const snap = await adminDb.collection('supervisors').get();
    supervisors = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((s: any) => s.isActive === true);
  } catch (error) {
    console.error('Firestore error:', error);
    supervisors = [];
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-white font-bold text-xl">
            <span className="text-sky-400">◆</span> منصة الإشراف
          </h1>
          <Link href={`/${locale === 'ar' ? 'en' : 'ar'}`} className="text-slate-300 hover:text-white text-sm bg-slate-700 px-3 py-1.5 rounded-lg">
            {locale === 'ar' ? 'English' : 'عربي'}
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          جلسات الإشراف الأكاديمي
        </h2>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          احجز جلسة مع أحد المشرفين المتخصصين في دقيقتين أو أقل
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 pb-20">
        {supervisors.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            لا يوجد مشرفون متاحون حالياً
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supervisors.map((supervisor) => (
              <div key={supervisor.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 hover:border-sky-500/50 transition-all">
                <h3 className="text-white font-bold text-lg mb-2">{supervisor.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{supervisor.bio}</p>
                <Link
                  href={`/${locale}/supervisor/${supervisor.id}`}
                  className="block w-full text-center bg-sky-500 hover:bg-sky-400 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  عرض البروفايل والحجز
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
