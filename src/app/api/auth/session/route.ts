import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    await adminAuth.verifyIdToken(token);
    
    const sessionCookie = await adminAuth.createSessionCookie(token, {
      expiresIn: 60 * 60 * 24 * 5 * 1000,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 5,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
