import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "db";
import { AUTO_TIMEZONE_VALUE } from "@/lib/timezones";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Webinars disponíveis"
};

export default async function PublicWebinarsList() {
  const webinars = await prisma.webinar.findMany({
    where: { status: "ACTIVE", slug: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, name: true, startDate: true, timezone: true }
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Webinars disponíveis</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Selecione um webinar para se inscrever.
      </p>
      <ul className="mt-8 space-y-3">
        {webinars.length === 0 && (
          <li className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum webinar ativo no momento.
          </li>
        )}
        {webinars.map((w) => (
          <li key={w.id}>
            <Link
              href={`/${w.slug}`}
              className="block rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
            >
              <p className="text-lg font-semibold">{w.title || w.name || w.slug}</p>
              {w.startDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone:
                      !w.timezone || w.timezone === AUTO_TIMEZONE_VALUE
                        ? "America/Sao_Paulo"
                        : w.timezone
                  }).format(w.startDate)}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
