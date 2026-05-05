import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { cookies, headers } from "next/headers";
import { verifyLeadCookie } from "@/lib/lead-session";
import { getS3Client } from "@/lib/storage/s3";
import { HLS_BUCKET } from "@/lib/storage/buckets";
import { auth } from "@/lib/auth";

function contentTypeFor(key: string): string {
  if (key.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (key.endsWith(".ts")) return "video/mp2t";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (!path || path.length < 2) return new Response("invalid path", { status: 400 });

  // Auth: lead cookie OR admin session.
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  let authorized = Boolean(leadId);
  if (!authorized) {
    const session = await auth.api.getSession({ headers: await headers() });
    authorized = Boolean(session);
  }
  if (!authorized) return new Response("unauthorized", { status: 401 });

  const key = path.join("/");
  // Sanity: key starts with cuid-like videoId
  if (!/^[A-Za-z0-9_-]+\/.+/.test(key)) return new Response("invalid", { status: 400 });

  let out;
  try {
    out = await getS3Client().send(new GetObjectCommand({ Bucket: HLS_BUCKET, Key: key }));
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return new Response("not found", { status: 404 });
    }
    throw err;
  }
  if (!out.Body) return new Response("empty body", { status: 404 });

  // AWS SDK v3 Body in Node = Readable stream; convert to web Response stream.
  const nodeStream = out.Body as unknown as Readable;
  // @ts-expect-error - Node Readable -> Response BodyInit (works in Node runtime)
  const body: BodyInit = nodeStream;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": out.ContentType ?? contentTypeFor(key),
      "cache-control": "private, max-age=300",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff"
    }
  });
}
