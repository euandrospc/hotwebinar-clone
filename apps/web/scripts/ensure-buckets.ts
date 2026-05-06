import { S3Client, CreateBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const s3 = new S3Client({
    endpoint: must("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? must("S3_ACCESS_KEY_ID"),
      secretAccessKey: process.env.S3_SECRET_KEY ?? must("S3_SECRET_ACCESS_KEY")
    },
    forcePathStyle: true
  });

  const buckets = [must("S3_BUCKET_ORIGINALS"), must("S3_BUCKET_HLS")];
  for (const b of buckets) {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: b }));
      console.log(`[ensure-buckets] created ${b}`);
    } catch (err: any) {
      const code = err?.Code || err?.name || String(err);
      if (code === "BucketAlreadyOwnedByYou" || code === "BucketAlreadyExists") {
        console.log(`[ensure-buckets] exists ${b}`);
      } else {
        console.error(`[ensure-buckets] failed ${b}: ${code}`);
        throw err;
      }
    }
  }

  const hlsBucket = must("S3_BUCKET_HLS");
  await s3.send(new PutBucketPolicyCommand({
    Bucket: hlsBucket,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${hlsBucket}/*`
      }]
    })
  }));
  console.log(`[ensure-buckets] public read policy applied to ${hlsBucket}`);
}

main().catch((err) => {
  console.error("[ensure-buckets] FATAL", err);
  process.exit(1);
});
