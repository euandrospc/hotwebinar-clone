import type { Metadata } from "next";
import { listVideos } from "@/server/actions/video";
import { UsageBar } from "@/components/videos/usage-bar";
import { UploadButton } from "@/components/videos/upload-button";
import { VideosTable, type VideoRow } from "@/components/videos/videos-table";
import { ClientPolling } from "@/components/videos/client-polling";

import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import styles from "@/components/management-v2.module.css";

export const metadata: Metadata = { title: "Vídeos" };

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
    <AdminPage>
      <AdminPageHeader title="Vídeos" description="Sua biblioteca para os webinars." actions={<UploadButton />} />
      <section className={styles.surface} aria-label="Biblioteca de vídeos">
        <div className={styles.sectionHeader}>
          <div className="flex items-center gap-2"><h2 className={styles.sectionTitle}>Biblioteca</h2><span className={styles.count}>{rows.length}</span>{transientCount > 0 && <span className={styles.meta}>{transientCount} em processamento</span>}</div>
          <UsageBar usedBytes={usedBytes} />
        </div>
        <VideosTable rows={rows} />
      </section>
      <ClientPolling enabled={transientCount > 0} />
    </AdminPage>
  );
}
