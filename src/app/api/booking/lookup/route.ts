import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get('ref')?.trim().toUpperCase();

  if (!ref) return NextResponse.json({ error: 'MISSING_REF' }, { status: 400 });

  try {
    const { adminDb } = await import('@/lib/firebase/admin');

    const snap = await adminDb.collection('bookings')
      .where('referenceNumber', '==', ref)
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json({ booking: null });

    const doc = snap.docs[0];
    const data = doc.data();

    // جلب اسم المشرف
    let supervisorName = '';
    try {
      const supSnap = await adminDb.collection('supervisors').doc(data.supervisorId).get();
      supervisorName = supSnap.data()?.name || '';
    } catch {}

    // إرجاع البيانات بدون managementToken الكامل — فقط لو الحجز مؤكد
    return NextResponse.json({
      booking: {
        referenceNumber: data.referenceNumber,
        studentName: data.studentName,
        supervisorName,
        date: data.date,
        time: data.time,
        status: data.status,
        // نعطي الـ token فقط للإدارة
        managementToken: data.status === 'confirmed' ? data.managementToken : null,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
