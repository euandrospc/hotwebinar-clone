import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { infer, mergeSchemas, type Schema } from "../lib/schema-infer.js";
import { buildReport, type Analysis, type EndpointAnalysis, type PageAnalysis } from "../lib/report.js";
import type { Captured } from "../lib/network.js";

export type AnalyzeOptions = { runDir: string; runId: string };

const ID_RE = /^[0-9]+$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9]{16,}$/i;

export function normalizePath(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const segs = u.pathname.split("/").map((s) => (ID_RE.test(s) ? ":id" : s));
    return segs.join("/").replace(/\/$/, "") || "/";
  } catch {
    return rawUrl;
  }
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function listSubdirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);
  } catch {
    return [];
  }
}

async function findArtifactFiles(runDir: string, name: "requests.json" | "meta.json"): Promise<string[]> {
  const out: string[] = [];
  for (const sub of ["replay", "crawl"]) {
    const base = path.join(runDir, sub);
    for (const slug of await listSubdirs(base)) {
      const f = path.join(base, slug, name);
      if (await fs.stat(f).then(() => true).catch(() => false)) out.push(f);
    }
  }
  return out;
}

const SKIP = new Set([":id", "api", "v1", "v2", "v3", "v4", "internal", "public", "private"]);

export function singularize(word: string): string {
  const lower = word.toLowerCase();
  // Irregulars / already-singular: leave alone
  if (["news", "media", "data", "people", "children"].includes(lower)) return word;
  // -ies → -y (categories → category, properties → property)
  if (/[a-z]ies$/i.test(word) && word.length > 3) return word.slice(0, -3) + "y";
  // -ses, -xes, -zes, -ches, -shes → strip -es (statuses → status, boxes → box, classes → class)
  if (/(?:s|x|z|ch|sh)es$/i.test(word)) return word.slice(0, -2);
  // plain -s (but not -ss): strip
  if (/[^s]s$/i.test(word)) return word.slice(0, -1);
  return word;
}

export function guessEntityName(pathPattern: string): string | null {
  const parts = pathPattern.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (SKIP.has(p)) continue;
    const word = p.replace(/[^a-z0-9]/gi, "");
    if (word.length === 0) continue;
    const singular = singularize(word);
    return singular.charAt(0).toUpperCase() + singular.slice(1);
  }
  return null;
}

export async function analyze(opts: AnalyzeOptions): Promise<Analysis> {
  const reqFiles = await findArtifactFiles(opts.runDir, "requests.json");

  type Group = {
    method: string;
    pathPattern: string;
    statusCodes: Set<number>;
    reqBodies: unknown[];
    resBodies: unknown[];
    truncatedResCount: number;
  };
  const groups = new Map<string, Group>();

  for (const f of reqFiles) {
    const items = (await readJson<Captured[]>(f)) ?? [];
    for (const c of items) {
      const ct = (c.responseHeaders["content-type"] ?? "").toLowerCase();
      if (!/(?:^|[\s;])application\/(?:[a-z.+-]+\+)?json\b/.test(ct) && !ct.includes("text/json")) continue;
      const pathPattern = normalizePath(c.url);
      const key = `${c.method} ${pathPattern}`;
      let g = groups.get(key);
      if (!g) {
        g = { method: c.method, pathPattern, statusCodes: new Set(), reqBodies: [], resBodies: [], truncatedResCount: 0 };
        groups.set(key, g);
      }
      g.statusCodes.add(c.status);
      if (c.requestBody) {
        try { g.reqBodies.push(JSON.parse(c.requestBody)); } catch { /* ignore non-JSON */ }
      }
      if (c.responseBody) {
        if (c.truncated) {
          g.truncatedResCount += 1;
        } else {
          try { g.resBodies.push(JSON.parse(c.responseBody)); } catch { /* ignore non-JSON */ }
        }
      }
    }
  }

  const endpoints: EndpointAnalysis[] = [];
  const entities: Record<string, Schema> = {};

  for (const g of groups.values()) {
    const responseSchema = infer(g.resBodies);
    const requestBodySchema = infer(g.reqBodies);
    endpoints.push({
      method: g.method,
      pathPattern: g.pathPattern,
      samples: g.resBodies.length || g.reqBodies.length,
      truncatedSamples: g.truncatedResCount > 0 ? g.truncatedResCount : undefined,
      statusCodes: [...g.statusCodes].sort((a, b) => a - b),
      requestBodySchema,
      responseSchema,
    });
    const name = guessEntityName(g.pathPattern);
    if (name && responseSchema.kind === "object") {
      entities[name] = entities[name] ? mergeSchemas(entities[name], responseSchema) : responseSchema;
    }
  }

  endpoints.sort((a, b) => a.pathPattern.localeCompare(b.pathPattern) || a.method.localeCompare(b.method));

  const pages: PageAnalysis[] = [];
  for (const f of await findArtifactFiles(opts.runDir, "meta.json")) {
    const meta = await readJson<{ route: string; url: string; status: number; requestCount: number }>(f);
    if (!meta) continue;
    pages.push({
      route: meta.route,
      url: meta.url,
      status: meta.status,
      requestCount: meta.requestCount,
      screenshot: path.relative(opts.runDir, path.join(path.dirname(f), "screenshot.png")).replace(/\\/g, "/"),
    });
  }

  const analysis: Analysis = { runId: opts.runId, endpoints, entities, pages };

  const outDir = path.join(opts.runDir, "analysis");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "endpoints.json"), JSON.stringify(endpoints, null, 2));
  await fs.writeFile(path.join(outDir, "entities.json"), JSON.stringify(entities, null, 2));
  await fs.writeFile(path.join(outDir, "pages.json"), JSON.stringify(pages, null, 2));
  await fs.writeFile(path.join(outDir, "REPORT.md"), buildReport(analysis));

  return analysis;
}

async function main() {
  const { config, newRunId } = await import("../config.js");
  const latest = path.join(config.captureDir, "latest");
  const runDir = (await fs.stat(latest).then(() => true).catch(() => false))
    ? latest
    : path.join(config.captureDir, newRunId());
  const runId = path.basename(runDir);
  console.log("Analyzing:", runDir);
  const a = await analyze({ runDir, runId });
  console.log(`Endpoints: ${a.endpoints.length}, Entities: ${Object.keys(a.entities).length}, Pages: ${a.pages.length}`);
  console.log("REPORT →", path.join(runDir, "analysis", "REPORT.md"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
