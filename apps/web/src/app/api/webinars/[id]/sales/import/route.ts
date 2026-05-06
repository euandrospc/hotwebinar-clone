import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { parseSalesXlsx } from "@/lib/sales-xlsx";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const webinar = await prisma.webinar.findUnique({ where: { id } });
  if (!webinar || webinar.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const fd = await request.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  let notifications;
  try {
    const buf = await file.arrayBuffer();
    notifications = await parseSalesXlsx(buf);
  } catch {
    return NextResponse.json({ error: "parse_failed", message: "Não foi possível ler o XLSX" }, { status: 400 });
  }

  return NextResponse.json({ notifications });
}
