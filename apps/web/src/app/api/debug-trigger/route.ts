import { NextResponse } from "next/server";
import { enqueueTranscode } from "jobs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const debugSecret = url.searchParams.get("secret");
  if (debugSecret !== process.env.BETTER_AUTH_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const handle = await enqueueTranscode({ videoId: "debug-test-" + Date.now() });
    return NextResponse.json({
      ok: true,
      runId: handle.id,
      env: {
        hasKey: Boolean(process.env.TRIGGER_SECRET_KEY),
        keyPrefix: process.env.TRIGGER_SECRET_KEY?.slice(0, 8),
        apiUrl: process.env.TRIGGER_API_URL
      }
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
      stack: err?.stack?.slice(0, 1000),
      env: {
        hasKey: Boolean(process.env.TRIGGER_SECRET_KEY),
        keyPrefix: process.env.TRIGGER_SECRET_KEY?.slice(0, 8),
        apiUrl: process.env.TRIGGER_API_URL
      }
    }, { status: 500 });
  }
}
