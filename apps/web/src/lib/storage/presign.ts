import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "./s3.js";

export async function presignPut(
  bucket: string,
  key: string,
  contentType: string,
  expiresInSec: number
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });
  return getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSec });
}

export async function presignGet(
  bucket: string,
  key: string,
  expiresInSec: number
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getS3Client(), cmd, { expiresIn: expiresInSec });
}

export async function headObject(bucket: string, key: string): Promise<{ exists: boolean; size?: number }> {
  try {
    const out = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { exists: true, size: typeof out.ContentLength === "number" ? out.ContentLength : undefined };
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "NotFound") {
      return { exists: false };
    }
    if (err && typeof err === "object" && "$metadata" in err) {
      const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata;
      if (meta?.httpStatusCode === 404) return { exists: false };
    }
    throw err;
  }
}
