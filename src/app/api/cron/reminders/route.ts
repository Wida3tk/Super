import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const { sendReminderEmail } = await import('@/lib/email/emailService');

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const snap = await adminDb.collection('bookings')
      .where('date', '==', tomorrowDate)
      .where('status', '==', 'confirmed')
      .where('reminderSent', '==', false)
      .get();

    let sent = 0;
    for (const doc of snap.docs) {
      const b = doc.data();
      try {
        const supSnap = await adminDb.collection('supervisors').doc(b.supervisorId).get();
        const supervisorName = supSnap.data()?.name || 'المشرف';

        await sendReminderEmail({
          studentName: b.studentName,
          studentEmail: b.studentEmail,
          supervisorName,
          date: b.date,
          time: b.time,
          meetLink: b.meetLink || '',
          managementToken: b.managementToken,
          locale: 'ar',
        });

        await doc.ref.update({ reminderSent: true });
        sent++;
      } catch (e) {
        console.error('Reminder error:', doc.id, e);
      }
    }

    return NextResponse.json({ success: true, remindersSent: sent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
