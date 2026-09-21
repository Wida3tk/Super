import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getRequestIdentifier } from '@/lib/security/rateLimit';
import { isBookingReference, maskPersonName } from '@/lib/validation/booking';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get('ref')?.trim().toUpperCase();

  if (!ref || !isBookingReference(ref))
    return NextResponse.json({ error: 'INVALID_REF' }, { status: 400 });

  try {
    const rateLimit = await enforceRateLimit(getRequestIdentifier(request), {
      action: 'booking_lookup',
      limit: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed)
      return NextResponse.json(
        { error: 'TOO_MANY_ATTEMPTS' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );

    const { adminDb } = await import('@/lib/firebase/admin');

    const snap = await adminDb.collection('bookings')
      .where('referenceNumber', '==', ref)
      .limit(1)
      .get();

    if (snap.empty)
      return NextResponse.json(
        { booking: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );

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
        studentName: maskPersonName(data.studentName),
        supervisorName,
        date: data.date,
        time: data.time,
        status: data.status,
      }
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
