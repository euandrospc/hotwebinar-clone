import { NextResponse } from "next/server";
import { prisma } from "db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const debugSecret = url.searchParams.get("secret");
  if (debugSecret !== process.env.BETTER_AUTH_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const newPwd = url.searchParams.get("pwd");
  if (!newPwd || newPwd.length < 8) {
    return NextResponse.json({ error: "missing_pwd" }, { status: 400 });
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER USER hotwebinar WITH PASSWORD '${newPwd.replace(/'/g, "''")}'`);
    return NextResponse.json({ ok: true, message: "password updated" });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
