import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma, Prisma } from "db";

/** Constant-time string compare; false on length mismatch (no early return leak). */
function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const inputSchema = z.object({
  externalId: z.string().min(1).max(200),
  amount: z.number().int().nonnegative(),
  currency: z.string().min(3).max(8).default("BRL"),
  buyerEmail: z.string().email().optional(),
  buyerName: z.string().max(120).optional(),
  productName: z.string().max(200).optional(),
  source: z.string().max(40).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  const { webinarId } = await params;
  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!provided) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const webinar = await prisma.webinar.findUnique({
    where: { id: webinarId },
    select: { id: true, salesWebhookSecret: true }
  });
  if (!webinar || !webinar.salesWebhookSecret || !secretsMatch(webinar.salesWebhookSecret, provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;

  let leadId: string | null = null;
  if (d.buyerEmail) {
    const lead = await prisma.lead.findUnique({
      where: { webinarId_email: { webinarId, email: d.buyerEmail } },
      select: { id: true }
    });
    leadId = lead?.id ?? null;
  }

  try {
    const sale = await prisma.sale.create({
      data: {
        externalId: d.externalId,
        amount: d.amount,
        currency: d.currency,
        productName: d.productName ?? null,
        buyerEmail: d.buyerEmail ?? null,
        buyerName: d.buyerName ?? null,
        source: d.source ?? null,
        webinarId,
        leadId,
        payload: body as Prisma.InputJsonValue
      }
    });
    return NextResponse.json({ ok: true, saleId: sale.id }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "duplicate", externalId: d.externalId }, { status: 409 });
    }
    throw err;
  }
}
