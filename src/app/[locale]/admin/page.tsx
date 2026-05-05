import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: { locale: string };
}

async function getStats() {
  try {
    const { adminDb, adminAuth } = await import('@/lib/firebase/admin');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;

    if (!sessionCookie) return null;

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) return null;

    const [bookingsSnap, supervisorsSnap] = await Promise.all([
      adminDb.collection('bookings').get(),
      adminDb.collection('supervisors').get(),
    ]);

    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
    const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;

    return { bookings, supervisors, confirmed, cancelled };
  } catch {
    return null;
  }
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  const data = await getStats();

  if (!data) {
    redirect(`/${locale}/login`);
  }

  const { bookings, supervisors, confirmed, cancelled } = data;

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <h1 className="text-white font-bold text-xl">لوحة الإدارة</h1>
        <Link href={`/${locale}`} className="text-slate-400 hover:text-white text-sm">
          الرئيسية
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'إجمالي الحجوزات', value: bookings.length, color: 'sky' },
            { label: 'مؤكدة', value: confirmed, color: 'emerald' },
            { label: 'ملغاة', value: cancelled, color: 'red' },
            { label: 'المشرفون', value: supervisors.length, color: 'amber' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
              <div className={`text-3xl font-bold text-${color}-400`}>{value}</div>
              <div className="text-slate-400 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Bookings Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden mb-8">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-white font-bold">الحجوزات</h2>
            
              href="/api/admin/export"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              📥 تصدير CSV
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-slate-300 font-medium px-4 py-3 text-right">الطالب</th>
                  <th className="text-slate-300 font-medium px-4 py-3 text-right">البريد</th>
                  <th className="text-slate-300 font-medium px-4 py-3 text-center">التاريخ</th>
                  <th className="text-slate-300 font-medium px-4 py-3 text-center">الوقت</th>
                  <th className="text-slate-300 font-medium px-4 py-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b: any) => (
                  <tr key={b.id} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-white">{b.studentName}</td>
                    <td className="px-4 py-3 text-slate-400">{b.studentEmail}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{b.date}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{b.time}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        b.status === 'confirmed' ? 'text-emerald-400 bg-emerald-400/10'
                        : 'text-red-400 bg-red-400/10'
                      }`}>
                        {b.status === 'confirmed' ? 'مؤكد' : 'ملغى'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supervisors */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-bold">المشرفون</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="text-slate-300 font-medium px-4 py-3 text-right">الاسم</th>
                <th className="text-slate-300 font-medium px-4 py-3 text-right">البريد</th>
                <th className="text-slate-300 font-medium px-4 py-3 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.map((s: any) => (
                <tr key={s.id} className="border-t border-slate-700/50">
                  <td className="px-4 py-3 text-white">{s.name}</td>
                  <td className="px-4 py-3 text-slate-400">{s.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      s.isActive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                    }`}>
                      {s.isActive ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
