import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // استثناء API Routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // استثناء الملفات الثابتة
  if (pathname.includes('.')) {
    return NextResponse.next();
  }

  // التحقق من الـ session للصفحات المحمية
  const sessionCookie = request.cookies.get('__session')?.value;
  const protectedRoutes = ['/supervisor-dashboard', '/admin'];
  const isProtected = protectedRoutes.some(r => pathname.includes(r));

  if (isProtected && !sessionCookie) {
    const locale = pathname.startsWith('/ar') ? 'ar' : 'en';
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
