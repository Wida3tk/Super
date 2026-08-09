// src/lib/email/emailService.ts

interface BookingEmailData {
  studentName: string;
  studentEmail: string;
  supervisorName: string;
  supervisorEmail?: string;
  date: string;
  time: string;
  meetLink: string;
  managementToken: string;
  referenceNumber?: string;
  locale?: 'ar' | 'en';
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://super-gray-zeta.vercel.app';
const PRIMARY = '#0D40FC';
const DEEP = '#001442';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!apiKey) {
    console.log('[EMAIL MOCK]', { to, subject });
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${process.env.EMAIL_FROM_NAME || 'سلوكيرا'} <${process.env.EMAIL_FROM_ADDRESS || 'noreply@sulukera.com'}>`,
      to, subject, html,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    console.error('Resend API error:', JSON.stringify(error));
    throw new Error(`Email failed: ${JSON.stringify(error)}`);
  }
  const result = await res.json();
  console.log('[EMAIL SENT]', { to, subject, id: result.id });
}

export async function sendTraineeInvitationEmail(data: { name: string; email: string; resetLink: string; supervisorName: string }): Promise<void> {
  const html = baseTemplate(`
    <h2>مرحبًا ${data.name}</h2>
    <p>تم إنشاء حسابك في منصة سلوكيرا وإسنادك إلى المشرف <strong>${data.supervisorName}</strong>.</p>
    <p>اضغط الزر التالي لإنشاء كلمة المرور والدخول إلى لوحة تسجيل الساعات:</p>
    <div style="text-align:center;margin:24px 0"><a href="${data.resetLink}" class="btn">إنشاء كلمة المرور</a></div>
    <p style="font-size:12px;color:#94A3B8">هذا الرابط مخصص لك، فلا تشاركه مع أي شخص.</p>
  `);
  await sendEmail(data.email, 'إنشاء حساب المتدرب في منصة سلوكيرا', html);
}

// ─── Template base ───────────────────────────────────────────────
function baseTemplate(content: string, dir: 'rtl' | 'ltr' = 'rtl') {
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${dir==='rtl'?'ar':'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><style>
  body{margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
  .header{background:linear-gradient(135deg,${PRIMARY},${DEEP});padding:28px 36px;text-align:center;}
  .logo{font-size:28px;font-weight:900;color:${PRIMARY};letter-spacing:-1px;}
  .logo-en{font-size:12px;color:#55D7FF;letter-spacing:0.15em;opacity:.8;margin-top:2px;}
  .body{padding:32px 36px;}
  .footer{background:#F8FAFC;padding:20px 36px;text-align:center;border-top:1px solid #EEF2F7;}
  .footer p{color:#94A3B8;font-size:12px;margin:0;}
  .ref-box{background:linear-gradient(135deg,rgba(13,64,252,0.05),rgba(85,215,255,0.05));border:1.5px dashed rgba(13,64,252,0.2);border-radius:12px;padding:16px;text-align:center;margin:20px 0;}
  .ref-label{font-size:12px;color:#8898AA;margin-bottom:4px;}
  .ref-num{font-size:22px;font-weight:900;color:${PRIMARY};letter-spacing:0.08em;font-family:monospace;}
  table.details{width:100%;border-collapse:collapse;margin:20px 0;border-radius:10px;overflow:hidden;}
  table.details td{padding:12px 16px;font-size:14px;}
  table.details tr:nth-child(odd) td{background:#F8FAFC;}
  table.details td:first-child{font-weight:700;color:#001442;width:40%;}
  table.details td:last-child{color:#4A5568;}
  .btn{display:inline-block;background:${PRIMARY};color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;margin:8px 4px;}
  .btn-outline{display:inline-block;background:transparent;color:${PRIMARY};padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:13px;border:1.5px solid rgba(13,64,252,0.3);margin:8px 4px;}
  .alert-box{background:rgba(245,158,11,0.07);border:1.5px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px 18px;margin:16px 0;}
  .alert-title{font-size:13px;font-weight:700;color:#d97706;margin-bottom:8px;}
  .alert-item{font-size:12px;color:#4A5568;margin-bottom:5px;display:flex;align-items:flex-start;gap:6px;}
  h2{color:${DEEP};font-size:20px;margin:0 0 8px;}
  p{color:#4A5568;font-size:14px;line-height:1.7;margin:8px 0;}
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">سلوكيرا</div>
    <div class="logo-en">SULUKERA</div>
  </div>
  <div class="body">${content}</div>
  <div class="footer"><p>منصة الإشراف الأكاديمي · سلوكيرا © ${new Date().getFullYear()}</p></div>
</div></body></html>`;
}

