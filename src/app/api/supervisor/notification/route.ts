import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

async function getAuthenticatedSupervisor() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const email = decoded.email?.toLowerCase() || '';
    const allSnap = await adminDb.collection('supervisors').get();
    const match = allSnap.docs.find(d => (d.data().email || '').toLowerCase() === email);
    if (!match) return null;
    return { id: match.id, ...match.data() } as any;
  } catch { return null; }
}

// تحديد إشعار كمقروء
export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { notificationId } = await req.json();
  if (!notificationId) return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });

  await adminDb.collection('notifications').doc(notificationId).update({
    read: true,
    readAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
