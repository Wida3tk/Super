"use client";

import { useEffect, useRef } from "react";

export default function TraineeWelcome({ traineeId, name, active = false, onOpenGuide }: {
  traineeId: string; name: string; active?: boolean; onOpenGuide?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const storageKey = `sulukera:welcome:v1:${traineeId}:${active ? "active" : "intro"}`;
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== "seen") dialog.current?.showModal();
    } catch { dialog.current?.showModal(); }
  }, [storageKey]);
  function dismiss() {
    try { localStorage.setItem(storageKey, "seen"); } catch { /* Storage may be disabled. */ }
    dialog.current?.close();
  }
  const features = active ? [
    ["◷", "ساعاتك موثّقة", "سجّل ساعات الخبرة الميدانية وتابع اعتمادها، واطّلع على الإشراف الفردي والجماعي الذي يسجّله مشرفك."],
    ["✦", "خطوتك القادمة واضحة", "اطّلع على خطة الإشراف ومهامك وتقارير تقدمك وملاحظات المشرف."],
    ["▤", "ملفك في مكان واحد", "ارفع مستنداتك وأدلة أنشطتك، وراجع اتفاقيتك وأرسل طلباتك للإدارة."],
  ] : [
    ["✦", "تعرّف على مسارك", "تابع تقديم طلبك والمقابلة واعتماد الاتفاقية من حسابك."],
    ["◷", "استعدّ لبدايتك", "بعد اعتماد بدء الإشراف، ستُتاح لك لوحة الساعات والخطة والمهام."],
    ["▤", "ابقَ على اطّلاع", "تابع حالة ملفك ورسائل الإدارة والخطوة التالية في رحلتك."],
  ];
  return <>
    <button type="button" className="welcome-reopen" onClick={() => dialog.current?.showModal()}>✦ عرض الترحيب</button>
    <dialog ref={dialog} className="trainee-welcome" dir="rtl" aria-labelledby="trainee-welcome-title" onCancel={(event) => { event.preventDefault(); dismiss(); }}>
      <button type="button" className="welcome-close" aria-label="إغلاق رسالة الترحيب" onClick={dismiss}>×</button>
      <div className="welcome-banner">
        <span className="welcome-sprout" aria-hidden="true">🌱</span>
        <span className="welcome-eyebrow">بداية واضحة، وتقدّم يستحق التوثيق</span>
        <h2 id="trainee-welcome-title">أهلًا بك، {name || "في سلوكيرا"}</h2>
        <p>في الواجهة الموحّدة للإشراف — سلوكيرا</p>
      </div>
      <div className="welcome-content">
        <p className="welcome-intro">هنا تبدأ رحلتك بخطوات واضحة، ويجتمع كل ما تحتاجه لمتابعة إشرافك في مكان واحد.</p>
        <div className="welcome-features">{features.map(([icon, title, description]) => <div className="welcome-feature" key={title}>
          <span className="welcome-feature-icon" aria-hidden="true">{icon}</span><div><h3>{title}</h3><p>{description}</p></div>
        </div>)}</div>
        <p className="welcome-note">{active ? "ابدأ بالاطلاع على دليل تسجيل الساعات، ثم سجّل أول نشاط لك. كل خطوة توثّقها تجعل تقدمك أوضح. ✨" : "خطوتك الأولى: تابع المرحلة الحالية في مسار الإشراف، وستظهر الخدمات المتاحة لك عند تفعيلها. ✨"}</p>
        <div className="welcome-buttons">
          {active && onOpenGuide && <button type="button" className="welcome-primary" onClick={() => { dismiss(); onOpenGuide(); }}>تعرّف على تسجيل الساعات ←</button>}
          <button type="button" className={active ? "welcome-secondary" : "welcome-primary"} onClick={dismiss}>ابدأ رحلتي</button>
        </div>
        <small className="welcome-footnote">يمكنك عرض هذه الرسالة مجددًا من «عرض الترحيب».</small>
      </div>
    </dialog>
    <style>{`
      .welcome-reopen{font:inherit;font-size:12px;color:#0d40fc;background:#eef4ff;border:1px solid #dbe6ff;border-radius:9px;padding:7px 12px;cursor:pointer;margin-bottom:14px}
      .trainee-welcome{padding:0;border:0;border-radius:24px;width:min(620px,calc(100vw - 28px));max-height:90dvh;overflow:auto;color:#001442;background:#fff;box-shadow:0 28px 100px #00144255;font-family:'IBM Plex Sans Arabic',Arial,sans-serif}
      .trainee-welcome::backdrop{background:#001442ad;backdrop-filter:blur(5px)}
      .welcome-close{position:absolute;top:14px;left:14px;width:34px;height:34px;border:1px solid #ffffff40;border-radius:10px;color:white;background:#ffffff18;font-size:24px;cursor:pointer}
      .welcome-banner{padding:30px 28px 24px;background:radial-gradient(circle at 0% 100%,#0891b2aa,transparent 60%),linear-gradient(135deg,#001442,#0d40fc);color:#fff}
      .welcome-sprout{display:grid;place-items:center;width:54px;height:54px;border-radius:17px;background:#ffffff20;font-size:30px;margin-bottom:14px}
      .welcome-eyebrow{color:#a5f3fc;font-size:12px}.welcome-banner h2{font-size:26px;line-height:1.6;margin:6px 0;overflow-wrap:anywhere}.welcome-banner p{margin:0;color:#dbeafe;font-size:14px}
      .welcome-content{padding:22px 28px}.welcome-intro{margin:0 0 18px;color:#64748b;line-height:1.9;font-size:14px}.welcome-features{display:grid;gap:12px}.welcome-feature{display:flex;gap:12px;padding:13px;border:1px solid #e5edf7;border-radius:14px;background:#f8faff}.welcome-feature-icon{display:grid;place-items:center;flex:0 0 36px;height:36px;color:#0d40fc;background:#e8efff;border-radius:11px;font-size:21px}.welcome-feature h3{font-size:14px;margin:0 0 4px}.welcome-feature p{margin:0;color:#64748b;font-size:12px;line-height:1.85}.welcome-note{padding:12px 14px;background:#ecfdf5;border-radius:12px;color:#065f46;line-height:1.9;font-size:12px;margin:18px 0}
      .welcome-buttons{display:flex;gap:9px;flex-wrap:wrap}.welcome-buttons button{font:inherit;font-size:13px;font-weight:700;padding:11px 16px;border-radius:11px;cursor:pointer}.welcome-primary{background:#0d40fc;color:#fff;border:1px solid #0d40fc;flex:1}.welcome-secondary{background:#fff;color:#475569;border:1px solid #dbe3ef}.welcome-footnote{display:block;text-align:center;color:#64748b;font-size:11px;margin-top:13px}.trainee-welcome button:focus-visible,.welcome-reopen:focus-visible{outline:3px solid #22d3ee;outline-offset:3px}
      @media(max-width:480px){.welcome-banner{padding:24px 20px 20px}.welcome-banner h2{font-size:22px}.welcome-content{padding:18px 20px}.welcome-buttons button{width:100%}}
    `}</style>
  </>;
}
