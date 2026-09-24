import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const webinar = await prisma.webinar.findUnique({ where: { id } });
  if (!webinar || webinar.ownerId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const clicked = url.searchParams.get("clicked") === "1";

  const where = {
    webinarId: id,
    ...(clicked && { ctaClicks: { gt: 0 } }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } }
      ]
    })
  };

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { sessionStart: "desc" },
    select: {
      name: true,
      email: true,
      phone: true,
      city: true,
      region: true,
      country: true,
      pitchFired: true,
      ctaClicks: true,
      watchedSec: true,
      leaveFired: true,
      sessionStart: true
    }
  });

  const header = [
    "Nome",
    "Email",
    "Telefone",
    "Cidade",
    "Regiao",
    "Pais",
    "Chegou no pitch",
    "Cliques na oferta",
    "Minutos assistidos",
    "Saiu do webinar",
    "Opt-in"
  ];

  const rows = leads.map((l) =>
    [
      l.name,
      l.email && !l.email.endsWith("@no-email.invalid") ? l.email : "",
      l.phone ?? "",
      l.city ?? "",
      l.region ?? "",
      l.country ?? "",
      l.pitchFired ? "Sim" : "Nao",
      l.ctaClicks,
      Math.round(l.watchedSec / 60),
      l.leaveFired ? "Sim" : "Nao",
      fmtDate.format(l.sessionStart)
    ]
      .map(csvCell)
      .join(",")
  );

  // BOM so Excel reads UTF-8 accents correctly.
  const csv = "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n");
  const suffix = clicked ? "-clicaram-oferta" : "";
  const filename = `leads-${webinar.slug ?? id}${suffix}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
