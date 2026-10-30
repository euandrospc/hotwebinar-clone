import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { getOnlineSnapshot } from "@/lib/online";
import { ClientPolling } from "@/components/videos/client-polling";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function clock(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function device(ua: string | null): string {
  const u = ua ?? "";
  const os = /iphone|ipad|ipod/i.test(u) ? "iOS"
    : /android/i.test(u) ? "Android"
    : /windows/i.test(u) ? "Windows"
    : /mac os/i.test(u) ? "macOS"
    : /linux/i.test(u) ? "Linux" : "—";
  const browser = /edg\//i.test(u) ? "Edge"
    : /opr\/|opera/i.test(u) ? "Opera"
    : /samsungbrowser/i.test(u) ? "Samsung"
    : /chrome|crios/i.test(u) ? "Chrome"
    : /firefox|fxios/i.test(u) ? "Firefox"
    : /safari/i.test(u) ? "Safari" : "";
  const kind = /mobi|android|iphone|ipad|ipod/i.test(u) ? "Mobile" : "Desktop";
  return [kind, os, browser].filter((x) => x && x !== "—").join(" · ") || "—";
}

export default async function OnlinePage({ searchParams }: { searchParams: Promise<{ webinarId?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);
  const { webinarId } = await searchParams;
  const online = await getOnlineSnapshot();

  const leads = await prisma.lead.findMany({
    where: { id: { in: [...online.leadIds] }, webinar: { ownerId: session.user.id }, ...(webinarId ? { webinarId } : {}) },
    orderBy: { sessionStart: "desc" },
    select: {
      id: true, name: true, email: true, phone: true, city: true, region: true, country: true,
      userAgent: true, ip: true, sessionStart: true, watchedSec: true, ctaClicks: true, pitchFired: true,
      utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true,
      webinar: { select: { id: true, title: true, name: true } },
      events: { where: { kind: "VIDEO_TICK" }, orderBy: { createdAt: "desc" }, take: 1, select: { videoSec: true } }
    }
  });

  return (
    <div className="container mx-auto py-10">
      <ClientPolling enabled intervalMs={15_000} />
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold">Ao vivo agora · {leads.length}</h1>
        {webinarId ? (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground underline">
            <Link href={`/dashboard/webinars/${webinarId}/realtime`}>Voltar ao tempo real</Link>
            <Link href="/dashboard/online">Ver todos os webinars</Link>
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Quem está com o player aberto e o vídeo rodando (sinal nos últimos 45 s). Atualiza a cada 15 s.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead>Origem (UTM)</TableHead>
              <TableHead>Webinar</TableHead>
              <TableHead>No vídeo</TableHead>
              <TableHead>Assistiu</TableHead>
              <TableHead>Pitch</TableHead>
              <TableHead>Cliques oferta</TableHead>
              <TableHead>Inscrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  Ninguém assistindo agora.
                </TableCell>
              </TableRow>
            ) : null}
            {leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name || "—"}</TableCell>
                <TableCell className="text-xs">
                  <div>{l.email.endsWith("@no-email.invalid") ? "—" : l.email}</div>
                  <div className="text-muted-foreground">{l.phone ?? "—"}</div>
                </TableCell>
                <TableCell className="text-xs">
                  {[l.city, l.region, l.country].filter(Boolean).join(", ") || "—"}
                  {l.ip ? <div className="text-muted-foreground">{l.ip}</div> : null}
                </TableCell>
                <TableCell className="text-xs">{device(l.userAgent)}</TableCell>
                <TableCell className="text-xs">
                  {[l.utmSource, l.utmMedium, l.utmCampaign, l.utmContent, l.utmTerm].filter(Boolean).join(" / ") || "—"}
                </TableCell>
                <TableCell className="text-xs">{l.webinar.title || l.webinar.name}</TableCell>
                <TableCell className="tabular-nums">{clock(l.events[0]?.videoSec)}</TableCell>
                <TableCell className="tabular-nums">{clock(l.watchedSec)}</TableCell>
                <TableCell>{l.pitchFired ? "Sim" : "Não"}</TableCell>
                <TableCell className="tabular-nums">{l.ctaClicks}</TableCell>
                <TableCell className="text-xs">{dt.format(l.sessionStart)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
