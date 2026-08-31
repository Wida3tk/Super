import Link from "next/link";

interface Props {
  params: Promise<{ locale: string }>;
}

const journeySteps = [
  [
    "01",
    "مقابلة أولية",
    "تتعرّف على المشرف وأسلوبه، وتناقش أهدافك ومسارك قبل اتخاذ القرار.",
  ],
  [
    "02",
    "تقييم فردي",
    "تحديد نقاط القوة والاحتياجات وبناء خطة إشراف شخصية قابلة للمتابعة.",
  ],
  [
    "03",
    "بدء الخطة",
    "توقيع الاتفاقية، تنظيم الوثائق، وتفعيل ملف المتدرب وأدوات تسجيل الساعات.",
  ],
  [
    "04",
    "إشراف منتظم",
    "جلسات فردية وجماعية، تطبيق عملي، ملاحظة أداء، وتغذية راجعة مستمرة.",
  ],
  [
    "05",
    "متابعة التقدم",
    "متابعة الساعات المباشرة وغير المباشرة ونسب الإشراف والتقدم في الكفاءات.",
  ],
  [
    "06",
    "الجاهزية للتقديم",
    "نراجع الساعات والتقارير والنماذج معك، ونبقى إلى جانبك حتى جاهزية ملف الرخصة.",
  ],
];

const benefits = [
  [
    "مشرفك باختيارك",
    "قارن بين الخبرات والاعتمادات واختر أسلوب الإشراف الأنسب لك.",
  ],
  [
    "خطة مصممة لك",
    "تقييم أولي وخطة متابعة ترتبط باحتياجاتك المهنية وتطورك الفعلي.",
  ],
  [
    "تعلم وتطبيق",
    "دمج المعرفة النظرية بالتطبيق العملي وبناء مهارات محلل السلوك.",
  ],
  [
    "ملف إلكتروني متكامل",
    "الساعات والوثائق ومحاضر الاجتماعات والتقييمات في مكان واحد.",
  ],
  [
    "إشراف فردي وجماعي",
    "جلسات منتظمة تجمع التوجيه الشخصي وتبادل الخبرات مع الزملاء.",
  ],
  [
    "دعم متواصل",
    "متابعة أكاديمية وفنية ومصادر وأدوات باللغة العربية والإنجليزية.",
  ],
];

const assistantPlans = [
  { credential: "BCBA", experience: "خبرة 1–5 سنوات", price: "517.5" },
  { credential: "BCBA", experience: "خبرة 6+ سنوات", price: "632.5" },
  { credential: "QBA", experience: "خبرة 1–5 سنوات", price: "442.75" },
  { credential: "QBA", experience: "خبرة 6+ سنوات", price: "557.75" },
];

const analystPlans = [
  { credential: "BCBA", experience: "خبرة 1–5 سنوات", price: "690" },
  { credential: "BCBA", experience: "خبرة 6+ سنوات", price: "843.33" },
  { credential: "QBA", experience: "خبرة 1–5 سنوات", price: "590.33" },
  { credential: "QBA", experience: "خبرة 6+ سنوات", price: "743.67" },
];

