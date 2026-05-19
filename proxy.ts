import { NextRequest, NextResponse } from 'next/server';

export default async function proxy(req: NextRequest) {
  return NextResponse.next();
}

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - backend (frontend rewrite proxy to the backend API)
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!backend|api/external/workflows|_next/static|_next/image|favicon.ico|sitemap.xml|.*\\.svg|.*\\.png|robots.txt).*)',
  ],
};
