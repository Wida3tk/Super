import DemoLauncher from "@/components/demo/DemoLauncher";

export default function DemoPage() {
  return <main dir="rtl" className="demo-page">
    <style>{`
      *{box-sizing:border-box}.demo-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 12% 12%,#55d7ff33,transparent 28%),linear-gradient(135deg,#001442,#0736c8);font-family:'IBM Plex Sans Arabic',Arial;color:#001442}.demo-shell{width:min(920px,100%);display:grid;grid-template-columns:1fr 1.15fr;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 30px 90px #0006}.demo-brand{padding:52px 42px;background:#f7faff}.demo-brand img{height:48px}.demo-brand h1{font-size:34px;margin:32px 0 12px}.demo-brand p{color:#64748b;line-height:1.9}.demo-note{margin-top:28px;padding:14px;border-radius:13px;background:#ecfdf5;color:#047857;font-size:12px;line-height:1.7}.demo-choice{padding:52px 42px;display:flex;flex-direction:column;justify-content:center}.demo-choice h2{font-size:23px;margin:0 0 8px}.demo-choice>p{font-size:13px;color:#64748b;margin:0 0 22px}.demo-actions{display:grid;gap:12px}.demo-actions button{text-align:right;border:1px solid #dce5f4;background:#fff;border-radius:16px;padding:18px 20px;cursor:pointer;font:inherit;transition:.18s}.demo-actions button:hover{border-color:#0d40fc;background:#f5f8ff;transform:translateY(-2px)}.demo-actions button:disabled{opacity:.6}.demo-actions span{display:block;font-weight:800;font-size:16px;color:#0d40fc}.demo-actions small{display:block;color:#64748b;margin-top:5px}.demo-loading,.demo-error{padding:10px;border-radius:10px;text-align:center;font-size:12px}.demo-loading{background:#eef4ff;color:#0d40fc}.demo-error{background:#fef2f2;color:#b91c1c}@media(max-width:720px){.demo-shell{grid-template-columns:1fr}.demo-brand,.demo-choice{padding:30px 24px}.demo-brand h1{font-size:27px;margin-top:22px}}
    `}</style>
    <section className="demo-shell">
      <div className="demo-brand"><img src="/logo.svg" alt="سلوكيرا"/><h1>جرّب الواجهة الموحّدة للإشراف</h1><p>تجوّل داخل تجربة متكاملة توضح رحلة المتدرب وأدوات المشرف في منصة سلوكيرا.</p><div className="demo-note">بيانات التجربة وهمية ومنفصلة عن حسابات العملاء والمشرفين الحقيقيين.</div></div>
      <div className="demo-choice"><h2>اختر الواجهة التي تريد تجربتها</h2><p>لا تحتاج إلى إنشاء حساب أو إدخال كلمة مرور.</p><DemoLauncher/></div>
    </section>
  </main>;
}
