import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  type _Object
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import fs from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { getTriggerConfig } from "./env";

let cached: S3Client | undefined;

export function getS3(): S3Client {
  if (cached) return cached;
  const cfg = getTriggerConfig();
  cached = new S3Client({
    endpoint: cfg.s3Endpoint,
    region: cfg.s3Region,
    credentials: { accessKeyId: cfg.s3AccessKey, secretAccessKey: cfg.s3SecretKey },
    forcePathStyle: true
  });
  return cached;
}

export async function downloadObjectToFile(bucket: string, key: string, destPath: string): Promise<void> {
  const out = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!(out.Body instanceof Readable)) throw new Error(`S3 GetObject Body is not a readable stream for ${key}`);
  await fs.mkdir(destPath.replace(/[/\\][^/\\]*$/, ""), { recursive: true });
  await pipeline(out.Body, createWriteStream(destPath));
}

export async function uploadFileToObject(
  bucket: string,
  key: string,
  filePath: string,
  contentType: string
): Promise<void> {
  const body = createReadStream(filePath);
  const stat = await fs.stat(filePath);
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: stat.size
    })
  );
}

export async function deletePrefix(bucket: string, prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  while (true) {
    const out = await getS3().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
    );
    const objects: _Object[] = out.Contents ?? [];
    for (const obj of objects) {
      if (!obj.Key) continue;
      await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      deleted += 1;
    }
    if (!out.IsTruncated) break;
    token = out.NextContinuationToken;
  }
  return deleted;
}
