import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videos = await prisma.video.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      progress: true,
      durationSec: true,
      bytes: true,
      thumbUrl: true,
      customThumbUrl: true,
      hlsUrl: true,
      errorMessage: true,
      createdAt: true
    }
  });
  // Serialize bigint -> string
  const out = videos.map((v) => ({ ...v, bytes: v.bytes ? v.bytes.toString() : null }));
  return NextResponse.json({ videos: out });
}
