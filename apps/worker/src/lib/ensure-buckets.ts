import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand
} from "@aws-sdk/client-s3";
import { getS3 } from "./s3.js";
import { config } from "../env.js";

const PUBLIC_READ_POLICY = (bucket: string) =>
  JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`]
      }
    ]
  });

async function ensureBucket(name: string, publicRead: boolean): Promise<void> {
  const s3 = getS3();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: name }));
  } catch (err) {
    const code = (err as { name?: string }).name;
    if (code === "NotFound" || code === "NoSuchBucket") {
      await s3.send(new CreateBucketCommand({ Bucket: name }));
      console.log(`[worker] created bucket: ${name}`);
    } else {
      throw err;
    }
  }
  if (publicRead) {
    await s3.send(new PutBucketPolicyCommand({ Bucket: name, Policy: PUBLIC_READ_POLICY(name) }));
  }
}

export async function ensureBuckets(): Promise<void> {
  await ensureBucket(config.s3BucketOriginals, false);
  await ensureBucket(config.s3BucketHls, true);
}
