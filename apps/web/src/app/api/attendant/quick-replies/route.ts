import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";

// Templates are shared by the whole attendance team, like the inbox itself.
const fields = z.object({
  title: z.string().trim().min(1).max(40),
  // Same limit as a reply, so an inserted template can always be sent.
  text: z.string().trim().min(1).max(500)
});
const update = fields.extend({ id: z.string().min(1) });
const select = { id: true, title: true, text: true } as const;
const noStore = { "cache-control": "private, no-store" };

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
function isMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function GET() {
  if (!await requireAttendant()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const replies = await prisma.quickReply.findMany({ orderBy: { title: "asc" }, select });
  return NextResponse.json({ replies }, { headers: noStore });
}

export async function POST(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = fields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    const reply = await prisma.quickReply.create({ data: { ...parsed.data, createdByUserId: session.user.id }, select });
    return NextResponse.json(reply, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "duplicate_title" }, { status: 409 });
    throw error;
  }
}

export async function PATCH(request: Request) {
  if (!await requireAttendant()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = update.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { id, ...data } = parsed.data;
  try {
    return NextResponse.json(await prisma.quickReply.update({ where: { id }, data, select }));
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "duplicate_title" }, { status: 409 });
    if (isMissing(error)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    throw error;
  }
}

export async function DELETE(request: Request) {
  if (!await requireAttendant()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { count } = await prisma.quickReply.deleteMany({ where: { id } });
  return count ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
