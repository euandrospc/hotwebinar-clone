import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { ownerScope } from "@/lib/webinar-access";
import { R2_PRICING } from "@/lib/cloudflare-usage";
import { listVideos } from "@/server/actions/video";
import { UsageBar } from "@/components/videos/usage-bar";
import { UploadButton } from "@/components/videos/upload-button";
import { UploadDropCard } from "@/components/videos/upload-drop-card";
import { VideosTable, type VideoRow } from "@/components/videos/videos-table";
import { ClientPolling } from "@/components/videos/client-polling";
import { formatGb } from "@/components/videos/format";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";

export const metadata: Metadata = { title: "Vídeos" };

export default async function VideosPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const [videos, extras] = await Promise.all([
    listVideos(),
    prisma.video.findMany({
      where: ownerScope(session),
      select: { id: true, originalUrl: true, sourceHeight: true, webinars: { select: { id: true, title: true }, orderBy: { createdAt: "desc" } } }
    })
  ]);
  const extraById = new Map(extras.map((e) => [e.id, e]));

  const rows: VideoRow[] = videos.map((v) => {
    const extra = extraById.get(v.id);
    // Original object key is "<id>/raw.<ext>", the extension of the uploaded container.
    const ext = v.source === "UPLOAD" && extra?.originalUrl?.match(/\.([a-z0-9]+)$/i)?.[1];
    return {
      id: v.id,
      name: v.name,
      status: v.status,
      progress: v.progress,
      durationSec: v.durationSec,
      bytes: v.bytes,
      thumbUrl: v.thumbUrl,
      customThumbUrl: v.customThumbUrl,
      hlsUrl: v.hlsUrl,
      errorMessage: v.errorMessage,
      createdAt: v.createdAt.toISOString(),
      format: ext ? ext.toUpperCase() : null,
      sourceHeight: extra?.sourceHeight ?? null,
      webinars: extra?.webinars ?? []
    };
  });

  const usedBytes = rows.reduce((acc, r) => acc + (r.bytes ? Number(r.bytes) : 0), 0);
  const totalDurationSec = rows.reduce((acc, r) => acc + (r.durationSec ?? 0), 0);
  const transientCount = rows.filter((r) => r.status === "QUEUED" || r.status === "PROCESSING").length;
  // Same limit enforced by /api/upload/init.
  const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 ** 3);

  return (
    <AdminPage>
      <AdminPageHeader title="Vídeos" description="Sua biblioteca para os webinars." actions={<UploadButton />} />
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* No plan quota exists; the bar is measured against R2's free storage tier shown in Consumo. */}
        <UsageBar usedBytes={usedBytes} referenceBytes={R2_PRICING.freeStorageGb * 1024 ** 3} referenceLabel="grátis"
          videoCount={rows.length} totalDurationSec={totalDurationSec} />
        <UploadDropCard maxLabel={formatGb(maxUploadBytes)} />
      </div>
      <VideosTable rows={rows} />
      <ClientPolling enabled={transientCount > 0} />
    </AdminPage>
  );
}
