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
  /** Class B reads per UTC day, oldest first, one entry per day from `from` to `to`. */
  daily: Array<{ date: string; classB: number }>;
  daysInMonth: number;
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
    ops: r2OperationsAdaptiveGroups(limit: 10000,
      filter: { bucketName: $bucket, date_geq: $from, date_leq: $to }) {
      sum { requests responseObjectSize }
      dimensions { actionType date }
    }
  } }
}`;

/** Linear month-end projection from the average daily pace so far. */
export function projectR2Month(u: Pick<R2Usage, "from" | "to" | "storageBytes" | "classA" | "classB" | "daysInMonth">) {
  const elapsed = Math.round((Date.parse(u.to) - Date.parse(u.from)) / 86_400_000) + 1;
  const factor = u.daysInMonth / elapsed;
  const classB = u.classB * factor;
  const perDay = u.classB / elapsed;
  // Day of the month when reads cross the free tier at this pace; null when they won't (or already did).
  const classBLimitDay = u.classB < R2_PRICING.freeClassB && classB > R2_PRICING.freeClassB
    ? Math.ceil(R2_PRICING.freeClassB / perDay) : null;
  return { elapsed, complete: elapsed >= u.daysInMonth, classA: u.classA * factor, classB, classBLimitDay,
    costUsd: estimateR2Cost(u.storageBytes, u.classA * factor, classB) };
}

/** `month` is "YYYY-MM" (defaults to the current UTC month). null when the env is not configured; throws on API errors. */
export async function getR2Usage(now = new Date(), month?: string): Promise<R2Usage | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET ?? "hotwebinar-hls";
  if (!token || !account) return null;

  const [y, m] = month ? month.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(y, m - 1, daysInMonth)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const to = monthEnd < today ? monthEnd : today;
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { account, bucket, from, to } }),
    next: { revalidate: 300 } // analytics lag a few minutes anyway; don't hit the API per page view
  });
  const json = (await res.json()) as {
    data?: { viewer: { accounts: Array<{
      storage: Array<{ max: { objectCount: number; payloadSize: number; metadataSize: number } }>;
      ops: Array<{ sum: { requests: number; responseObjectSize: number }; dimensions: { actionType: string; date: string } }>;
    }> } };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) throw new Error(`Cloudflare: ${json.errors[0].message}`);
  const acc = json.data?.viewer.accounts[0];
  if (!acc) throw new Error("Cloudflare: conta não encontrada");

  const s = acc.storage[0]?.max;
  let classA = 0, classB = 0, egressBytes = 0;
  const byDay = new Map<string, number>();
  for (let d = Date.parse(from); d <= Date.parse(to); d += 86_400_000) byDay.set(new Date(d).toISOString().slice(0, 10), 0);
  for (const o of acc.ops) {
    if (CLASS_A.has(o.dimensions.actionType)) classA += o.sum.requests;
    else if (CLASS_B.has(o.dimensions.actionType)) {
      classB += o.sum.requests;
      byDay.set(o.dimensions.date, (byDay.get(o.dimensions.date) ?? 0) + o.sum.requests);
    }
    egressBytes += o.sum.responseObjectSize;
  }
  const storageBytes = s ? s.payloadSize + s.metadataSize : 0;
  return {
    bucket, from, to, storageBytes, objectCount: s?.objectCount ?? 0, classA, classB, egressBytes,
    daily: [...byDay].map(([date, classB]) => ({ date, classB })), daysInMonth,
    costUsd: estimateR2Cost(storageBytes, classA, classB)
  };
}
