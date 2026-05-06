import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { prisma } from "db";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, TvMinimalPlay, Users } from "lucide-react";

const fmt = new Intl.NumberFormat("pt-BR");

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);

  const [webinarsCount, leadsCount, geoLeadsCount] = await Promise.all([
    prisma.webinar.count({ where: { ownerId: session.user.id } }),
    prisma.lead.count({ where: { webinar: { ownerId: session.user.id } } }),
    prisma.lead.count({
      where: {
        webinar: { ownerId: session.user.id },
        AND: [{ lat: { not: null } }, { lng: { not: null } }]
      }
    })
  ]);

  const cards = [
    { label: "Webinars", value: webinarsCount, Icon: TvMinimalPlay, href: "/dashboard/webinars" },
    { label: "Leads totais", value: leadsCount, Icon: Users, href: "/dashboard/webinars" },
    { label: "Leads c/ geo", value: geoLeadsCount, Icon: MapPin, href: "/dashboard/webinars" }
  ];

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <Button asChild>
          <Link href="/dashboard/webinars">
            Ver webinars <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <p className="mt-2 text-muted-foreground">Visão rápida da conta.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{fmt.format(value)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
