import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { sameOriginPath } from "@/lib/sso-redirect";

export const dynamic = "force-dynamic";

/**
 * Entry point from the Bravy hub: /sso?next=/dashboard/webinars
 * Signed in here: go straight to the target. Otherwise start the Bravy ID flow; with an active IAM
 * session it returns immediately, so the user gets in without typing credentials.
 */
export async function GET(request: Request) {
  // Behind the proxy request.url is the container's internal address, so redirect from the public URL
  const base = process.env.BETTER_AUTH_URL!;
  const callbackURL = sameOriginPath(new URL(request.url).searchParams.get("next"), base);

  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return NextResponse.redirect(new URL(callbackURL, base));

  const response = await auth.api.signInSocial({
    body: { provider: "bravy-id", callbackURL, errorCallbackURL: ADMIN_LOGIN_PATH },
    headers: request.headers,
    asResponse: true
  });
  const { url } = (await response.json()) as { url?: string };
  if (!url) return NextResponse.redirect(new URL(`${ADMIN_LOGIN_PATH}?error=please_restart_the_process`, base));

  // The OAuth state cookie must travel with the redirect or the callback fails
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.headers.getSetCookie()) redirect.headers.append("set-cookie", cookie);
  return redirect;
}
