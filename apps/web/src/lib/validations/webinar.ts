import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Slug: minúsculas, números e hífen apenas");

export const step1Schema = z.object({
  name: z.string().min(2).max(120),
  title: z.string().min(2).max(180),
  slug: slugSchema,
  language: z.string().min(2).max(10)
});
export type Step1Input = z.infer<typeof step1Schema>;

export const step2Schema = z
  .object({
    mode: z.enum(["UNICO", "JIT"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    timezone: z.string().min(1),
    waitingTitle: z.string().min(1).max(80),
    waitingSubtitle: z.string().max(200)
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
  phonePlaceholder: z.string()
});
export type Step3Input = z.infer<typeof step3Schema>;

export const step4Schema = z.object({
  videoExternalUrl: z.string().url("Cole uma URL válida"),
  pitchAtSec: z.number().int().min(0).optional()
});
export type Step4Input = z.infer<typeof step4Schema>;

export const ctaItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(80),
  url: z.string().url(),
  showAtSec: z.number().int().min(0),
  hideAtSec: z.number().int().min(0).optional()
});
export const step5Schema = z.object({ ctas: z.array(ctaItemSchema) });
export type Step5Input = z.infer<typeof step5Schema>;
export type CtaItem = z.infer<typeof ctaItemSchema>;

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
