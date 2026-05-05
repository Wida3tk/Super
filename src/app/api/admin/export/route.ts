import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { adminDb, adminAuth } = await import('@/lib/firebase/admin');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snap = await adminDb.collection('bookings').get();
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const headers = ['ID', 'Student Name', 'Email', 'Phone', 'Date', 'Time', 'Status'];
    const rows = bookings.map((b: any) => [
      b.id, b.studentName, b.studentEmail, b.studentPhone, b.date, b.time, b.status
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map((cell: any) => `"${cell || ''}"`).join(','))
      .join('\n');

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8;',
        'Content-Disposition': 'attachment; filename=bookings.csv',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
