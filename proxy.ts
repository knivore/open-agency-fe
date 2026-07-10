import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/']; // ! These are routes that are not protected
const authRoutes = ['/login', '/auth/signin'];
const publicApiRoutes = ['/api/external/workflows'];

function getSafeCallbackPath(rawValue: string | null) {
  if (!rawValue) {
    return '/workflows';
  }

  if (rawValue.startsWith('/') && !rawValue.startsWith('//')) {
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

  const isPublicApiRoute = publicApiRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  if (isPublicApiRoute) {
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
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);

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
    if (isLoggedIn) {
      const callbackPath = getSafeCallbackPath(nextUrl.searchParams.get('callbackUrl'));
      return NextResponse.redirect(new URL(callbackPath, nextUrl));
    }
    return NextResponse.next();
  } else if (!isPublicRoute) {
    // !isPublicRoute means that the route is protected
    if (isLoggedIn) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`);
    loginUrl.searchParams.set('status', 'unauthorized');
    console.log('loginUrl:', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  } else {
    return NextResponse.next();
  }
}

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes, except /api/auth/check-session)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     *
     * If the local-only /backend rewrite is enabled, it is intentionally matched
     * here so it still requires an authenticated frontend session.
     */
    '/((?!api/auth/session|api/external/workflows|_next/static|_next/image|favicon.ico|sitemap.xml|.*\\.svg|.*\\.png|robots.txt).*)',
  ],
};
