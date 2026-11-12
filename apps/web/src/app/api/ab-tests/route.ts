import { NextResponse } from "next/server";
import { AB_RESPONSE_HEADERS, abErrorResponse, createExperiment, listExperiments, requireAbAdmin } from "@/server/ab-tests/experiments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = await requireAbAdmin(request);
    return NextResponse.json(await listExperiments(ownerId), { headers: AB_RESPONSE_HEADERS });
  } catch (error) { return abErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ownerId = await requireAbAdmin(request, true);
    const experiment = await createExperiment(ownerId, await request.json().catch(() => null));
    return NextResponse.json({ experiment }, { status: 201, headers: AB_RESPONSE_HEADERS });
  } catch (error) { return abErrorResponse(error); }
}
