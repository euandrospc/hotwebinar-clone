import { listVideos } from "@/server/actions/video";
import { UsageBar } from "@/components/videos/usage-bar";
import { UploadButton } from "@/components/videos/upload-button";
import { VideosTable, type VideoRow } from "@/components/videos/videos-table";
import { ClientPolling } from "@/components/videos/client-polling";

export default async function VideosPage() {
  const videos = await listVideos();
  const rows: VideoRow[] = videos.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    progress: v.progress,
    durationSec: v.durationSec,
    bytes: v.bytes,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl,
    hlsUrl: v.hlsUrl,
    errorMessage: v.errorMessage
  }));

  const usedBytes = rows.reduce((acc, r) => acc + (r.bytes ? Number(r.bytes) : 0), 0);
  const transientCount = rows.filter((r) => r.status === "QUEUED" || r.status === "PROCESSING").length;

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Vídeos</h1>
        <UploadButton />
      </div>
      <div className="mt-6">
        <UsageBar usedBytes={usedBytes} />
      </div>
      <div className="mt-6">
        <VideosTable rows={rows} />
      </div>
      <ClientPolling enabled={transientCount > 0} />
    </div>
  );
}
