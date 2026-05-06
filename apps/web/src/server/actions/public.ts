"use server";

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
import { getWebhookQueue, JOB_DISPATCH_WEBHOOK } from "jobs";

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

  const existing = email
    ? await prisma.lead.findUnique({ where: { webinarId_email: { webinarId: w.id, email } } })
    : null;

  let lead;
  if (existing) {
    lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { name: name || existing.name, phone: phone ?? existing.phone, ip, userAgent: ua, lastSeenAt: new Date(), ...utm }
    });
  } else {
    try {
      lead = await prisma.lead.create({
        data: { webinarId: w.id, name, email, phone, ip, userAgent: ua, ...utm }
      });
    } catch (createErr: any) {
      // Concurrent submitOptin race: another request created lead with same email between findUnique and create.
      if (createErr?.code === "P2002" && email) {
        const racedExisting = await prisma.lead.findUnique({
          where: { webinarId_email: { webinarId: w.id, email } }
        });
        if (racedExisting) {
          lead = await prisma.lead.update({
            where: { id: racedExisting.id },
            data: { name: name || racedExisting.name, phone: phone ?? racedExisting.phone, ip, userAgent: ua, lastSeenAt: new Date(), ...utm }
          });
        } else {
          throw createErr;
        }
      } else {
        throw createErr;
      }
    }
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
  await getWebhookQueue().add(
    JOB_DISPATCH_WEBHOOK,
    { deliveryId: next.id },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );
  revalidatePath(`/dashboard/webinars/${orig.webinarId}/webhooks`);
  return { ok: true };
}
