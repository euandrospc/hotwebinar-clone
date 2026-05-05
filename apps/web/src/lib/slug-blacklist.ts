export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "login",
  "dashboard",
  "api",
  "_next",
  "admin",
  "signup",
  "register",
  "static",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml"
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
