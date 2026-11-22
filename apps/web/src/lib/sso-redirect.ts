/**
 * Turns a user-supplied `next` into a path on `baseURL`, or the fallback.
 * Resolving with URL (instead of checking the string) catches "/\t/evil.com", which URL turns into "//evil.com".
 */
export function sameOriginPath(next: string | null, baseURL: string, fallback = "/dashboard"): string {
  const base = new URL(baseURL);
  try {
    const target = new URL(next || fallback, base);
    return target.origin === base.origin ? target.pathname + target.search + target.hash : fallback;
  } catch {
    return fallback;
  }
}
