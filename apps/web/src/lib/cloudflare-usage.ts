// R2 usage for the current month from Cloudflare's GraphQL Analytics API, plus a
// cost estimate. Needs a token with "Account Analytics: Read".

// R2 Standard list prices (USD) and the monthly free tier.
// https://developers.cloudflare.com/r2/pricing/
export const R2_PRICING = {
  storageGbMonth: 0.015,
  classAPerMillion: 4.5,
  classBPerMillion: 0.36,
  freeStorageGb: 10,
  freeClassA: 1_000_000,
  freeClassB: 10_000_000
} as const;

// Operation names per class; anything else (deletes, aborts) is free.
const CLASS_A = new Set([
  "ListBuckets", "PutBucket", "ListObjects", "PutObject", "CopyObject", "CompleteMultipartUpload",
  "CreateMultipartUpload", "ListMultipartUploads", "UploadPart", "UploadPartCopy", "ListParts",
  "PutBucketEncryption", "PutBucketCors", "PutBucketLifecycleConfiguration"
]);
const CLASS_B = new Set([
  "HeadBucket", "HeadObject", "GetObject", "UsageSummary", "GetBucketEncryption",
  "GetBucketLocation", "GetBucketCors", "GetBucketLifecycleConfiguration"
]);

export interface R2Usage {
  bucket: string;
  from: string;
  to: string;
  storageBytes: number;
  objectCount: number;
  classA: number;
  classB: number;
  egressBytes: number;
  costUsd: { storage: number; classA: number; classB: number; total: number };
}

const GB = 1024 ** 3;

export function estimateR2Cost(storageBytes: number, classA: number, classB: number) {
  // shortcut: bills storage at today's size for the whole month; Cloudflare bills the
  // average over the month, so this is high while the bucket is still growing.
  const storage = Math.max(0, storageBytes / GB - R2_PRICING.freeStorageGb) * R2_PRICING.storageGbMonth;
  const a = (Math.max(0, classA - R2_PRICING.freeClassA) / 1e6) * R2_PRICING.classAPerMillion;
  const b = (Math.max(0, classB - R2_PRICING.freeClassB) / 1e6) * R2_PRICING.classBPerMillion;
  return { storage, classA: a, classB: b, total: storage + a + b };
}

const QUERY = `query($account: String!, $bucket: String!, $from: Date!, $to: Date!) {
  viewer { accounts(filter: { accountTag: $account }) {
    storage: r2StorageAdaptiveGroups(limit: 1, orderBy: [date_DESC],
      filter: { bucketName: $bucket, date_geq: $from, date_leq: $to }) {
      max { objectCount payloadSize metadataSize }
      dimensions { date }
    }
    ops: r2OperationsAdaptiveGroups(limit: 1000,
      filter: { bucketName: $bucket, date_geq: $from, date_leq: $to }) {
      sum { requests responseObjectSize }
      dimensions { actionType }
    }
  } }
}`;

/** null when the env is not configured; throws on API errors. */
export async function getR2Usage(now = new Date()): Promise<R2Usage | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET ?? "hotwebinar-hls";
  if (!token || !account) return null;

  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { account, bucket, from, to } }),
    next: { revalidate: 300 } // analytics lag a few minutes anyway; don't hit the API per page view
  });
  const json = (await res.json()) as {
    data?: { viewer: { accounts: Array<{
      storage: Array<{ max: { objectCount: number; payloadSize: number; metadataSize: number } }>;
      ops: Array<{ sum: { requests: number; responseObjectSize: number }; dimensions: { actionType: string } }>;
    }> } };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) throw new Error(`Cloudflare: ${json.errors[0].message}`);
  const acc = json.data?.viewer.accounts[0];
  if (!acc) throw new Error("Cloudflare: conta não encontrada");

  const s = acc.storage[0]?.max;
  let classA = 0, classB = 0, egressBytes = 0;
  for (const o of acc.ops) {
    if (CLASS_A.has(o.dimensions.actionType)) classA += o.sum.requests;
    else if (CLASS_B.has(o.dimensions.actionType)) classB += o.sum.requests;
    egressBytes += o.sum.responseObjectSize;
  }
  const storageBytes = s ? s.payloadSize + s.metadataSize : 0;
  return {
    bucket, from, to, storageBytes, objectCount: s?.objectCount ?? 0, classA, classB, egressBytes,
    costUsd: estimateR2Cost(storageBytes, classA, classB)
  };
}
