import { z } from "zod";

export const offerTitleFormatSchema = z.object({
  fontSize: z.number().int().min(12).max(72),
  fontFamily: z.enum(["inherit", "Arial, sans-serif", "Georgia, serif", "Verdana, sans-serif", "monospace"]),
  color: z.union([z.literal("inherit"), z.string().regex(/^#[0-9a-fA-F]{6}$/)]),
  background: z.union([z.literal("transparent"), z.string().regex(/^#[0-9a-fA-F]{6}$/)]),
  align: z.enum(["left", "center", "right"]),
  bold: z.boolean(),
  italic: z.boolean(),
  underline: z.boolean()
});
export type OfferTitleFormat = z.infer<typeof offerTitleFormatSchema>;
export const defaultTitleFormat: OfferTitleFormat = {
  fontSize: 20, fontFamily: "inherit", color: "inherit", background: "transparent",
  align: "left", bold: true, italic: false, underline: false
};
export function parseTitleFormat(value?: string): OfferTitleFormat {
  try {
    const parsed = offerTitleFormatSchema.safeParse(JSON.parse(value ?? ""));
    if (parsed.success) return parsed.data;
  } catch { /* Older titles use named styles. */ }
  return { ...defaultTitleFormat, fontSize: value === "simple" ? 16 : 20, align: value === "band" ? "center" : "left" };
}
export function titleFormatStyles(format: OfferTitleFormat) {
  return {
    fontSize: `${format.fontSize}px`, fontFamily: format.fontFamily,
    color: format.color, backgroundColor: format.background, textAlign: format.align,
    fontWeight: format.bold ? 700 : 400, fontStyle: format.italic ? "italic" : "normal",
    textDecoration: format.underline ? "underline" : "none"
  } as const;
}
export const storedTitleFormatSchema = z.string().max(40000).refine(value => {
  if (["simple", "highlight", "band"].includes(value)) return true;
  try { return offerTitleFormatSchema.safeParse(JSON.parse(value)).success || richTitleSchema.safeParse(JSON.parse(value)).success; } catch { return false; }
}, "Formatação do título inválida");

const safeColor = z.string().regex(/^(#[0-9a-fA-F]{6}|rgb\(\d{1,3}, \d{1,3}, \d{1,3}\))$/).nullable().optional();
const textMark = z.object({
  type: z.enum(["bold", "italic", "underline", "strike", "textStyle", "highlight"]),
  attrs: z.object({
    color: safeColor,
    backgroundColor: safeColor,
    fontSize: z.string().regex(/^(1[2-9]|[2-6][0-9]|7[0-2])px$/).nullable().optional(),
    fontFamily: z.enum(["inherit", "Arial, sans-serif", "Georgia, serif", "Verdana, sans-serif", "monospace"]).nullable().optional()
  }).optional()
});
const inlineNode = z.object({
  type: z.enum(["text", "hardBreak"]),
  text: z.string().max(120).optional(),
  marks: z.array(textMark).max(5).optional()
});
export const richTitleSchema = z.object({
  mode: z.enum(["plain", "rich"]),
  background: z.union([z.literal("transparent"), z.string().regex(/^#[0-9a-fA-F]{6}$/)]),
  doc: z.object({
    type: z.literal("doc"),
    content: z.array(z.object({
      type: z.literal("paragraph"),
      attrs: z.object({ textAlign: z.enum(["left", "center", "right", "justify"]).nullable().optional() }).optional(),
      content: z.array(inlineNode).max(120).optional()
    })).max(120)
  })
});
export type RichTitle = z.infer<typeof richTitleSchema>;
export function readRichTitle(value?: string): RichTitle | null {
  try {
    const result = richTitleSchema.safeParse(JSON.parse(value ?? ""));
    return result.success ? result.data : null;
  } catch { return null; }
}
