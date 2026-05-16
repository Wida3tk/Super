import AdminSidebar from './AdminSidebar';
import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';

export default function AdminPageLayout({ locale, title, children, notifCount = 0 }: {
  locale: string;
  title: string;
  children: React.ReactNode;
  notifCount?: number;
}) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif;}
        body{background:#F1F5F9;direction:rtl;color:#0F172A;}
        .layout{display:flex;min-height:100vh;}
        .main{flex:1;overflow:auto;}
        .topbar{
          background:#fff;border-bottom:1px solid #E2E8F0;
          padding:0 28px;height:60px;
          display:flex;align-items:center;justify-content:space-between;
          position:sticky;top:0;z-index:10;
          box-shadow:0 1px 3px rgba(0,0,0,0.04);
        }
        .topbar-title{font-size:16px;font-weight:700;color:#0F172A;}
        .content{padding:24px 28px;}
      `}</style>
      <div className="layout" dir="rtl">
        <AdminSidebar locale={locale} notifCount={notifCount} />
        <div className="main">
          <div className="topbar">
            <div className="topbar-title">{title}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link href={`/${locale}/admin/notifications`}
                style={{ width: 38, height: 38, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                <i className="ti ti-bell" style={{ fontSize: 18, color: '#64748B' }} aria-hidden="true" />
              </Link>
              <LogoutButton locale={locale} />
            </div>
          </div>
          <div className="content">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
