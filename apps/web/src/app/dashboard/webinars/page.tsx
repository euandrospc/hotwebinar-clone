import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "db";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { WebinarsFilters } from "@/components/webinars/webinars-filters";
import { WebinarsTable } from "@/components/webinars/webinars-table";
import { NewWebinarButton } from "@/components/webinars/new-webinar-button";

const PAGE_SIZE = 20;

export default async function WebinarsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?from=/dashboard/webinars");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = get("q");
  const status = get("status");
  const tipo = get("tipo");
  const sort = get("sort") || "recent";
  const page = Math.max(1, parseInt(get("page") || "1", 10));

  const where: Prisma.WebinarWhereInput = {
    ownerId: session.user.id,
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] }),
    ...(status === "DRAFT" || status === "ACTIVE" || status === "ARCHIVED" ? { status } : {}),
    ...(tipo === "UNICO" || tipo === "JIT" ? { mode: tipo } : {})
  };
  const orderBy: Prisma.WebinarOrderByWithRelationInput =
    sort === "az" ? { title: "asc" } :
    sort === "za" ? { title: "desc" } :
    sort === "oldest" ? { createdAt: "asc" } :
    { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.webinar.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.webinar.count({ where })
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const publicBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

  function buildHref(p: number) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string") next.set(k, v);
    }
    next.set("page", String(p));
    return `/dashboard/webinars?${next.toString()}`;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Webinars</h1>
        <NewWebinarButton />
      </div>
      <div className="mt-6">
        <WebinarsFilters />
      </div>
      <div className="mt-6">
        <WebinarsTable rows={rows} publicBaseUrl={publicBaseUrl} />
      </div>
      <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>Total: {total} · Página {page} de {lastPage}</span>
        <div className="flex gap-2">
          {page > 1 && <a href={buildHref(page - 1)} className="rounded-md border px-3 py-1">Anterior</a>}
          {page < lastPage && <a href={buildHref(page + 1)} className="rounded-md border px-3 py-1">Próximo</a>}
        </div>
      </div>
    </div>
  );
}
