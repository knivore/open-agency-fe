import { NextRequest, NextResponse } from 'next/server';

// `/setup` must remain reachable without a session: it is where a fresh install
// creates its first local administrator, so there cannot be credentials yet.
// The setup status and bootstrap endpoints share that constraint when the local
// backend is exposed through the same-origin `/backend` rewrite.
const publicRoutes = ['/', '/setup', '/backend/setup/status', '/backend/auth/bootstrap'];
const authRoutes = ['/login', '/auth/signin'];
const publicApiRoutes = ['/api/external/workflows'];

function getSafeCallbackPath(rawValue: string | null) {
  if (!rawValue) {
    return '/workflows';
  }

  // Backslashes are URL authority separators in WHATWG parsing, so accepting
  // them here would turn an apparently relative callback into a foreign origin.
  if (rawValue.startsWith('/') && !rawValue.startsWith('//') && !rawValue.includes('\\')) {
    return rawValue;
  }

  try {
    const url = new URL(rawValue);
    return `${url.pathname}${url.search}` || '/workflows';
  } catch {
    return '/workflows';
  }
}

export default async function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const appOrigin = nextUrl.origin;

  const isPublicApiRoute = publicApiRoutes.some((route) => nextUrl.pathname.startsWith(route));

  if (isPublicApiRoute) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  // Initial setup is deliberately independent from Auth.js. A fresh install
  // cannot have a session until this route creates its first administrator.
  if (isPublicRoute) {
    return NextResponse.next();
  }

  const res = await fetch(`${appOrigin}/api/auth/session`, {
    headers: {
      cookie: req.headers.get('cookie') || '',
    },
  });

  if (!res.ok) {
    console.log(`Failed to fetch session: ${res.status} ${res.statusText}`);
    return new NextResponse('Internal Server Error', { status: 500 });
  }

  const session = await res.json();
  const isLoggedIn = Boolean(session?.user);

  const isApiRoute = nextUrl.pathname.startsWith('/api');
  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth');
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);

  // console.log(`ROUTE {${nextUrl}}:`, req.nextUrl.pathname)
  // console.log("isLoggedIn:", isLoggedIn);
  // console.log("isApiAuthRoute:", isApiAuthRoute);
  // console.log("isAuthRoute:", isAuthRoute);
  // console.log("isPublicRoute:", isPublicRoute);

  if (isApiRoute) {
    if (isLoggedIn || isApiAuthRoute) {
      return NextResponse.next();
    }
    return new NextResponse('Unauthorized', { status: 401 });
  } else if (isAuthRoute) {
    const callbackPath = getSafeCallbackPath(nextUrl.searchParams.get('callbackUrl'));
    // This URL can survive in a browser tab from an older proxy build that
    // treated first-run setup as protected. Recover it without blocking setup.
    if (nextUrl.searchParams.get('status') === 'unauthorized' && callbackPath === '/setup') {
      return NextResponse.redirect(new URL('/setup', nextUrl));
    }
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(callbackPath, nextUrl));
    }
    return NextResponse.next();
  } else {
    // Every non-API, non-auth route reaching this branch is protected.
    if (isLoggedIn) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`);
    loginUrl.searchParams.set('status', 'unauthorized');
    console.log('loginUrl:', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
}

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - setup (first-run setup must never enter the auth proxy)
     * - api (API routes, except /api/auth/check-session)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     *
     * If the local-only /backend rewrite is enabled, it remains protected here,
     * except for the narrowly scoped first-run routes listed above.
     */
    '/((?!setup(?:/|$)|api/auth/session|api/external/workflows|_next/static|_next/image|favicon.ico|sitemap.xml|.*\\.svg|.*\\.png|robots.txt).*)',
  ],
};
