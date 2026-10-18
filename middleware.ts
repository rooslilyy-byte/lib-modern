import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Immediately bypass Telegram webhooks and cron endpoints
  if (
    pathname.startsWith('/api/telegram') ||
    pathname.startsWith('/api/cron')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session_auth')?.value;
  const isAuthenticated = sessionCookie === 'authenticated';

  // 2. Public assets and internal Next.js resources
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/logo no background.png' ||
    pathname === '/logo%20no%20background.png' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname === '/logo.png' ||
    pathname === '/logo.jpg' ||
    pathname === '/logo-lib-moderne.jpg' ||
    pathname === '/logo-lib-moderne-alt.jpg' ||
    pathname === '/logo-lib-modern.jpg' ||
    pathname === '/logo-lib-modern-alt.jpg' ||
    pathname === '/logo-izourane.jpg' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 3. Redirect authenticated user away from /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 4. Protect internal dashboard routes
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const proxy = middleware;

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/telegram (Telegram webhooks)
     * - api/cron (Daily cron reports)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/telegram|api/cron).*)',
  ],
};

export default middleware;
