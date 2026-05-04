import { z } from "zod";

export const accountSettingsSchema = z.object({
  defaultLanguage: z.string().min(2).max(10),
  defaultTimezone: z.string().min(1),
  brandName: z.string().max(120).optional().or(z.literal(""))
});
export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;
