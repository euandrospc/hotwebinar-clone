import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step4Form } from "@/components/wizard/step-4-form";
import type { LibraryVideo } from "@/components/videos/library-picker";

export default async function Step4Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id }, include: { video: true } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const library = await prisma.video.findMany({
    where: { ownerId: session.user.id, status: "READY" },
    orderBy: { createdAt: "desc" }
  });
  const libraryVideos: LibraryVideo[] = library.map((v) => ({
    id: v.id,
    name: v.name,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl,
    durationSec: v.durationSec
  }));

  const initialMode: "external" | "upload" | "library" =
    w.video?.source === "UPLOAD" ? "library" : "external";

  return (
    <Step4Form
      webinarId={id}
      initial={{
        mode: initialMode,
        videoExternalUrl: w.video?.source === "EXTERNAL" ? (w.video.originalUrl ?? "") : "",
        selectedVideoId: w.video?.source === "UPLOAD" ? w.videoId : null,
        pitchAtSec: w.pitchAtSec ?? undefined
      }}
      libraryVideos={libraryVideos}
    />
  );
}
