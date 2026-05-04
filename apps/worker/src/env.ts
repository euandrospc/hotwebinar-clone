import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.resolve(repoRoot, ".env.local") });
dotenv.config({ path: path.resolve(repoRoot, ".env") });

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} is not a number: ${raw}`);
  return n;
}

export const config = {
  databaseUrl: must("DATABASE_URL"),
  redisUrl: must("REDIS_URL"),
  s3Endpoint: must("S3_ENDPOINT"),
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3AccessKey: must("S3_ACCESS_KEY"),
  s3SecretKey: must("S3_SECRET_KEY"),
  s3BucketOriginals: must("S3_BUCKET_ORIGINALS"),
  s3BucketHls: must("S3_BUCKET_HLS"),
  s3PublicBaseUrl: must("S3_PUBLIC_BASE_URL"),
  workerConcurrency: num("WORKER_CONCURRENCY", 1),
  tmpRoot: process.env.WORKER_TMP_ROOT ?? "/tmp"
};
