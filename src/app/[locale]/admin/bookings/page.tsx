import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminPageLayout from '@/components/admin/layout/AdminPageLayout';

interface Props { params: { locale: string }; }

const COLORS = { primary: '#0D40FC', gray200: '#EEF2F7', gray500: '#8898AA', deep: '#001442', gray100: '#F8FAFC', gray700: '#4A5568' };

export default async function BookingsPage({ params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect(`/${locale}/login`);
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) redirect(`/${locale}/login`);
    const bookingsSnap = await adminDb.collection('bookings').orderBy('createdAt', 'desc').get();
    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    return (
      <AdminPageLayout locale={locale} title="الحجوزات">
        <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'إجمالي الحجوزات', val: bookings.length, color: COLORS.primary },
            { label: 'مؤكدة', val: confirmed, color: '#10B981' },
            { label: 'ملغاة', val: cancelled, color: '#EF4444' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '0.5px solid #EEF2F7' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: COLORS.gray500 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #EEF2F7', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #EEF2F7', display: 'flex', justifyContent: 'space-between', background: COLORS.gray100 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>جميع الحجوزات</span>
            <a href="/api/admin/export" style={{ fontSize: 12, color: COLORS.primary, textDecoration: 'none', fontWeight: 500 }}>📥 تصدير CSV</a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: COLORS.gray100 }}>
                  {['الطالب', 'البريد', 'التاريخ', 'الوقت', 'المشرف', 'الحالة'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: COLORS.gray500, fontWeight: 500, borderBottom: '0.5px solid #EEF2F7' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} style={{ borderBottom: '0.5px solid #EEF2F7' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{b.studentName || '—'}</td>
                    <td style={{ padding: '12px 16px', color: COLORS.gray500, fontSize: 12 }}>{b.studentEmail || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{b.date || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{b.time || '—'}</td>
                    <td style={{ padding: '12px 16px', color: COLORS.gray500, fontSize: 12 }}>{b.supervisorId || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: b.status === 'confirmed' ? '#EAF3DE' : b.status === 'cancelled' ? '#FCEBEB' : '#FAEEDA', color: b.status === 'confirmed' ? '#3B6D11' : b.status === 'cancelled' ? '#A32D2D' : '#854F0B' }}>
                        {b.status === 'confirmed' ? '✓ مؤكد' : b.status === 'cancelled' ? '✕ ملغى' : '⏳ معلق'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminPageLayout>
    );
  } catch { redirect(`/${locale}/login`); }
}
