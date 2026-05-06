function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export interface TriggerConfig {
  readonly s3Endpoint: string;
  readonly s3Region: string;
  readonly s3AccessKey: string;
  readonly s3SecretKey: string;
  readonly s3BucketOriginals: string;
  readonly s3BucketHls: string;
  readonly s3PublicBaseUrl: string;
  readonly tmpRoot: string;
}

let cached: TriggerConfig | undefined;

export function getTriggerConfig(): TriggerConfig {
  if (cached) return cached;
  cached = {
    s3Endpoint: must("S3_ENDPOINT"),
    s3Region: process.env.S3_REGION ?? "us-east-1",
    s3AccessKey: process.env.S3_ACCESS_KEY ?? must("S3_ACCESS_KEY_ID"),
    s3SecretKey: process.env.S3_SECRET_KEY ?? must("S3_SECRET_ACCESS_KEY"),
    s3BucketOriginals: must("S3_BUCKET_ORIGINALS"),
    s3BucketHls: must("S3_BUCKET_HLS"),
    s3PublicBaseUrl: must("S3_PUBLIC_BASE_URL"),
    tmpRoot: process.env.WORKER_TMP_ROOT ?? "/tmp"
  };
  return cached;
}
