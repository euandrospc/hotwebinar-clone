import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma, Prisma } from "db";

// Inbound sales webhook for Kirvano. Kirvano POSTs the raw sale payload here on
// every checkout event. We only act on approved purchases: look up which webinar
// lead the buyer is (by email, then phone), and record a Sale attributed to that
// webinar so the dashboard's revenue/total updates. A sale we can't attribute to
// a lead is still stored (idempotent audit) but has no webinarId, so it does not
// show in the per-owner dashboard.
//
// Auth: shared secret in `?secret=` query (Kirvano lets you put it in the URL) or
// header `x-webhook-secret`, compared to env KIRVANO_WEBHOOK_SECRET. Fail-closed.

/** Constant-time compare; false on length mismatch. */
function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Digits only, last 9 digits (BR mobile without country code) for fuzzy phone match. */
function phoneTail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D+/g, "");
  if (d.length < 8) return null;
  return d.slice(-9);
}

/** Kirvano sends fiscal.total_value as a number (reais). Fallback: parse "R$ 97,00". */
function amountCents(body: KirvanoBody): number {
  const fv = body.fiscal?.total_value;
  if (typeof fv === "number" && Number.isFinite(fv)) return Math.round(fv * 100);
  const tp = body.total_price;
  if (typeof tp === "string") {
    const digits = tp.replace(/[^\d,]/g, "").replace(",", ".");
    const n = Number(digits);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return 0;
}

interface KirvanoBody {
  event?: string;
  status?: string;
  sale_id?: string;
  total_price?: string;
  customer?: { name?: string; email?: string; phone_number?: string };
  products?: Array<{ name?: string }>;
  fiscal?: { total_value?: number };
  [k: string]: unknown;
}

async function findWebinarLead(
  email: string | null,
  phone: string | null
): Promise<{ id: string; webinarId: string } | null> {
  // 1) Exact email match (case-insensitive), most recent lead wins.
  if (email) {
    const byEmail = await prisma.lead.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { sessionStart: "desc" },
      select: { id: true, webinarId: true }
    });
    if (byEmail) return byEmail;
  }
  // 2) Fallback: fuzzy phone match on the last 9 digits, most recent lead wins.
  const tail = phoneTail(phone);
  if (tail) {
    const rows = await prisma.$queryRaw<Array<{ id: string; webinarId: string }>>`
      SELECT id, "webinarId"
      FROM "lead"
      WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') LIKE ${"%" + tail}
      ORDER BY "sessionStart" DESC
      LIMIT 1`;
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret") ?? "";
  const expected = process.env.KIRVANO_WEBHOOK_SECRET;
  if (!expected || !secretsMatch(expected, provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: KirvanoBody;
  try {
    body = (await request.json()) as KirvanoBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Only approved purchases count as a conversion.
  const approved = body.event === "SALE_APPROVED" || body.status === "APPROVED";
  if (!approved) {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_approved", event: body.event ?? null });
  }

  const externalId = body.sale_id;
  if (!externalId) {
    return NextResponse.json({ error: "missing_sale_id" }, { status: 400 });
  }

  const email = body.customer?.email?.trim() || null;
  const phone = body.customer?.phone_number || null;
  const buyerName = body.customer?.name || null;
  const productName = body.products?.[0]?.name || null;

  const match = await findWebinarLead(email, phone);

  try {
    const sale = await prisma.sale.create({
      data: {
        externalId,
        amount: amountCents(body),
        currency: "BRL",
        productName,
        buyerEmail: email,
        buyerName,
        source: "kirvano",
        webinarId: match?.webinarId ?? null,
        leadId: match?.id ?? null,
        payload: body as Prisma.InputJsonValue
      }
    });
    return NextResponse.json(
      { ok: true, matched: Boolean(match), saleId: sale.id, webinarId: match?.webinarId ?? null },
      { status: 201 }
    );
  } catch (err) {
    // Idempotent: Kirvano retries → same sale_id → unique violation → already processed.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true, externalId }, { status: 200 });
    }
    throw err;
  }
}
