import { NextResponse } from "next/server";
import { z } from "zod";
import { getAbReport } from "@/server/ab-tests/report";
import { requireAbAdmin, abErrorResponse, AB_RESPONSE_HEADERS, AbTestError } from "@/server/ab-tests/experiments";

const filtersSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  source: z.string().trim().max(500).optional(), medium: z.string().trim().max(500).optional(),
  campaign: z.string().trim().max(500).optional(), content: z.string().trim().max(500).optional(),
  device: z.enum(["desktop", "mobile", "tablet", "unknown", "__unknown__"]).optional()
}).strict().refine((value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to));

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await requireAbAdmin(request);
    const { id } = await params;
    if (!id || id.length > 128) throw new AbTestError("invalid_input", 400, "O identificador do teste é inválido.");
    const parsed = filtersSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new AbTestError("invalid_input", 400, "Revise o período e os filtros do relatório.");
    return NextResponse.json(await getAbReport(ownerId, id, parsed.data), { headers: AB_RESPONSE_HEADERS });
  } catch (error) { return abErrorResponse(error); }
}
