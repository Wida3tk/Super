import AdminSidebar from './AdminSidebar';
import LogoutButton from '@/components/LogoutButton';

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
        body{background:#F8FAFC;direction:rtl;color:#001442;}
        .layout{display:flex;min-height:100vh;}
        .main{flex:1;overflow:auto;}
        .topbar{background:#fff;border-bottom:0.5px solid #EEF2F7;padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;}
        .page-title{font-size:16px;font-weight:600;color:#001442;}
        .content{padding:24px 28px;}
      `}</style>
      <div className="layout" dir="rtl">
        <AdminSidebar locale={locale} notifCount={notifCount} />
        <div className="main">
          <div className="topbar">
            <div className="page-title">{title}</div>
            <LogoutButton locale={locale} />
          </div>
          <div className="content">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
