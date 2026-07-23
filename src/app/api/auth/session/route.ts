export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'NO_TOKEN' }, { status: 400 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (e: any) {
      console.error('verifyIdToken failed:', e.message);
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
    }

    let sessionCookie;
    try {
      sessionCookie = await adminAuth.createSessionCookie(token, {
        expiresIn: 60 * 60 * 24 * 5 * 1000,
      });
    } catch (e: any) {
      console.error('createSessionCookie failed:', e.message);
      return NextResponse.json({ error: 'SESSION_FAILED' }, { status: 500 });
    }

    const isAdmin = decoded.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();

    const response = NextResponse.json({ success: true, isAdmin });
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 5,
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    console.error('Session API error:', error.message);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}
