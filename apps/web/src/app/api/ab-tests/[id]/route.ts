import { NextResponse } from "next/server";
import { AB_RESPONSE_HEADERS, abErrorResponse, deleteExperiment, getExperiment, requireAbAdmin, updateExperiment } from "@/server/ab-tests/experiments";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const ownerId = await requireAbAdmin(request);
    return NextResponse.json({ experiment: await getExperiment(ownerId, (await context.params).id) }, { headers: AB_RESPONSE_HEADERS });
  } catch (error) { return abErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const ownerId = await requireAbAdmin(request, true);
    const experiment = await updateExperiment(ownerId, (await context.params).id, await request.json().catch(() => null));
    return NextResponse.json({ experiment }, { headers: AB_RESPONSE_HEADERS });
  } catch (error) { return abErrorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const ownerId = await requireAbAdmin(request, true);
    await deleteExperiment(ownerId, (await context.params).id);
    return NextResponse.json({ ok: true }, { headers: AB_RESPONSE_HEADERS });
  } catch (error) { return abErrorResponse(error); }
}
