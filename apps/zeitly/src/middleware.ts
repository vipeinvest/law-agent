import { NextResponse, type NextRequest } from 'next/server';

/** Exposes the pathname to server components (used for nav switching) and blocks nothing else. */
export function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: new Headers({ ...Object.fromEntries(req.headers), 'x-pathname': req.nextUrl.pathname }) } });
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|icons|sw.js|manifest.webmanifest|favicon.ico).*)'] };
