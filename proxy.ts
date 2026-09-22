import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session_auth')?.value;
  const isAuthenticated = sessionCookie === 'authenticated';

  // Public assets and internal Next.js resources
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

  // Redirect authenticated user away from /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Protect internal dashboard routes
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const middleware = proxy;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export default proxy;
