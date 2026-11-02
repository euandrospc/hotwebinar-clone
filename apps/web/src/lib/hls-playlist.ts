/**
 * Point segment lines straight at the CDN so players fetch .ts from R2 without a
 * request (and 302) to this server every few seconds. Key and variant playlist
 * URIs are untouched, so the AES key stays behind the lead check.
 */
export function withCdnSegments(playlist: string, key: string): string {
  const base = process.env.HLS_SEGMENT_BASE_URL?.replace(/\/$/, "");
  if (!base) return playlist;
  const dir = key.slice(0, key.lastIndexOf("/") + 1);
  return playlist
    .split("\n")
    .map((line) => {
      const t = line.trim();
      return t && !t.startsWith("#") && t.endsWith(".ts") && !/^https?:\/\//.test(t) ? `${base}/${dir}${t}` : line;
    })
    .join("\n");
}
