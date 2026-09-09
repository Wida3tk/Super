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

    const { uid, supervisorId, action, newEmail, newPassword } = await request.json();
    if (!uid || !action) return NextResponse.json({ error: 'MISSING' }, { status: 400 });

    if (action === 'resetPassword') {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: 'PASSWORD_TOO_SHORT' }, { status: 400 });
      }
      const supervisorRef = adminDb.collection('supervisors').doc(supervisorId || uid);
      const supervisorSnap = await supervisorRef.get();
      if (!supervisorSnap.exists) {
        return NextResponse.json({ error: 'SUPERVISOR_NOT_FOUND' }, { status: 404 });
      }
      const supervisor = supervisorSnap.data() as any;
      const email = String(supervisor.email || '').trim().toLowerCase();
      if (!email) return NextResponse.json({ error: 'MISSING_EMAIL' }, { status: 400 });

      let authUser;
      for (const candidateUid of [supervisor.authUid, uid].filter(Boolean)) {
        try {
          authUser = await adminAuth.getUser(String(candidateUid));
          break;
        } catch (error: any) {
          if (error?.code !== 'auth/user-not-found') throw error;
        }
      }
      if (!authUser) {
        try {
          authUser = await adminAuth.getUserByEmail(email);
        } catch (error: any) {
          if (error?.code !== 'auth/user-not-found') throw error;
        }
      }
      if (!authUser) {
        authUser = await adminAuth.createUser({
          email,
          password: newPassword,
          displayName: String(supervisor.name || ''),
          emailVerified: false,
        });
      } else {
        await adminAuth.updateUser(authUser.uid, { password: newPassword, disabled: false });
      }
      await adminAuth.setCustomUserClaims(authUser.uid, {
        role: supervisor.accountType === 'consultant' ? 'consultant' : 'supervisor',
        supervisorId: supervisorSnap.id,
      });
      await supervisorRef.update({
        authUid: authUser.uid,
        isActive: true,
        accountStatus: 'active',
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, message: 'تم تجهيز الحساب وتغيير كلمة المرور' });
    }

    if (action === 'changeEmail') {
      if (!newEmail) return NextResponse.json({ error: 'MISSING_EMAIL' }, { status: 400 });
      await adminAuth.updateUser(uid, { email: newEmail });
      // تحديث الإيميل في Firestore أيضاً
      await adminDb.collection('supervisors').doc(supervisorId || uid).update({
        email: newEmail,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, message: 'تم تغيير البريد الإلكتروني' });
    }

    if (action === 'disable') {
      await adminAuth.updateUser(uid, { disabled: true });
      await adminDb.collection('supervisors').doc(supervisorId || uid).update({ isActive: false });
      return NextResponse.json({ success: true, message: 'تم تعطيل الحساب' });
    }

    if (action === 'enable') {
      await adminAuth.updateUser(uid, { disabled: false });
      await adminDb.collection('supervisors').doc(supervisorId || uid).update({ isActive: true });
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
