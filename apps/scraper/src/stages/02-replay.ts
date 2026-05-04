import { chromium, type Response } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config, newRunId } from "../config.js";
import { capturedFromResponse, type Captured } from "../lib/network.js";

function safeName(p: string): string {
  return p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
}

function pathFromUrl(u: string): string {
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
}

async function captureRoute(targetUrl: string, runDir: string): Promise<void> {
  const slug = safeName(pathFromUrl(targetUrl));
  const dir = path.join(runDir, "replay", slug);
  await fs.mkdir(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: config.authStatePath,
    recordHar: { path: path.join(dir, "network.har"), content: "embed" },
  });
  const page = await ctx.newPage();

  const startedAt = Date.now();
  const captured: Captured[] = [];
  const pending: Promise<void>[] = [];
  page.on("response", (resp: Response) => {
    pending.push(
      capturedFromResponse(resp, {
        startedAt,
        now: () => Date.now(),
        bodyMaxChars: config.bodyMaxChars,
      })
        .then((c) => {
          captured.push(c);
        })
        .catch(() => undefined),
    );
  });

  console.log(" ->", targetUrl);
  let status = 0;
  let navError: string | null = null;
  try {
    const resp = await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
    status = resp?.status() ?? 0;
  } catch (e) {
    navError = (e as Error).message;
    console.warn("   nav error:", navError);
  }

  const html = await page.content();
  await fs.writeFile(path.join(dir, "page.html"), html);
  await page.screenshot({ path: path.join(dir, "screenshot.png"), fullPage: true });
  await Promise.all(pending);
  await fs.writeFile(path.join(dir, "requests.json"), JSON.stringify(captured, null, 2));
  await fs.writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify(
      {
        route: pathFromUrl(targetUrl),
        url: targetUrl,
        status,
        ok: navError === null && status >= 200 && status < 400,
        error: navError,
        requestCount: captured.length,
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  await ctx.close();
  await browser.close();
}

async function loadVisitedUrls(): Promise<string[]> {
  try {
    // Dynamic import so missing file fails at runtime with a clear message instead of breaking typecheck.
    // pathToFileURL avoids ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows for absolute paths.
    const mod = (await import(pathToFileURL(config.flowSpecPath).href)) as { visitedUrls?: string[] };
    return mod.visitedUrls ?? [];
  } catch (e) {
    throw new Error(
      `Could not load ${config.flowSpecPath}. Run \`pnpm scrape:record\` first to produce it. (${(e as Error).message})`,
    );
  }
}

async function main() {
  const visitedUrls = await loadVisitedUrls();
  if (visitedUrls.length === 0) {
    console.error("recorded/flow.spec.ts has no visitedUrls. Re-run scrape:record.");
    process.exit(1);
  }

  const runId = newRunId();
  const runDir = path.join(config.captureDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  console.log("Run:", runDir);

  for (const url of visitedUrls) {
    await captureRoute(url, runDir);
  }

  const latest = path.join(config.captureDir, "latest");
  await fs.rm(latest, { recursive: true, force: true });
  await fs.cp(runDir, latest, { recursive: true });

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