// ─── 1. تأكيد الحجز — للطالب ─────────────────────────────────────
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const manageUrl = `${APP_URL}/ar/manage-booking/${data.managementToken}`;
  const lookupUrl = `${APP_URL}/ar/booking-lookup`;

  const html = baseTemplate(`
    <h2>مرحباً ${data.studentName}، 🎉</h2>
    <p>تم تأكيد حجز جلستك بنجاح. إليك كل التفاصيل:</p>

    ${data.referenceNumber ? `
    <div class="ref-box">
      <div class="ref-label">رقم الحجز المرجعي — احتفظ به</div>
      <div class="ref-num">${data.referenceNumber}</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:6px;">يمكنك تتبع حجزك عبر هذا الرقم</div>
    </div>` : ''}

    <table class="details">
      <tr><td>👨‍🏫 المشرف</td><td>${data.supervisorName}</td></tr>
      <tr><td>📅 التاريخ</td><td>${data.date}</td></tr>
      <tr><td>🕐 الوقت</td><td>${data.time}</td></tr>
      <tr><td>⏱️ المدة</td><td>30 دقيقة</td></tr>
    </table>

    <div style="text-align:center;margin:24px 0;">
      ${data.meetLink ? `<a href="${data.meetLink}" class="btn">🎥 انضم عبر Google Meet</a>` : ''}
      <a href="${manageUrl}" class="btn-outline">⚙️ إدارة الحجز</a>
    </div>

    <div class="alert-box">
      <div class="alert-title">📌 تعليمات قبل الجلسة</div>
      <div class="alert-item">• تأكد من استقرار اتصال الإنترنت قبل 5 دقائق</div>
      <div class="alert-item">• احضر ورقة وقلم لتدوين الملاحظات</div>
      <div class="alert-item">• كن في مكان هادئ خالٍ من الإزعاج</div>
      <div class="alert-item">• افتح رابط Google Meet قبل دقيقتين من الموعد</div>
    </div>

    <p style="font-size:12px;color:#94A3B8;margin-top:20px;">
      للاستفسار أو الإلغاء: <a href="${manageUrl}" style="color:${PRIMARY};">إدارة الحجز</a> |
      تتبع الحجز بالرقم المرجعي: <a href="${lookupUrl}" style="color:${PRIMARY};">اضغط هنا</a>
    </p>
  `);

  await sendEmail(
    data.studentEmail,
    `✅ تم تأكيد حجزك — ${data.date} الساعة ${data.time}`,
    html
  );
}

// ─── 2. إشعار للمشرف عند حجز جديد ───────────────────────────────
export async function sendSupervisorBookingNotification(data: BookingEmailData): Promise<void> {
  if (!data.supervisorEmail) return;

  const html = baseTemplate(`
    <h2>حجز جديد 📬</h2>
    <p>لديك جلسة جديدة محجوزة معك على المنصة.</p>

    <table class="details">
      <tr><td>👤 الطالب</td><td>${data.studentName}</td></tr>
      <tr><td>📅 التاريخ</td><td>${data.date}</td></tr>
      <tr><td>🕐 الوقت</td><td>${data.time}</td></tr>
      <tr><td>⏱️ المدة</td><td>30 دقيقة</td></tr>
      ${data.referenceNumber ? `<tr><td>🔢 الرقم المرجعي</td><td style="font-family:monospace;font-weight:700;">${data.referenceNumber}</td></tr>` : ''}
    </table>

    ${data.meetLink ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${data.meetLink}" class="btn">🎥 رابط Google Meet</a>
    </div>` : ''}

    <p style="font-size:12px;color:#94A3B8;">
      يمكنك إدارة مواعيدك من <a href="${APP_URL}/ar/supervisor-dashboard" style="color:${PRIMARY};">لوحة المشرف</a>
    </p>
  `);

  await sendEmail(
    data.supervisorEmail,
    `📬 حجز جديد — ${data.studentName} | ${data.date} الساعة ${data.time}`,
    html
  );
}

// ─── 3. تذكير قبل 24 ساعة — للطالب ──────────────────────────────
export async function sendReminderEmail(data: BookingEmailData): Promise<void> {
  const html = baseTemplate(`
    <h2>تذكير بجلستك غداً ⏰</h2>
    <p>هذا تذكير بجلسة الإشراف المقررة غداً مع ${data.supervisorName}.</p>

    <table class="details">
      <tr><td>👨‍🏫 المشرف</td><td>${data.supervisorName}</td></tr>
      <tr><td>📅 التاريخ</td><td>${data.date}</td></tr>
      <tr><td>🕐 الوقت</td><td>${data.time}</td></tr>
    </table>

    ${data.meetLink ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${data.meetLink}" class="btn">🎥 انضم عبر Google Meet</a>
    </div>` : ''}

    <div class="alert-box">
      <div class="alert-title">📌 تذكير</div>
      <div class="alert-item">• افتح الرابط قبل دقيقتين من الموعد</div>
      <div class="alert-item">• تأكد من اتصال الإنترنت</div>
    </div>
  `);

  await sendEmail(
    data.studentEmail,
    `⏰ تذكير: جلستك غداً مع ${data.supervisorName} الساعة ${data.time}`,
    html
  );
}

// ─── 4. إيميل الإلغاء — للطالب ───────────────────────────────────
export async function sendCancellationEmail(
  studentEmail: string, studentName: string,
  date: string, time: string, locale: 'ar' | 'en' = 'ar'
): Promise<void> {
  const html = baseTemplate(`
    <h2>تم إلغاء حجزك</h2>
    <p>مرحباً ${studentName}،</p>
    <p>تم إلغاء حجزك ليوم <strong>${date}</strong> الساعة <strong>${time}</strong> بنجاح.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/ar" class="btn">📅 احجز موعداً جديداً</a>
    </div>
    <p style="font-size:12px;color:#94A3B8;">إذا لم تطلب هذا الإلغاء، يرجى التواصل معنا فوراً.</p>
  `);

  await sendEmail(studentEmail, `❌ تم إلغاء حجزك — ${date}`, html);
}
