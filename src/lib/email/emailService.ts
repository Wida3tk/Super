// src/lib/email/emailService.ts
// خدمة البريد — تستخدم Resend (يمكن استبداله بـ SendGrid أو Nodemailer)

interface BookingEmailData {
  studentName: string;
  studentEmail: string;
  supervisorName: string;
  date: string;
  time: string;
  meetLink: string;
  managementToken: string;
  locale?: 'ar' | 'en';
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;

  if (!apiKey) {
    console.log('[EMAIL MOCK]', { to, subject });
    return;
  }

  // استخدام Resend API
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  }
}

/**
 * بريد تأكيد الحجز — للطالب
 */
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const manageUrl = `${APP_URL}/${data.locale || 'ar'}/manage-booking/${data.managementToken}`;
  const isArabic = data.locale === 'ar';

  const subject = isArabic
    ? `✅ تم تأكيد حجزك — ${data.date}`
    : `✅ Booking Confirmed — ${data.date}`;

  const html = isArabic
    ? `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1a1a2e;">مرحباً ${data.studentName}،</h2>
        <p>تم تأكيد حجز جلسة الإشراف بنجاح.</p>
        <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">المشرف</td><td style="padding:8px;">${data.supervisorName}</td></tr>
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">التاريخ</td><td style="padding:8px;">${data.date}</td></tr>
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">الوقت</td><td style="padding:8px;">${data.time}</td></tr>
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">المدة</td><td style="padding:8px;">30 دقيقة</td></tr>
        </table>
        <a href="${data.meetLink}" style="display:inline-block; background:#0ea5e9; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; margin: 10px 0;">
          🎥 انضم عبر Google Meet
        </a>
        <p style="margin-top: 20px; color: #666;">
          لإلغاء الحجز أو إدارته: <a href="${manageUrl}">اضغط هنا</a>
        </p>
        <hr style="margin-top:30px; border:none; border-top:1px solid #eee;">
        <p style="color:#999; font-size:12px;">منصة حجز جلسات الإشراف الأكاديمي</p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Hello ${data.studentName},</h2>
        <p>Your supervision session has been confirmed.</p>
        <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">Supervisor</td><td style="padding:8px;">${data.supervisorName}</td></tr>
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">Date</td><td style="padding:8px;">${data.date}</td></tr>
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">Time</td><td style="padding:8px;">${data.time}</td></tr>
          <tr><td style="padding:8px; background:#f8f8f8; font-weight:bold;">Duration</td><td style="padding:8px;">30 minutes</td></tr>
        </table>
        <a href="${data.meetLink}" style="display:inline-block; background:#0ea5e9; color:white; padding:12px 24px; border-radius:8px; text-decoration:none;">
          🎥 Join via Google Meet
        </a>
        <p style="margin-top: 20px; color: #666;">
          Manage your booking: <a href="${manageUrl}">Click here</a>
        </p>
      </div>
    `;

  await sendEmail(data.studentEmail, subject, html);
}

/**
 * بريد الإلغاء — للطالب
 */
export async function sendCancellationEmail(
  studentEmail: string,
  studentName: string,
  date: string,
  time: string,
  locale: 'ar' | 'en' = 'ar'
): Promise<void> {
  const subject =
    locale === 'ar' ? `❌ تم إلغاء حجزك — ${date}` : `❌ Booking Cancelled — ${date}`;

  const html =
    locale === 'ar'
      ? `<div dir="rtl" style="font-family:Arial,sans-serif;"><h2>مرحباً ${studentName}،</h2><p>تم إلغاء حجزك ليوم ${date} الساعة ${time}.</p><p>يمكنك حجز موعد جديد عبر المنصة.</p></div>`
      : `<div style="font-family:Arial,sans-serif;"><h2>Hello ${studentName},</h2><p>Your booking for ${date} at ${time} has been cancelled.</p><p>You can rebook at any time.</p></div>`;

  await sendEmail(studentEmail, subject, html);
}

/**
 * تذكير قبل 24 ساعة
 */
export async function sendReminderEmail(data: BookingEmailData): Promise<void> {
  const subject =
    data.locale === 'ar'
      ? `⏰ تذكير: جلستك غداً الساعة ${data.time}`
      : `⏰ Reminder: Your session tomorrow at ${data.time}`;

  const html =
    data.locale === 'ar'
      ? `<div dir="rtl" style="font-family:Arial,sans-serif;"><h2>مرحباً ${data.studentName}،</h2><p>تذكير بجلسة الإشراف مع ${data.supervisorName} غداً.</p><a href="${data.meetLink}" style="background:#0ea5e9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">🎥 رابط الجلسة</a></div>`
      : `<div style="font-family:Arial,sans-serif;"><h2>Hello ${data.studentName},</h2><p>Reminder: supervision session with ${data.supervisorName} tomorrow.</p><a href="${data.meetLink}" style="background:#0ea5e9;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">🎥 Join session</a></div>`;

  await sendEmail(data.studentEmail, subject, html);
}
