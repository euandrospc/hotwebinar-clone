import { z } from "zod";
import { isReservedSlug } from "@/lib/slug-blacklist";

export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Slug: minúsculas, números e hífen apenas")
  .refine((s) => !isReservedSlug(s), { message: "Slug reservado, escolha outro" });

export const step1Schema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().min(1).max(180),
  slug: slugSchema,
  language: z.string().min(2).max(10),
  accessFacilitated: z.boolean(),
  videoSyncWithStart: z.boolean()
});
export type Step1Input = z.infer<typeof step1Schema>;

export const step2Schema = z
  .object({
    mode: z.enum(["UNICO", "JIT"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    timezone: z.string().min(1),
    waitingTitle: z.string().min(1).max(80),
    waitingSubtitle: z.string().max(200),
    waitingShowThumb: z.boolean().default(false),
    waitingTemplate: z.enum(["DEFAULT", "WITH_THUMB", "IMMERSIVE", "MINIMAL", "FEATURES"]).default("DEFAULT")
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "Fim deve ser após início",
    path: ["endDate"]
  });
export type Step2Input = z.infer<typeof step2Schema>;

export const step3Schema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal("")),
  loginButtonText: z.string().min(1).max(40),
  loginButtonColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  nameEnabled: z.boolean(),
  nameRequired: z.boolean(),
  emailEnabled: z.boolean(),
  emailRequired: z.boolean(),
  phoneEnabled: z.boolean(),
  phoneRequired: z.boolean(),
  namePlaceholder: z.string(),
  emailPlaceholder: z.string(),
  phonePlaceholder: z.string(),
  loginLogoAlign: z.enum(["LEFT", "CENTER", "RIGHT"]),
  progressEnabled: z.boolean(),
  progressStartPct: z.number().int().min(0).max(99),
  progressBarColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  progressTextColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  progressText: z.string().min(1).max(120),
  formFieldOrder: z
    .array(z.enum(["name", "email", "phone"]))
    .min(1)
    .max(3)
    .refine((arr) => new Set(arr).size === arr.length, { message: "Sem duplicatas em formFieldOrder" })
});
export type Step3Input = z.infer<typeof step3Schema>;

export const step4ExternalSchema = z.object({
  mode: z.literal("external"),
  videoExternalUrl: z.string().url("Cole uma URL válida"),
  pitchAtSec: z.number().int().min(0).optional()
});
export const step4LibrarySchema = z.object({
  mode: z.literal("library"),
  videoId: z.string().min(1),
  pitchAtSec: z.number().int().min(0).optional()
});
export const step4UploadSchema = z.object({
  mode: z.literal("upload-complete"),
  videoId: z.string().min(1),
  pitchAtSec: z.number().int().min(0).optional()
});
export const step4Schema = z.discriminatedUnion("mode", [
  step4ExternalSchema,
  step4LibrarySchema,
  step4UploadSchema
]);
export type Step4Input = z.infer<typeof step4Schema>;

export const step5Schema = z.object({
  offerName: z.string().min(1, "Nome obrigatório").max(100),
  offerTitle: z.string().min(1, "Título obrigatório").max(120),
  offerPriceOriginal: z.string().max(50).optional().nullable(),
  offerPriceFinal: z.string().max(50).optional().nullable(),
  offerButtonText: z.string().min(1).max(50),
  offerButtonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor hex inválida"),
  offerImageDesktopUrl: z.string().url().optional().nullable(),
  offerImageMobileUrl: z.string().url().optional().nullable(),
  pitchAtSec: z.number().int().min(0).optional().nullable(),
  offerShowAtSec: z.number().int().min(0).optional().nullable(),
  offerHideAtSec: z.number().int().min(0).optional().nullable(),
  offerLink: z.string().url().optional().nullable().or(z.literal("")),
  offerPassUtms: z.boolean(),
  offerDisabled: z.boolean(),
  offerSameWindow: z.boolean(),
  offerRaffleEnabled: z.boolean(),
  offerRaffleAtSec: z.number().int().min(0).optional().nullable(),
  offerRaffleNumber: z.string().max(50).optional().nullable()
}).refine(
  (d) => d.offerHideAtSec == null || d.offerShowAtSec == null || d.offerHideAtSec >= d.offerShowAtSec,
  { message: "Tempo fim deve ser ≥ tempo início", path: ["offerHideAtSec"] }
);
export type Step5Input = z.infer<typeof step5Schema>;

export const chatItemSchema = z.object({
  id: z.string().optional(),
  authorName: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
  showAtSec: z.number().int().min(0),
  isOwner: z.boolean().default(false)
});
export const step6Schema = z.object({ messages: z.array(chatItemSchema) });
export type Step6Input = z.infer<typeof step6Schema>;
export type ChatItem = z.infer<typeof chatItemSchema>;

export const saleItemSchema = z.object({
  id: z.string().optional(),
  showAtSec: z.number().int().min(0),
  buyerName: z.string().min(1, "Texto obrigatório").max(200),
  productName: z.string().max(120).optional().default(""),
  price: z.string().max(20).optional().nullable()
});
export const step7Schema = z.object({ notifications: z.array(saleItemSchema) });
export type Step7Input = z.infer<typeof step7Schema>;
export type SaleItem = z.infer<typeof saleItemSchema>;

export const step8Schema = z.object({
  audienceMode: z.enum(["NONE", "FIXED", "DYNAMIC"]),
  audienceMin: z.number().int().min(0).max(1_000_000),
  audienceMax: z.number().int().min(0).max(1_000_000),
  audienceLiveBadge: z.boolean()
}).refine((d) => d.audienceMax >= d.audienceMin, {
  message: "Max deve ser ≥ Min",
  path: ["audienceMax"]
});
export type Step8Input = z.infer<typeof step8Schema>;

export const integrationsSchema = z.object({
  webhookUrl: z.string().url("URL inválida").or(z.literal("")).optional(),
  webhookOnOptin: z.boolean(),
  webhookOnEnter: z.boolean(),
  webhookOnOfferView: z.boolean(),
  webhookOnOfferClick: z.boolean(),
  webhookOnRaffleEntry: z.boolean(),
  webhookOnPitchReached: z.boolean(),
  webhookOnPermanence: z.boolean(),
  webhookOnLeave: z.boolean(),
  permanenceThresholdSec: z.number().int().min(1).max(86_400)
});
export type IntegrationsInput = z.infer<typeof integrationsSchema>;
