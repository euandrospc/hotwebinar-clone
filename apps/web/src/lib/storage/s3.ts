import { S3Client } from "@aws-sdk/client-s3";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

let cached: S3Client | undefined;

export function getS3Client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    endpoint: must("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: must("S3_ACCESS_KEY"),
      secretAccessKey: must("S3_SECRET_KEY")
    },
    forcePathStyle: true
  });
  return cached;
}
