import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";

export function isPublicAddress(value: string) {
  try {
    let address = ipaddr.parse(value);
    if (address.kind() === "ipv6" && (address as ipaddr.IPv6).isIPv4MappedAddress()) address = (address as ipaddr.IPv6).toIPv4Address();
    return address.range() === "unicast";
  } catch { return false; }
}
export function previewUrl(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("unsafe_url");
  return url;
}
async function download(url: URL) {
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error("unsafe_address");
  const pinned = addresses[0];
  return new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = transport(url, {
      family: pinned.family,
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { "user-agent": "BravyLinkPreview/1.0", accept: "text/html" }
    }, response => {
      const location = response.headers.location;
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        response.resume(); resolve({ status: response.statusCode, location, html: "" }); return;
      }
      if (!response.headers["content-type"]?.toLowerCase().includes("text/html")) {
        response.resume(); reject(new Error("not_html")); return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        const remaining = 512_000 - bytes;
        chunks.push(chunk.subarray(0, remaining));
        bytes += Math.min(chunk.length, remaining);
        const prefix = Buffer.concat(chunks).toString("utf8");
        // Metadata lives in the head. Stop before downloading the page body.
        if (/<\/head\s*>/i.test(prefix) || bytes >= 512_000) {
          resolve({ status: response.statusCode ?? 500, html: prefix });
          response.destroy();
          req.destroy();
        }
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status: response.statusCode ?? 500, html: Buffer.concat(chunks).toString("utf8") }));
    });
    const timer = setTimeout(() => req.destroy(new Error("timeout")), 5000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}
export type LinkPreview = { url: string; hostname: string; title: string; description: string; image: string | null };
const cache = new Map<string, { until: number; value: LinkPreview }>();
const pending = new Map<string, Promise<LinkPreview>>();
async function readPreview(value: string): Promise<LinkPreview> {
  const original = previewUrl(value);
  let current = original;
  let html = "";
  for (let i = 0; i < 4; i++) {
    const result = await download(current);
    if (result.status >= 300 && result.status < 400 && result.location) {
      current = previewUrl(new URL(result.location, current).href);
      continue;
    }
    if (result.status < 200 || result.status >= 300) throw new Error("unavailable");
    html = result.html; break;
  }
  if (!html) throw new Error("redirect_limit");
  const $ = load(html);
  const title = $('meta[property="og:title"]').attr("content") || $("title").first().text() || current.hostname;
  const description = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
  // External images must be public too. The viewer's cookies/referrer are never forwarded.
  let image: string | null = null;
  const raw = $('meta[property="og:image"]').attr("content");
  if (raw) {
    try {
      const candidate = previewUrl(new URL(raw, current).href);
      const addresses = await lookup(candidate.hostname, { all: true });
      if (addresses.length && addresses.every(item => isPublicAddress(item.address))) image = candidate.href;
    } catch { /* The text card still works without an image. */ }
  }
  return { url: original.href, hostname: current.hostname, title: title.trim().slice(0, 160), description: description.trim().slice(0, 240), image };
}
export async function getLinkPreview(value: string) {
  const url = previewUrl(value).href;
  const prior = cache.get(url);
  if (prior && prior.until > Date.now()) return prior.value;
  if (pending.has(url)) return pending.get(url)!;
  if (pending.size >= 20) throw new Error("busy");
  const promise = readPreview(url).then(result => {
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(url, { until: Date.now() + 15 * 60_000, value: result });
    return result;
  }).finally(() => pending.delete(url));
  pending.set(url, promise);
  return promise;
}
