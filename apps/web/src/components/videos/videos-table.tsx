import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { VideoRowActions } from "./video-row-actions";

export interface VideoRow {
  id: string;
  name: string;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  progress: number;
  durationSec: number | null;
  bytes: string | null;
  thumbUrl: string | null;
  customThumbUrl: string | null;
  hlsUrl: string | null;
  errorMessage: string | null;
}

const STATUS_LABEL: Record<VideoRow["status"], string> = {
  QUEUED: "Em fila",
  PROCESSING: "Processando",
  READY: "Pronto",
  FAILED: "Falhou"
};

function formatBytes(s: string | null): string {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let cur = n / 1024; let i = 0;
  while (cur >= 1024 && i < units.length - 1) { cur /= 1024; i += 1; }
  return `${cur.toFixed(2)} ${units[i]}`;
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function VideosTable({ rows }: { rows: VideoRow[] }) {
  if (rows.length === 0) {
    return <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum vídeo — envie o primeiro.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vídeo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duração</TableHead>
          <TableHead>Tamanho</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((v) => {
          const thumb = v.customThumbUrl ?? v.thumbUrl;
          return (
            <TableRow key={v.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="aspect-video h-12 w-20 overflow-hidden rounded bg-muted">
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div>
                    <p className="font-medium">{v.name}</p>
                    {v.errorMessage && <p className="text-xs text-destructive">{v.errorMessage}</p>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={v.status === "READY" ? "default" : v.status === "FAILED" ? "destructive" : "outline"}>
                  {STATUS_LABEL[v.status]}
                </Badge>
                {(v.status === "PROCESSING" || v.status === "QUEUED") && (
                  <div className="mt-2 w-32 space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary transition-[width] duration-300 ease-out"
                        style={{ width: `${v.progress}%` }}
                      />
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">{v.progress}%</p>
                  </div>
                )}
              </TableCell>
              <TableCell>{formatDuration(v.durationSec)}</TableCell>
              <TableCell>{formatBytes(v.bytes)}</TableCell>
              <TableCell>
                <VideoRowActions
                  id={v.id}
                  name={v.name}
                  status={v.status}
                  customThumbUrl={v.customThumbUrl}
                  hlsUrl={v.hlsUrl}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
