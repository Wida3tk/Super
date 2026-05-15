import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return false;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, message, targetType, targetId } = await req.json();
  if (!type || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  // لو للجميع، أضف إشعار لكل مشرف
  if (targetType === 'all') {
    const supervisorsSnap = await adminDb.collection('supervisors').get();
    const batch = adminDb.batch();
    supervisorsSnap.docs.forEach(doc => {
      const ref = adminDb.collection('notifications').doc();
      batch.set(ref, {
        type, message,
        targetType: 'all',
        supervisorId: doc.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    await batch.commit();
    const ref = await adminDb.collection('notifications').add({
      type, message, targetType: 'all', supervisorId: null, read: false,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: ref.id });
  }

  // لمشرف محدد
  const ref = await adminDb.collection('notifications').add({
    type, message, targetType: 'supervisor',
    supervisorId: targetId,
    read: false,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: ref.id });
}
