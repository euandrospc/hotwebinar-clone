import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";

import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  // Forward the current pathname to RSC layouts via header so they can compute
  // active sidebar items / wizard steps without using usePathname (which would
  // require client components).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/atendimento/:path*"]
};
