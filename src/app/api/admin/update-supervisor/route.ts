import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { adminDb, adminAuth } = await import('@/lib/firebase/admin');

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, name, bio, specialization, photo, isActive } = await request.json();
    if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (specialization !== undefined) updateData.specialization = specialization;
    if (photo !== undefined) updateData.photo = photo;
    if (isActive !== undefined) updateData.isActive = isActive;

    await adminDb.collection('supervisors').doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
