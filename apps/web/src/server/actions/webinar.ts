"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "db";
import { auth } from "@/lib/auth";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
  step8Schema,
  integrationsSchema,
  type Step1Input,
  type Step2Input,
  type Step3Input,
  type Step4Input,
  type Step5Input,
  type Step6Input,
  type Step7Input,
  type Step8Input,
  type IntegrationsInput
} from "@/lib/validations/webinar";

type Result = { ok: true } | { error: { field?: string; message: string } };

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

async function loadOwned(id: string, userId: string) {
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== userId) return null;
  return w;
}

function notFound(): Result {
  return { error: { message: "Webinar não encontrado" } };
}

export async function createDraftWebinar(): Promise<{ id: string }> {
  const session = await requireSession();
  const settings = await prisma.accountSettings.findUnique({ where: { userId: session.user.id } });
  const w = await prisma.webinar.create({
    data: {
      ownerId: session.user.id,
      status: "DRAFT",
      name: settings?.brandName ?? "",
      title: settings?.brandName ?? "",
      language: settings?.defaultLanguage ?? "pt-BR",
      timezone: settings?.defaultTimezone ?? "America/Sao_Paulo"
    }
  });
  revalidatePath("/dashboard/webinars");
  return { id: w.id };
}

export async function updateWebinarStep1(id: string, input: Step1Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step1Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  try {
    await prisma.webinar.update({
      where: { id },
      data: {
        name: parsed.data.name,
        title: parsed.data.title,
        slug: parsed.data.slug,
        language: parsed.data.language,
        accessFacilitated: parsed.data.accessFacilitated,
        videoSyncWithStart: parsed.data.videoSyncWithStart
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: { field: "slug", message: "Já existe um webinar com esse slug" } };
    }
    throw e;
  }
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep2(id: string, input: Step2Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step2Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      mode: parsed.data.mode,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      timezone: parsed.data.timezone,
      waitingTitle: parsed.data.waitingTitle,
      waitingSubtitle: parsed.data.waitingSubtitle,
      waitingTemplate: parsed.data.waitingTemplate,
      // Backwards-compat: keep waitingShowThumb in sync with template choice
      waitingShowThumb:
        parsed.data.waitingTemplate === "WITH_THUMB"
          ? true
          : parsed.data.waitingShowThumb
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep3(id: string, input: Step3Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step3Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      logoUrl: parsed.data.logoUrl || null,
      primaryColor: parsed.data.primaryColor || null,
      loginButtonText: parsed.data.loginButtonText,
      loginButtonColor: parsed.data.loginButtonColor,
      nameEnabled: parsed.data.nameEnabled,
      nameRequired: parsed.data.nameRequired,
      emailEnabled: parsed.data.emailEnabled,
      emailRequired: parsed.data.emailRequired,
      phoneEnabled: parsed.data.phoneEnabled,
      phoneRequired: parsed.data.phoneRequired,
      namePlaceholder: parsed.data.namePlaceholder,
      emailPlaceholder: parsed.data.emailPlaceholder,
      phonePlaceholder: parsed.data.phonePlaceholder,
      loginLogoAlign: parsed.data.loginLogoAlign,
      progressEnabled: parsed.data.progressEnabled,
      progressStartPct: parsed.data.progressStartPct,
      progressBarColor: parsed.data.progressBarColor,
      progressTextColor: parsed.data.progressTextColor,
      progressText: parsed.data.progressText,
      formFieldOrder: parsed.data.formFieldOrder
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep4(id: string, input: Step4Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step4Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }

  const data = parsed.data;
  let videoId: string | null = null;

  if (data.mode === "external") {
    const existing = owned.videoId
      ? await prisma.video.findUnique({ where: { id: owned.videoId } })
      : null;
    if (existing && existing.source === "EXTERNAL") {
      await prisma.video.update({
        where: { id: existing.id },
        data: {
          originalUrl: data.videoExternalUrl,
          hlsUrl: data.videoExternalUrl,
          status: "READY"
        }
      });
      videoId = existing.id;
    } else {
      const v = await prisma.video.create({
        data: {
          ownerId: session.user.id,
          name: owned.title || "Vídeo externo",
          source: "EXTERNAL",
          originalUrl: data.videoExternalUrl,
          hlsUrl: data.videoExternalUrl,
          status: "READY",
          progress: 100
        }
      });
      videoId = v.id;
    }
  } else {
    // library or upload-complete: validate video ownership + ready
    const v = await prisma.video.findUnique({ where: { id: data.videoId } });
    if (!v || v.ownerId !== session.user.id) {
      return { error: { field: "videoId", message: "Vídeo não encontrado" } };
    }
    if (v.status !== "READY") {
      return { error: { field: "videoId", message: "Vídeo ainda não está pronto" } };
    }
    videoId = v.id;
  }

  await prisma.webinar.update({
    where: { id },
    data: { videoId, pitchAtSec: data.pitchAtSec ?? null }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep5(id: string, input: Step5Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step5Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  const d = parsed.data;
  await prisma.webinar.update({
    where: { id },
    data: {
      offerName: d.offerName,
      offerTitle: d.offerTitle,
      offerPriceOriginal: d.offerPriceOriginal ?? null,
      offerPriceFinal: d.offerPriceFinal ?? null,
      offerButtonText: d.offerButtonText,
      offerButtonColor: d.offerButtonColor,
      offerImageDesktopUrl: d.offerImageDesktopUrl ?? null,
      offerImageMobileUrl: d.offerImageMobileUrl ?? null,
      pitchAtSec: d.pitchAtSec ?? null,
      offerShowAtSec: d.offerShowAtSec ?? null,
      offerHideAtSec: d.offerHideAtSec ?? null,
      offerLink: d.offerLink || null,
      offerPassUtms: d.offerPassUtms,
      offerDisabled: d.offerDisabled,
      offerSameWindow: d.offerSameWindow,
      offerRaffleEnabled: d.offerRaffleEnabled
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep6(id: string, input: Step6Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step6Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  const incomingIds = new Set(parsed.data.messages.filter((m) => m.id).map((m) => m.id!));
  const existing = await prisma.chatMessage.findMany({ where: { webinarId: id } });
  const toDelete = existing.filter((e) => !incomingIds.has(e.id)).map((e) => e.id);

  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { id: { in: toDelete } } }),
    ...parsed.data.messages.map((m) =>
      m.id
        ? prisma.chatMessage.update({
            where: { id: m.id },
            data: {
              authorName: m.authorName,
              text: m.text,
              showAtSec: m.showAtSec,
              isOwner: m.isOwner
            }
          })
        : prisma.chatMessage.create({
            data: {
              webinarId: id,
              authorName: m.authorName,
              text: m.text,
              showAtSec: m.showAtSec,
              isOwner: m.isOwner
            }
          })
    )
  ]);

  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function publishWebinar(id: string): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const missing: string[] = [];
  if (!owned.name) missing.push("name");
  if (!owned.title) missing.push("title");
  if (!owned.slug) missing.push("slug");
  if (!owned.startDate) missing.push("startDate");
  if (!owned.endDate) missing.push("endDate");
  if (!owned.videoId) missing.push("video");
  if (missing.length) {
    return { error: { message: `Faltam campos: ${missing.join(", ")}` } };
  }
  await prisma.webinar.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidatePath("/dashboard/webinars");
  return { ok: true };
}

export async function deleteWebinar(id: string): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  await prisma.webinar.delete({ where: { id } });
  revalidatePath("/dashboard/webinars");
  return { ok: true };
}

export async function duplicateWebinar(id: string): Promise<{ newId: string } | { error: { message: string } }> {
  const session = await requireSession();
  const src = await loadOwned(id, session.user.id);
  if (!src) return { error: { message: "Webinar não encontrado" } };

  const messages = await prisma.chatMessage.findMany({ where: { webinarId: id } });

  const dup = await prisma.webinar.create({
    data: {
      ownerId: session.user.id,
      videoId: src.videoId,
      name: `${src.name} (cópia)`,
      title: `${src.title} (cópia)`,
      slug: null,
      language: src.language,
      mode: src.mode,
      timezone: src.timezone,
      waitingTitle: src.waitingTitle,
      waitingSubtitle: src.waitingSubtitle,
      logoUrl: src.logoUrl,
      primaryColor: src.primaryColor,
      loginButtonText: src.loginButtonText,
      loginButtonColor: src.loginButtonColor,
      nameEnabled: src.nameEnabled,
      nameRequired: src.nameRequired,
      emailEnabled: src.emailEnabled,
      emailRequired: src.emailRequired,
      phoneEnabled: src.phoneEnabled,
      phoneRequired: src.phoneRequired,
      namePlaceholder: src.namePlaceholder,
      emailPlaceholder: src.emailPlaceholder,
      phonePlaceholder: src.phonePlaceholder,
      pitchAtSec: src.pitchAtSec,
      offerName: src.offerName,
      offerTitle: src.offerTitle,
      offerPriceOriginal: src.offerPriceOriginal,
      offerPriceFinal: src.offerPriceFinal,
      offerButtonText: src.offerButtonText,
      offerButtonColor: src.offerButtonColor,
      offerImageDesktopUrl: src.offerImageDesktopUrl,
      offerImageMobileUrl: src.offerImageMobileUrl,
      offerShowAtSec: src.offerShowAtSec,
      offerHideAtSec: src.offerHideAtSec,
      offerLink: src.offerLink,
      offerPassUtms: src.offerPassUtms,
      offerDisabled: src.offerDisabled,
      offerSameWindow: src.offerSameWindow,
      offerRaffleEnabled: src.offerRaffleEnabled,
      status: "DRAFT"
    }
  });

  if (messages.length) {
    await prisma.chatMessage.createMany({
      data: messages.map((m) => ({
        webinarId: dup.id,
        authorName: m.authorName,
        text: m.text,
        showAtSec: m.showAtSec,
        isOwner: m.isOwner
      }))
    });
  }

  revalidatePath("/dashboard/webinars");
  return { newId: dup.id };
}

export async function updateWebinarStep7(id: string, input: Step7Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step7Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.$transaction([
    prisma.saleNotification.deleteMany({ where: { webinarId: id } }),
    prisma.saleNotification.createMany({
      data: parsed.data.notifications.map((n) => ({
        webinarId: id,
        showAtSec: n.showAtSec,
        buyerName: n.buyerName,
        productName: n.productName,
        price: n.price ?? null
      }))
    })
  ]);
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep8(id: string, input: Step8Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step8Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      audienceMode: parsed.data.audienceMode,
      audienceMin: parsed.data.audienceMin,
      audienceMax: parsed.data.audienceMax,
      audienceLiveBadge: parsed.data.audienceLiveBadge
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarIntegrations(id: string, input: IntegrationsInput): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = integrationsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      webhookUrl: parsed.data.webhookUrl || null,
      webhookOnOptin: parsed.data.webhookOnOptin,
      webhookOnEnter: parsed.data.webhookOnEnter,
      webhookOnOfferView: parsed.data.webhookOnOfferView,
      webhookOnOfferClick: parsed.data.webhookOnOfferClick,
      webhookOnRaffleEntry: parsed.data.webhookOnRaffleEntry,
      webhookOnPitchReached: parsed.data.webhookOnPitchReached,
      webhookOnPermanence: parsed.data.webhookOnPermanence,
      webhookOnLeave: parsed.data.webhookOnLeave,
      permanenceThresholdSec: parsed.data.permanenceThresholdSec
    }
  });
  revalidatePath(`/dashboard/webinars/${id}/integrations`);
  return { ok: true };
}
