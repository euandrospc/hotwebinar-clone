import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.resolve(root, ".env") });

function must(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${key} is not a number: ${raw}`);
  return n;
}

export const config = {
  baseUrl: must("TARGET_BASE_URL"),
  email: must("TARGET_LOGIN_EMAIL"),
  password: must("TARGET_LOGIN_PASSWORD"),

  loginPath: process.env.TARGET_LOGIN_PATH ?? "/login",
  sidebarSelector: process.env.SIDEBAR_SELECTOR ?? "aside a, nav a",
  startRoute: process.env.CRAWL_START_ROUTE ?? "/dashboard",

  maxPages: num("MAX_PAGES", 200),
  maxDepth: num("MAX_DEPTH", 3),
  crawlDelayMs: num("CRAWL_DELAY_MS", 500),
  bodyMaxChars: num("BODY_MAX_CHARS", 200_000),

  recordedDir: path.resolve(root, "recorded"),
  captureDir: path.resolve(root, "capture"),
  routesFile: path.resolve(root, "routes.txt"),
  authStatePath: path.resolve(root, "recorded", "auth-state.json"),
  flowSpecPath: path.resolve(root, "recorded", "flow.spec.ts"),
};

export function newRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

let cachedRunId: string | null = null;
export function currentRunId(): string {
  if (cachedRunId) return cachedRunId;
  cachedRunId = process.env.RUN_ID ?? newRunId();
  return cachedRunId;
}

export type Config = typeof config;
