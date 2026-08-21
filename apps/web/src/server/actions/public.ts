"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";
import { enrichLeadGeo } from "@/lib/geoip";
import { optinLimiter } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { enqueueDispatchWebhook } from "jobs";

type OkResult = { ok: true };
type ErrorResult = { error: { field?: string; message: string } };
export type ActionResult = OkResult | ErrorResult;

function err(message: string, field?: string): ErrorResult {
  return { error: { message, field } };
}

export async function submitOptin(slug: string, formData: FormData): Promise<ActionResult | never> {
  const w = await prisma.webinar.findUnique({ where: { slug } });
  if (!w || w.status !== "ACTIVE") return err("Webinar não disponível");

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "") || "unknown";
  const ua = hdrs.get("user-agent") ?? "";
  if (!optinLimiter.check(ip)) return err("Muitas tentativas, aguarde");

  const schemaShape: Record<string, z.ZodTypeAny> = {};
  if (w.nameEnabled) {
    schemaShape.name = w.nameRequired ? z.string().min(1, "Nome obrigatório") : z.string().optional();
  }
  if (w.emailEnabled) {
    schemaShape.email = w.emailRequired
      ? z.string().email("Email inválido")
      : z.string().email().optional().or(z.literal(""));
  }
  if (w.phoneEnabled) {
    schemaShape.phone = w.phoneRequired
      ? z.string().min(8, "Telefone inválido")
      : z.string().optional();
  }
  const schema = z.object(schemaShape);
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(issue.message, issue.path.join("."));
  }
  const data = parsed.data as { name?: string; email?: string; phone?: string };

  const utm = {
    utmSource: (formData.get("utm_source") as string) || null,
    utmMedium: (formData.get("utm_medium") as string) || null,
    utmCampaign: (formData.get("utm_campaign") as string) || null,
    utmTerm: (formData.get("utm_term") as string) || null,
    utmContent: (formData.get("utm_content") as string) || null
  };

  const email = data.email ?? "";
  const name = data.name ?? "";
  const phone = data.phone || null;

  let lead;
  if (email) {
    // Atomic upsert on the (webinarId, email) unique key: INSERT ... ON CONFLICT
    // DO UPDATE. This can never raise P2002 on that constraint, so it is immune
    // to the findUnique/create race (and any read-visibility gap) that the old
    // create+catch path could hit under concurrency. `undefined` = leave column
    // unchanged, preserving the previous "keep existing name/phone if blank".
    lead = await prisma.lead.upsert({
      where: { webinarId_email: { webinarId: w.id, email } },
      create: { webinarId: w.id, name, email, phone, ip, userAgent: ua, ...utm },
      update: {
        name: name || undefined,
        phone: phone ?? undefined,
        ip,
        userAgent: ua,
        lastSeenAt: new Date(),
        sessionStart: new Date(),
        enterFired: false,
        ...utm
      }
    });
  } else {
    // Webinar that doesn't collect email: `email` is "" and the DB has a NOT NULL
    // unique (webinarId, email). Two anonymous opt-ins would both write ""  and the
    // second one hit P2002 — the crash on the public /<slug> render. Give each
    // anonymous lead a unique synthetic email so they stay distinct rows.
    const anonEmail = `anon-${randomUUID()}@no-email.invalid`;
    lead = await prisma.lead.create({
      data: { webinarId: w.id, name, email: anonEmail, phone, ip, userAgent: ua, ...utm }
    });
  }

  await prisma.event.create({
    data: { webinarId: w.id, leadId: lead.id, kind: "OPTIN", metadata: { ip, ua } }
  });

  const cookie = signLeadCookie(lead.id);
  const cookieStore = await cookies();
  cookieStore.set("hw_lead", cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    // path "/" so /api/* routes (track, cta, lead-chat) receive the cookie too.
    // Trade-off: lead session of webinar A is visible to webinar B's pages, but
    // resolveLeadFromCookie validates lead.webinarId matches the requested webinar.
    path: "/"
  });

  void enrichLeadGeo(lead.id, ip);

  await enqueueWebhook(w, "lead_novo", lead);

  redirect(`/${slug}/live`);
}

export async function retryWebhook(deliveryId: string): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return err("Não autorizado");
  const orig = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webinar: true }
  });
  if (!orig || orig.webinar.ownerId !== session.user.id) return err("Não encontrado");

  const next = await prisma.webhookDelivery.create({
    data: {
      webinarId: orig.webinarId,
      leadId: orig.leadId,
      event: orig.event,
      url: orig.url,
      payload: orig.payload as any,
      status: "PENDING"
    }
  });
  await enqueueDispatchWebhook({ deliveryId: next.id });
  revalidatePath(`/dashboard/webinars/${orig.webinarId}/webhooks`);
  return { ok: true };
}
