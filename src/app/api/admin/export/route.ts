import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/serverAuth';

export async function GET() {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    if (!(await requireAdmin()))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
