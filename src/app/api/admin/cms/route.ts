import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const snap = await adminDb.collection('settings').doc('cms').get();
    const defaults = {
      siteName: 'سلوكيرا',
      siteNameEn: 'Sulukera',
      heroTitle: 'احجز جلستك مع مشرفك الأكاديمي في دقيقتين',
      heroSubtitle: 'سلوكيرا منصة متخصصة في تطبيق علم تحليل السلوك التطبيقي (ABA)، نربطك بأفضل المشرفين الأكاديميين المعتمدين لدعم مسيرتك المهنية.',
      heroTagline: 'منصة الإشراف الأكاديمي',
      stat1Value: '+3', stat1Label: 'مشرف متخصص',
      stat2Value: '١٠٠٪', stat2Label: 'جلسات أونلاين',
      stat3Value: '٢ دق', stat3Label: 'وقت الحجز',
      primaryColor: '#0D40FC',
      deepColor: '#001442',
      neonColor: '#55D7FF',
      footerText: 'منصة الإشراف الأكاديمي',
      sessionDuration: '30',
    };
    return NextResponse.json({ settings: snap.exists ? { ...defaults, ...snap.data() } : defaults });
  } catch {
    return NextResponse.json({ settings: {} });
  }
}

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

    const data = await request.json();
    await adminDb.collection('settings').doc('cms').set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
