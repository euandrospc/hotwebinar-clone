import type { Metadata } from "next";
import { AdminPage, AdminPageHeader, AdminSurface } from "@/components/admin/admin-page";
import styles from "@/components/webinars/webinars.module.css";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "db";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { WebinarsFilters } from "@/components/webinars/webinars-filters";
import { WebinarsTable } from "@/components/webinars/webinars-table";
import { NewWebinarButton } from "@/components/webinars/new-webinar-button";

export const metadata: Metadata = { title: "Webinars" };

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
    ...(tipo === "UNICO" ? { mode: "UNICO", recurring: false } :
      tipo === "RECURRING" ? { mode: "UNICO", recurring: true } :
      tipo === "JIT" ? { mode: "JIT" } : {})
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
    <AdminPage>
      <AdminPageHeader title="Webinars" description="Organize suas transmissões e acompanhe cada experiência."
        actions={<NewWebinarButton label="Criar webinar" />} />
      <AdminSurface padded={false} className={styles.tableSurface}>
        <WebinarsFilters />
        <WebinarsTable rows={rows} publicBaseUrl={publicBaseUrl} />
      <div className={styles.pagination}>
        <span>Total: {total} · Página {page} de {lastPage}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={buildHref(page - 1)} >Anterior</Link>}
          {page < lastPage && <Link href={buildHref(page + 1)} >Próximo</Link>}
        </div>
      </div>
      </AdminSurface>
    </AdminPage>
  );
}