export default async function SupervisionJourneyPage({ params }: Props) {
  const { locale } = await params;

  return (
    <main dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;font-family:'IBM Plex Sans Arabic',sans-serif}body{background:#F5FAFF;color:#001442}.nav{height:72px;padding:0 max(24px,calc((100vw - 1180px)/2));display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid #E5ECF6;position:sticky;top:0;z-index:20}.logo{width:116px;height:48px;object-fit:contain}.nav-actions{display:flex;align-items:center;gap:10px}.back,.nav-cta{text-decoration:none;font-size:13px;font-weight:700;padding:9px 15px;border-radius:10px}.back{color:#475569}.nav-cta{background:#0D40FC;color:#fff;box-shadow:0 5px 14px rgba(13,64,252,.2)}
        .hero{position:relative;overflow:hidden;background:linear-gradient(140deg,#001442 0%,#082577 58%,#0D40FC 140%);padding:90px 24px 82px;color:#fff;text-align:center}.hero:before,.hero:after{content:'';position:absolute;border-radius:50%;background:rgba(85,215,255,.09)}.hero:before{width:440px;height:440px;top:-260px;right:-80px}.hero:after{width:340px;height:340px;bottom:-260px;left:5%}.eyebrow{display:inline-flex;padding:7px 16px;border:1px solid rgba(85,215,255,.35);background:rgba(85,215,255,.1);color:#8BE4FF;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:22px}.hero h1{font-size:clamp(36px,6vw,64px);line-height:1.2;margin-bottom:18px}.hero h1 span{color:#55D7FF}.hero p{max-width:780px;margin:auto;color:rgba(255,255,255,.72);font-size:17px;line-height:1.9}.hero-actions{display:flex;justify-content:center;gap:12px;margin-top:30px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:12px;padding:13px 24px;font-size:14px;font-weight:800}.btn-primary{background:#fff;color:#0D40FC;box-shadow:0 12px 28px rgba(0,0,0,.18)}.btn-ghost{color:#fff;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.06)}
        .stats{max-width:1000px;margin:-34px auto 0;position:relative;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid #E4ECF8;border-radius:18px;box-shadow:0 16px 40px rgba(1,20,66,.1);overflow:hidden}.stat{padding:22px;text-align:center}.stat+.stat{border-right:1px solid #E7EDF6}.stat strong{display:block;color:#0D40FC;font-size:22px}.stat span{font-size:11px;color:#64748B}
        .section{max-width:1180px;margin:0 auto;padding:80px 24px}.section-head{text-align:center;max-width:720px;margin:0 auto 38px}.section-kicker{color:#0D40FC;font-size:12px;font-weight:800;margin-bottom:8px}.section h2{font-size:32px;margin-bottom:10px}.section-head p{color:#64748B;line-height:1.8}.path-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.path-card{position:relative;overflow:hidden;background:#fff;border:1px solid #DDE7F5;border-radius:22px;padding:28px;box-shadow:0 9px 28px rgba(1,20,66,.06)}.path-card.featured{background:linear-gradient(145deg,#001442,#082B83);color:#fff;border-color:#082B83}.path-badge{display:inline-flex;padding:5px 11px;border-radius:99px;background:#EAF0FF;color:#0D40FC;font-size:11px;font-weight:800;margin-bottom:15px}.featured .path-badge{background:#ffffff18;color:#7EE4FF}.path-card h3{font-size:24px;margin-bottom:6px}.path-code{font-size:12px;color:#64748B;margin-bottom:20px}.featured .path-code{color:#A8BCE9}.path-numbers{display:grid;grid-template-columns:1fr 1fr;gap:10px}.path-number{padding:16px;border-radius:14px;background:#F5F8FD;border:1px solid #E4EAF4}.featured .path-number{background:#ffffff0d;border-color:#ffffff18}.path-number strong{display:block;font-size:25px;color:#0D40FC}.featured .path-number strong{color:#55D7FF}.path-number span{font-size:11px;color:#64748B}.featured .path-number span{color:#C5D2EF}.path-card p{font-size:13px;line-height:1.8;color:#64748B;margin-top:16px}.featured p{color:#C5D2EF}.journey{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.step{background:#fff;border:1px solid #E1E9F5;border-radius:18px;padding:24px;box-shadow:0 5px 18px rgba(1,20,66,.04)}.step-num{display:flex;width:42px;height:42px;align-items:center;justify-content:center;border-radius:12px;background:#EAF0FF;color:#0D40FC;font-weight:900;margin-bottom:18px}.step h3{font-size:18px;margin-bottom:8px}.step p{color:#64748B;font-size:13px;line-height:1.8}
        .benefits-wrap{background:#ECF5FF}.benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.benefit{background:#fff;border-radius:16px;padding:22px;border:1px solid #DCE8F8}.benefit-icon{color:#10B981;font-weight:900;font-size:20px;margin-bottom:10px}.benefit h3{font-size:16px;margin-bottom:6px}.benefit p{font-size:12px;color:#64748B;line-height:1.75}
        .requirements{display:grid;grid-template-columns:1.05fr .95fr;gap:24px;align-items:stretch}.require-card{background:#001442;color:#fff;border-radius:22px;padding:30px}.require-card h2{font-size:28px;margin-bottom:14px}.require-card p{color:rgba(255,255,255,.66);line-height:1.9}.require-list{margin-top:20px;display:grid;gap:12px}.require-item{padding:13px 15px;border-radius:12px;background:rgba(255,255,255,.07);font-size:13px;line-height:1.7}.note-card{background:#fff;border:1px solid #E1E9F5;border-radius:22px;padding:30px}.note-card h3{font-size:20px;margin-bottom:14px}.note-card p{color:#64748B;font-size:13px;line-height:1.9;margin-bottom:12px}.source-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.source-links a{font-size:11px;color:#0D40FC;text-decoration:none;background:#EEF4FF;border-radius:8px;padding:7px 10px}
        .pricing{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.price-card{background:#fff;border:1px solid #DDE6F3;border-radius:18px;padding:22px;text-align:center}.price-credential{display:inline-flex;background:#EAF0FF;color:#0D40FC;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:800}.price-card h3{font-size:14px;margin:15px 0 8px}.price{font-size:28px;font-weight:900;color:#001442}.price small{font-size:11px;color:#64748B;font-weight:500}.price-note{text-align:center;color:#64748B;font-size:13px;margin-top:18px}.final-cta{max-width:1100px;margin:0 auto 70px;padding:48px 24px;border-radius:26px;text-align:center;color:#fff;background:linear-gradient(135deg,#0D40FC,#001442);box-shadow:0 18px 50px rgba(13,64,252,.2)}.final-cta h2{font-size:31px;margin-bottom:10px}.final-cta p{color:rgba(255,255,255,.7);margin-bottom:24px}.footer{background:#001442;color:rgba(255,255,255,.45);padding:28px;text-align:center;font-size:12px}.footer img{width:100px;filter:brightness(0) invert(1);margin-bottom:10px}
        @media(max-width:850px){.stats{grid-template-columns:repeat(2,1fr);margin:-20px 16px 0}.stat+.stat{border-right:0}.journey,.benefits{grid-template-columns:repeat(2,1fr)}.requirements{grid-template-columns:1fr}.pricing{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.nav{padding:0 16px}.back{display:none}.hero{padding:64px 18px}.hero p{font-size:14px}.stats{grid-template-columns:1fr 1fr}.path-grid,.journey,.benefits,.pricing{grid-template-columns:1fr}.section{padding:58px 18px}.section h2{font-size:26px}.nav-cta{font-size:11px;padding:8px 10px}}
      `}</style>
      <style>{`
        .path-toggle{position:absolute;opacity:0;pointer-events:none}
        .path-tabs{max-width:760px;margin:46px auto 0;padding:6px;display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#E8EFFA;border:1px solid #D7E2F2;border-radius:18px}
        .path-tab{padding:15px 18px;border-radius:13px;text-align:center;color:#64748B;font-size:14px;font-weight:800;cursor:pointer;transition:all .2s}
        .path-tab strong{display:block;font-size:16px;color:inherit}.path-tab span{display:block;font-size:11px;font-weight:600;margin-top:2px}
        .path-panel,.pricing-panel{display:none}
        #path-assistant:checked~.path-tabs label[for="path-assistant"],#path-analyst:checked~.path-tabs label[for="path-analyst"]{background:#fff;color:#0D40FC;box-shadow:0 6px 18px rgba(1,20,66,.1)}
        #path-assistant:checked~.section .assistant-panel,#path-assistant:checked~.section .assistant-pricing,#path-analyst:checked~.section .analyst-panel,#path-analyst:checked~.section .analyst-pricing{display:block}
        .path-panel .path-card{max-width:760px;margin:auto}.duration-chip{display:inline-flex;margin-right:8px;padding:5px 11px;border-radius:99px;background:#ECFDF5;color:#047857;font-size:11px;font-weight:800}.featured .duration-chip{background:#55D7FF1c;color:#7EE4FF}
        @media(max-width:560px){.path-tabs{margin:28px 16px 0}.path-tab{padding:12px 8px}.path-tab strong{font-size:13px}}
      `}</style>

      <nav className="nav">
        <Link href={`/${locale}`}>
          <img className="logo" src="/logo.svg" alt="سلوكيرا" />
        </Link>
        <div className="nav-actions">
          <Link className="back" href={`/${locale}`}>
            العودة للرئيسية
          </Link>
          <Link className="nav-cta" href={`/${locale}#supervisors`}>
            احجز المقابلة الأولية
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">رحلة مهنية منظمة وواضحة</div>
        <h1>
          تعرّف على <span>رحلة الإشراف</span>
        </h1>
        <p>
          إشراف مهني يجمع التطبيق العملي بالتوجيه المنظم، ويساعدك على بناء
          كفاءتك وتوثيق خبرتك الميدانية وفق متطلبات المسار المهني الذي تختاره.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href={`/${locale}#supervisors`}>
            ابدأ بمقابلة أولية — 50 ريال
          </Link>
          <a className="btn btn-ghost" href="#journey">
            استكشف خطوات الرحلة
          </a>
        </div>
      </section>

      <div className="stats">
        <div className="stat">
          <strong>1000 أو 1500 أو 2000</strong>
          <span>ساعة خبرة ميدانية حسب الرخصة</span>
        </div>
        <div className="stat">
          <strong>فردي وجماعي</strong>
          <span>صيغة إشراف مرنة</span>
        </div>
        <div className="stat">
          <strong>نظام ذكي للساعات</strong>
          <span>يحسب التقدم والنسب والمتبقي تلقائيًا</span>
        </div>
        <div className="stat">
          <strong>عن بُعد</strong>
          <span>ومتاح حضوريًا لدى بعض المشرفين</span>
        </div>
      </div>

      <input
        className="path-toggle"
        type="radio"
        name="path"
        id="path-assistant"
        defaultChecked
      />
      <input
        className="path-toggle"
        type="radio"
        name="path"
        id="path-analyst"
      />
      <div
        className="path-tabs"
        role="tablist"
        aria-label="اختيار مسار الإشراف"
      >
        <label className="path-tab" htmlFor="path-assistant">
          <strong>مساعد محلل سلوك</strong>
          <span>تقسيط حتى 12 دفعة</span>
        </label>
        <label className="path-tab" htmlFor="path-analyst">
          <strong>محلل سلوك</strong>
          <span>تقسيط حتى 18 دفعة</span>
        </label>
      </div>

      <section className="section" style={{ paddingBottom: 20 }}>
        <div className="section-head">
          <div className="section-kicker">مساران مهنيان بحسب مؤهلك</div>
          <h2>اختر الرخصة المناسبة لمؤهلك وطموحك</h2>
          <p>
            من أول يوم يربط النظام حساب المتدرب والمشرف بأهداف المسار، ويتابع
            ساعات الخبرة والإشراف المباشر كلًا على حدة.
          </p>
        </div>
        <div className="path-panel assistant-panel">
          <article className="path-card">
            <span className="path-badge">لحملة البكالوريوس</span>
            <span className="duration-chip">حتى 12 دفعة</span>
            <h3>رخصة مساعد محلل سلوك</h3>
            <div className="path-code">QASP-S</div>
            <div className="path-numbers">
              <div className="path-number">
                <strong>1000 أو 1500</strong>
                <span>ساعة خبرة ميدانية</span>
              </div>
              <div className="path-number">
                <strong>50</strong>
                <span>ساعة إشراف مباشر مع مشرفينا</span>
              </div>
            </div>
            <p>
              يتابع المتدرب الساعات المباشرة وغير المباشرة، بينما يعرض النظام
              تقدمه المنفصل نحو هدف الإشراف المباشر.
            </p>
          </article>
        </div>
        <div className="path-panel analyst-panel">
          <article className="path-card featured">
            <span className="path-badge">لحملة الماجستير والدكتوراه</span>
            <span className="duration-chip">18 شهرًا</span>
            <h3>رخصة محلل سلوك</h3>
            <div className="path-code">QBA</div>
            <div className="path-numbers">
              <div className="path-number">
                <strong>2000</strong>
                <span>ساعة خبرة ميدانية</span>
              </div>
              <div className="path-number">
                <strong>100</strong>
                <span>ساعة إشراف مباشر مع مشرفينا</span>
              </div>
            </div>
            <p>
              رحلة أطول تُقسّم إلى تقدم شهري واضح، مع متابعة نسبة الإشراف وتوزيع
              الأنشطة والتقييمات الدورية.
            </p>
          </article>
        </div>
      </section>

      <section className="section" id="journey">
        <div className="section-head">
          <div className="section-kicker">معك خطوة بخطوة حتى الرخصة</div>
          <h2>رحلة إشراف متكاملة حتى جاهزيتك للتقديم</h2>
          <p>
            خطوات واضحة تمنحك رؤية كاملة لما سيحدث، وما الذي ستحصل عليه في كل
            مرحلة.
          </p>
        </div>
        <div className="journey">
          {journeySteps.map(([number, title, description]) => (
            <article className="step" key={number}>
              <div className="step-num">{number}</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="benefits-wrap">
        <section className="section">
          <div className="section-head">
            <div className="section-kicker">لماذا الإشراف مع سلوكيرا؟</div>
            <h2>كل ما تحتاجه في رحلة واحدة</h2>
            <p>
              تجربة إشراف عملية ومنظمة تساعدك على التعلم، التطبيق، التوثيق،
              واتخاذ القرار بثقة.
            </p>
          </div>
          <div className="benefits">
            {benefits.map(([title, description]) => (
              <article className="benefit" key={title}>
                <div className="benefit-icon">✓</div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="section">
        <div className="requirements">
          <article className="require-card">
            <h2>ما الذي نتابعه خلال الإشراف؟</h2>
            <p>
              رحلة منظمة تجمع بناء المهارة بالتطبيق والتوثيق، حتى تعرف في كل شهر
              ما أنجزته وما الذي يحتاج متابعة.
            </p>
            <div className="require-list">
              <div className="require-item">
                تقييم أولي وخطة شخصية تُراجع مع تقدمك.
              </div>
              <div className="require-item">
                لقاءات فردية وجماعية وتغذية راجعة على التطبيق.
              </div>
              <div className="require-item">
                حساب المباشر وغير المباشر ونسبة الإشراف تلقائيًا.
              </div>
              <div className="require-item">
                سجل منظم للمحاضر والوثائق والتقييمات ونماذج البورد.
              </div>
            </div>
          </article>
          <aside className="note-card">
            <h3>أهم متطلبات الجاهزية للرخصة</h3>
            <p>
              المؤهل المناسب للمسار، إكمال الساعات الدراسية المعتمدة، توقيع عقد
              الإشراف قبل بدء احتساب الخبرة، وتوثيق الساعات في النماذج المطلوبة.
            </p>
            <p>
              يتابع النظام نسبة الإشراف الشهرية، توازن الساعات المباشرة وغير
              المباشرة، حد الإشراف الجماعي، والتقييمات الدورية؛ ويعتمد المشرف
              الأنشطة المؤهلة أولًا بأول.
            </p>
            <p>
              <b>
                يحدد المشرف المسار المناسب بعد مراجعة مؤهلك وتاريخ بدء الساعات،
                وتبقى أهلية الاعتماد والقبول النهائي من اختصاص البورد المعني.
              </b>
            </p>
            <div className="source-links">
              <a
                href="https://www.bacb.com/supervision-and-training/"
                target="_blank"
                rel="noreferrer"
              >
                متطلبات BACB الرسمية
              </a>
              <a
                href="https://qababoard.com/pages/qualified-behavior-analyst-credential/"
                target="_blank"
                rel="noreferrer"
              >
                متطلبات QABA الرسمية
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="section-head">
          <div className="section-kicker">خيارات مالية واضحة</div>
          <h2>اختر الخبرة المناسبة لميزانيتك</h2>
          <p>
            تتغير مدة الخطة والأسعار بحسب المسار الذي اخترته أعلاه، وتشمل الخطة
            4 ساعات إشراف شهريًا.
          </p>
        </div>
        <div className="pricing-panel assistant-pricing">
          <div className="pricing">
            {assistantPlans.map((plan) => (
              <article
                className="price-card"
                key={`assistant-${plan.credential}-${plan.experience}`}
              >
                <span className="price-credential">{plan.credential}</span>
                <h3>{plan.experience}</h3>
                <div className="price">
                  {plan.price} <small>ريال / شهريًا</small>
                </div>
                <div style={{ marginTop: 9, fontSize: 11, color: "#64748B" }}>
                  خطة 12 شهرًا
                </div>
              </article>
            ))}
          </div>
          <p className="price-note">مسار مساعد محلل السلوك — خطة 12 شهرًا.</p>
        </div>
        <div className="pricing-panel analyst-pricing">
          <div className="pricing">
            {analystPlans.map((plan) => (
              <article
                className="price-card"
                key={`analyst-${plan.credential}-${plan.experience}`}
              >
                <span className="price-credential">{plan.credential}</span>
                <h3>{plan.experience}</h3>
                <div className="price">
                  {plan.price} <small>ريال / شهريًا</small>
                </div>
                <div style={{ marginTop: 9, fontSize: 11, color: "#64748B" }}>
                  خطة 18 شهرًا
                </div>
              </article>
            ))}
          </div>
          <p className="price-note">مسار محلل السلوك — خطة 18 شهرًا.</p>
        </div>
      </section>

      <section className="final-cta">
        <h2>ابدأ رحلتك بخطوة بسيطة</h2>
        <p>
          اختر المشرف المناسب واحجز مقابلة أولية للتعرّف على أسلوبه والإجابة عن
          أسئلتك.
        </p>
        <Link className="btn btn-primary" href={`/${locale}#supervisors`}>
          استعرض المشرفين واحجز الآن
        </Link>
      </section>

      <footer className="footer">
        <img src="/logo.svg" alt="سلوكيرا" />
        <div>سلوكيرا — رحلة إشراف أكثر وضوحًا وتنظيمًا</div>
      </footer>
    </main>
  );
}
