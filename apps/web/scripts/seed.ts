import { pathToFileURL } from "node:url";
import { prisma } from "db";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function runSeed(): Promise<void> {
  const email = must("SEED_ADMIN_EMAIL");
  const password = must("SEED_ADMIN_PASSWORD");
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  // Lazy import so auth's module-level env validation runs only when seed
  // actually executes (env vars are set by callers before runSeed()).
  const { auth } = await import("../src/lib/auth.js");

  await auth.api.signUpEmail({
    body: { email, password, name }
  });

  // Better Auth doesn't expose role at signup; set it directly.
  await prisma.user.update({
    where: { email },
    data: { role: "admin", emailVerified: true }
  });

  console.log(`Seeded admin: ${email}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeed()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
