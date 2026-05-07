import { S3Client, ListObjectsV2Command, DeleteObjectCommand, type _Object } from "@aws-sdk/client-s3";

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
      accessKeyId: process.env.S3_ACCESS_KEY ?? must("S3_ACCESS_KEY_ID"),
      secretAccessKey: process.env.S3_SECRET_KEY ?? must("S3_SECRET_ACCESS_KEY")
    },
    forcePathStyle: true
  });
  return cached;
}

export async function deletePrefix(bucket: string, prefix: string): Promise<number> {
  const s3 = getS3Client();
  let deleted = 0;
  let token: string | undefined;
  while (true) {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    const objects: _Object[] = out.Contents ?? [];
    for (const obj of objects) {
      if (!obj.Key) continue;
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      deleted += 1;
    }
    if (!out.IsTruncated) break;
    token = out.NextContinuationToken;
  }
  return deleted;
}
