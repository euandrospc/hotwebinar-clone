import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "db";
import { ChevronRight, Target, Headset, Gauge, Bolt } from "@/components/icons";
import type { AppIcon } from "@/components/icons";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { hasRole, ADMIN_ROLES } from "@/lib/roles";
import { ownerScope } from "@/lib/webinar-access";
import { generateAvatar } from "@/lib/generate-avatar";
import { getR2Usage, R2_PRICING } from "@/lib/cloudflare-usage";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "Mais" };
export const dynamic = "force-dynamic";

function Row({ href, label, icon: Icon, value }: { href: string; label: string; icon: AppIcon; value?: React.ReactNode }) {
  return (
    <li className="border-t border-[#1A1F1B] first:border-t-0">
      <Link href={href} className="flex h-14 items-center gap-3.5 px-4 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-palco motion-reduce:transition-none">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#1A1F1B]"><Icon aria-hidden="true" className="size-4 text-palco" /></span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-neutral-100">{label}</span>
        {value != null && <span className="shrink-0 text-[13px] tabular-nums text-[#7C867E]">{value}</span>}
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[#5A635C]" />
      </Link>
    </li>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#6E776F]">{title}</h2>
      <ul className="overflow-hidden rounded-2xl border border-[#1E241F] bg-[#0C0E0C]">{children}</ul>
    </section>
  );
}

// Storage share of the R2 free tier, same base as the Consumo meter. Empty when Cloudflare is not configured.
async function StorageShare() {
  const usage = await getR2Usage().catch(() => null);
  if (!usage) return null;
  const pct = Math.round((usage.storageBytes / 1024 ** 3 / R2_PRICING.freeStorageGb) * 100);
  return <>{pct}%</>;
}

export default async function MaisPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?from=/dashboard/mais`);
  const role = (session.user as { role?: string }).role;
  const isAdmin = hasRole(role, ADMIN_ROLES);
  const name = session.user.name || session.user.email;
  const avatar = generateAvatar(name);

  const [activeTests, attendants] = await Promise.all([
    prisma.abExperiment.count({ where: { ...ownerScope(session), status: "RUNNING" } }),
    isAdmin ? prisma.user.count({ where: { role: "attendant" } }) : Promise.resolve(null)
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-5 pb-8 pt-6">
      <header className="pb-1">
        <p className="text-[13px] text-[#7C867E]">Palco</p>
        <h1 className="mt-0.5 font-palco-serif text-[34px] leading-tight tracking-[-0.3px] text-neutral-100">Mais</h1>
      </header>
      <div className="mt-3.5 flex flex-col gap-[22px]">
        <Link href="/dashboard/settings" className="flex items-center gap-3.5 rounded-[18px] border border-[#1E241F] bg-[#0C0E0C] p-4 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#16301F] text-base font-bold text-palco">{avatar?.letters ?? name.slice(0, 2).toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-neutral-100">{name}</span>
            <span className="mt-0.5 block truncate text-[13px] text-[#7C867E]">{session.user.email}</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-[#7C867E]" />
        </Link>
        <Group title="Ferramentas">
          <Row href="/dashboard/ab-tests" label="Teste A/B" icon={Target} value={activeTests ? `${activeTests} ${activeTests === 1 ? "ativo" : "ativos"}` : undefined} />
          {isAdmin && <Row href="/dashboard/atendentes" label="Atendentes" icon={Headset} value={attendants ?? undefined} />}
        </Group>
        <Group title="Conta">
          <Row href="/dashboard/consumo" label="Consumo" icon={Gauge} value={<Suspense fallback={null}><StorageShare /></Suspense>} />
          <Row href="/dashboard/settings" label="Configurações" icon={Bolt} />
        </Group>
        <LogoutButton />
      </div>
    </div>
  );
}
