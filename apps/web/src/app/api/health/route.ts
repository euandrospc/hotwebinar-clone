import { NextResponse } from "next/server";
import { prisma } from "db";

export async function GET() {
  let db: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  const status = db === "ok" ? 200 : 503;
  return NextResponse.json({ status: db === "ok" ? "ok" : "degraded", db }, { status });
}
