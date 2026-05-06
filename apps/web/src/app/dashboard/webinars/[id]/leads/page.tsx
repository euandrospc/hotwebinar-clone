import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 50;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

const fmtNum = new Intl.NumberFormat("pt-BR");
const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 127397;
  return String.fromCodePoint(A + code.toUpperCase().charCodeAt(0)) +
         String.fromCodePoint(A + code.toUpperCase().charCodeAt(1));
}

export default async function LeadsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    webinarId: id,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } }
      ]
    })
  };

  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { sessionStart: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        region: true,
        country: true,
        sessionStart: true,
        reachedPitch: true,
        ctaClicks: true
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseHref = `/dashboard/webinars/${id}/leads`;
  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <div className="container mx-auto py-6">
      <WebinarTabs webinarId={id} />

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {fmtNum.format(total)} {total === 1 ? "lead" : "leads"}
        </p>
      </div>

      <form action={baseHref} method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome / email / cidade…"
          className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Pitch</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead>Opt-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lead {q ? "para essa busca" : "ainda"}.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name || "—"}</TableCell>
                <TableCell className="text-sm">{r.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.phone ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {r.country || r.city ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{flagEmoji(r.country)}</span>
                      <span>{[r.city, r.region, r.country].filter(Boolean).join(", ") || "—"}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.reachedPitch ? <Badge variant="default">Sim</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.ctaClicks}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate.format(r.sessionStart)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`${baseHref}?page=${page - 1}${qParam}`}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                ← Anterior
              </a>
            )}
            {page < totalPages && (
              <a
                href={`${baseHref}?page=${page + 1}${qParam}`}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                Próxima →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
