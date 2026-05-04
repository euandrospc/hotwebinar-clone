import { chromium, type Browser, type Response } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { capturedFromResponse, type Captured } from "../lib/network.js";

export type CrawlOptions = {
  baseUrl: string;
  startRoute: string;
  sidebarSelector: string;
  maxDepth: number;
  maxPages: number;
  crawlDelayMs: number;
  bodyMaxChars: number;
  outDir: string;
  authStatePath?: string;
  headless?: boolean;
};

export type Discovered = {
  path: string;
  origin: string;
  status: number;
  requestCount: number;
};

export type CrawlResult = { discovered: Discovered[] };

function safeName(p: string): string {
  return p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
}

function normalizePath(u: string): string {
  try {
    const parsed = new URL(u);
    return parsed.pathname.replace(/\/$/, "") || "/";
  } catch {
    return u;
  }
}

function isInternal(u: string, baseUrl: string): boolean {
  try {
    const a = new URL(u);
    const b = new URL(baseUrl);
    return a.host === b.host;
  } catch {
    return false;
  }
}

export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  await fs.mkdir(opts.outDir, { recursive: true });
  const browser: Browser = await chromium.launch({ headless: opts.headless ?? true });
  const ctx = await browser.newContext(
    opts.authStatePath ? { storageState: opts.authStatePath } : {},
  );

  const queue: Array<{ pathName: string; depth: number; origin: string }> = [
    { pathName: opts.startRoute, depth: 0, origin: "start" },
  ];
  const seen = new Set<string>();
  const discovered: Discovered[] = [];

  while (queue.length > 0 && discovered.length < opts.maxPages) {
    const item = queue.shift()!;
    if (seen.has(item.pathName)) continue;
    seen.add(item.pathName);

    const page = await ctx.newPage();
    const startedAt = Date.now();
    const captured: Captured[] = [];
    const pending: Promise<void>[] = [];
    page.on("response", (resp: Response) => {
      pending.push(
        capturedFromResponse(resp, {
          startedAt,
          now: () => Date.now(),
          bodyMaxChars: opts.bodyMaxChars,
        })
          .then((c) => {
            captured.push(c);
          })
          .catch(() => undefined),
      );
    });

    const url = new URL(item.pathName, opts.baseUrl).toString();
    let status = 0;
    let navError: string | null = null;
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      status = resp?.status() ?? 0;
    } catch (e) {
      navError = (e as Error).message;
    }

    const slug = safeName(item.pathName);
    const dir = path.join(opts.outDir, "crawl", slug);
    await fs.mkdir(dir, { recursive: true });
    const html = await page.content();
    await fs.writeFile(path.join(dir, "page.html"), html);
    await page
      .screenshot({ path: path.join(dir, "screenshot.png"), fullPage: true })
      .catch(() => undefined);

    await Promise.all(pending);
    await fs.writeFile(path.join(dir, "requests.json"), JSON.stringify(captured, null, 2));
    await fs.writeFile(
      path.join(dir, "meta.json"),
      JSON.stringify(
        {
          route: item.pathName,
          url,
          status,
          ok: navError === null && status >= 200 && status < 400,
          error: navError,
          requestCount: captured.length,
          depth: item.depth,
          origin: item.origin,
          capturedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    discovered.push({
      path: item.pathName,
      origin: item.origin,
      status,
      requestCount: captured.length,
    });

    if (item.depth < opts.maxDepth) {
      const hrefs = await page.$$eval(opts.sidebarSelector, (els) =>
        els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean),
      );
      for (const href of hrefs) {
        if (!isInternal(href, opts.baseUrl)) continue;
        const np = normalizePath(href);
        if (!seen.has(np)) {
          queue.push({ pathName: np, depth: item.depth + 1, origin: item.pathName });
        }
      }
    }

    await page.close();
    if (opts.crawlDelayMs > 0) await new Promise((r) => setTimeout(r, opts.crawlDelayMs));
  }

  await ctx.close();
  await browser.close();

  await fs.writeFile(
    path.join(opts.outDir, "crawl", "_discovered.json"),
    JSON.stringify(discovered, null, 2),
  );
  return { discovered };
}

async function main() {
  // Lazy-load config so importing this module from tests doesn't trigger env validation.
  const { config, currentRunId } = await import("../config.js");

  const runId = currentRunId();
  const outDir = path.join(config.captureDir, runId);
  await fs.mkdir(outDir, { recursive: true });
  console.log("Run:", outDir);

  await crawl({
    baseUrl: config.baseUrl,
    startRoute: config.startRoute,
    sidebarSelector: config.sidebarSelector,
    maxDepth: config.maxDepth,
    maxPages: config.maxPages,
    crawlDelayMs: config.crawlDelayMs,
    bodyMaxChars: config.bodyMaxChars,
    outDir,
    authStatePath: config.authStatePath,
    headless: !process.argv.includes("--headed"),
  });

  const latest = path.join(config.captureDir, "latest");
  await fs.rm(latest, { recursive: true, force: true });
  await fs.cp(outDir, latest, { recursive: true });

  console.log("Done.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
