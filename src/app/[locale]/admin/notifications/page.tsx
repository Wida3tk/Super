import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/layout/AdminSidebar';
import NotificationsClient from '@/components/admin/NotificationsClient';
import LogoutButton from '@/components/LogoutButton';

interface Props { params: Promise<{ locale: string }>; }

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) return null;
    return { adminDb };
  } catch { return null; }
}

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  const auth = await verifyAdmin();
  if (!auth) redirect(`/${locale}/login`);
  const { adminDb } = auth;

  const [notifsSnap, supervisorsSnap] = await Promise.all([
    adminDb.collection('notifications').orderBy('createdAt', 'desc').limit(50).get(),
    adminDb.collection('supervisors').get(),
  ]);

  const notifications = notifsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const supervisors = supervisorsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        body{background:#F8FAFC;direction:rtl;color:#001442;}
        .layout{display:flex;min-height:100vh;}
        .main{flex:1;overflow:auto;}
        .topbar{background:#fff;border-bottom:0.5px solid #EEF2F7;padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;}
        .page-title{font-size:16px;font-weight:600;color:#001442;}
        .content{padding:24px 28px;}
      `}</style>

      <div className="layout" dir="rtl">
        <AdminSidebar locale={locale} notifCount={unreadCount} />
        <div className="main">
          <div className="topbar">
            <div className="page-title">الإشعارات والـ Shoutouts</div>
            <LogoutButton locale={locale} />
          </div>
          <div className="content">
            <NotificationsClient
              notifications={notifications}
              supervisors={supervisors}
            />
          </div>
        </div>
      </div>
    </>
  );
}
