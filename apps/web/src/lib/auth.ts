import { twoFactor } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "db";

const PLACEHOLDER_SECRETS = new Set([
  "change-me-32-chars-minimum-please",
  "REPLACE_ME"
]);

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret) throw new Error("Missing env: BETTER_AUTH_SECRET");
if (PLACEHOLDER_SECRETS.has(secret)) {
  throw new Error(
    "BETTER_AUTH_SECRET is still set to the .env.example placeholder. Generate a real secret (e.g. `openssl rand -base64 32`)."
  );
}
if (secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be at least 32 characters long.");
}
if (!baseURL) throw new Error("Missing env: BETTER_AUTH_URL");

export const auth = betterAuth({
  plugins: [twoFactor({ issuer: "Bravy Lives" })],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    additionalFields: {
      role: { type: "string", required: false, input: false }
    }
  },
  // Accounts are provisioned only through trusted server code, never public signup.
  emailAndPassword: { enabled: true, autoSignIn: true, disableSignUp: true },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24
  },
  secret,
  baseURL,
  trustedOrigins: [baseURL]
});

export type Session = typeof auth.$Infer.Session;
