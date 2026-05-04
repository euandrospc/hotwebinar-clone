import { NextResponse, type NextRequest } from "next/server";

// TODO(better-auth-upgrade): replace with getSessionCookie when bumping past 1.0.7
// NOTE: better-auth 1.0.7 (pinned in apps/web/package.json) does not yet export
// `getSessionCookie` from `better-auth/cookies` — that helper landed in a later
// minor. We replicate its (presence-only) behavior here: check whether the
// Better Auth session cookie is set, with the same name conventions
// (`better-auth.session_token`, optionally `__Secure-` prefixed on HTTPS).
// Real validation still happens server-side via `auth.api.getSession` in
// `AdminShell` — this is just an Edge-runtime optimistic gate.
function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token")
  );
}

export function middleware(request: NextRequest) {
  if (!hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"]
};
