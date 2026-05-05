import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { uid, action, newEmail, newPassword } = await request.json();
    if (!uid || !action) return NextResponse.json({ error: 'MISSING' }, { status: 400 });

    if (action === 'resetPassword') {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: 'PASSWORD_TOO_SHORT' }, { status: 400 });
      }
      await adminAuth.updateUser(uid, { password: newPassword });
      return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور' });
    }

    if (action === 'changeEmail') {
      if (!newEmail) return NextResponse.json({ error: 'MISSING_EMAIL' }, { status: 400 });
      await adminAuth.updateUser(uid, { email: newEmail });
      // تحديث الإيميل في Firestore أيضاً
      await adminDb.collection('supervisors').doc(uid).update({
        email: newEmail,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, message: 'تم تغيير البريد الإلكتروني' });
    }

    if (action === 'disable') {
      await adminAuth.updateUser(uid, { disabled: true });
      await adminDb.collection('supervisors').doc(uid).update({ isActive: false });
      return NextResponse.json({ success: true, message: 'تم تعطيل الحساب' });
    }

    if (action === 'enable') {
      await adminAuth.updateUser(uid, { disabled: false });
      await adminDb.collection('supervisors').doc(uid).update({ isActive: true });
      return NextResponse.json({ success: true, message: 'تم تفعيل الحساب' });
    }

    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
  } catch (error: any) {
    const errMap: Record<string, string> = {
      'auth/email-already-exists': 'البريد الإلكتروني مستخدم مسبقاً',
      'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
    };
    return NextResponse.json({ error: errMap[error.code] || error.message }, { status: 500 });
  }
}
