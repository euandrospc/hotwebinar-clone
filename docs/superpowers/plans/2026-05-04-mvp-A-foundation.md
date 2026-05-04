# MVP Sub-plan A — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo packages (`packages/db`, `apps/web`), wire Better Auth + Prisma + Postgres, and ship an empty admin shell that an authenticated super-admin can log into.

**Architecture:** Next.js 15 App Router monolith for the web layer. Prisma client lives in a workspace package consumed by web (and later by `apps/worker`). Better Auth handles credentials with the Prisma adapter; one super-admin is seeded from env. Public routes (login) and private routes (dashboard) are separated via middleware.

**Tech Stack:** Next.js 15 (App Router, RSC, Server Actions), TypeScript, Prisma 5 + PostgreSQL, Better Auth 1.x, Tailwind 3 + shadcn/ui, vitest, Playwright (smoke test only), pnpm workspaces.

**Spec:** [`docs/superpowers/specs/2026-05-04-mvp-slim-design.md`](../specs/2026-05-04-mvp-slim-design.md)

**Sub-plan series:**
- **A — Foundation (this plan)** — admin login, empty dashboard
- B — Admin CRUD (wizard, list, edit) — future
- C — Lead flow + Player — future
- D — Video upload + HLS worker — future
- E — Analytics dashboard — future
- F — Deploy Coolify — future

---

## Pre-flight

The repo currently has an outdated `apps/web/` scaffold from an earlier exploration (untracked) and an unrelated `pnpm-lock.yaml` modification. Tasks below wipe and rebuild `apps/web/` and create `packages/db/` and `packages/jobs/` from scratch, matching the design spec.

The capture-phase code under `apps/scraper/` is intact and out of scope. Do not modify it.

The baseline branch commit history through `c21fb27` (the MVP design spec) must be preserved. Branch is `feat/capture-phase` — that's the working branch despite the name; later sub-plans rename or branch off as needed.

The user prefers commits per task. Each task ends with a single commit.

## File Structure

```
hotwebinar-clone/
├── packages/
│   └── db/                                NEW
│       ├── package.json
│       ├── tsconfig.json
│       ├── prisma/
│       │   └── schema.prisma             User/Session/Account/Verification only in this sub-plan
│       └── src/
│           └── index.ts                  exports prisma client + types
├── apps/
│   └── web/                              REBUILT
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── postcss.config.mjs
│       ├── components.json               shadcn config
│       ├── vitest.config.ts
│       ├── playwright.config.ts
│       ├── Dockerfile                    deferred to sub-plan F (placeholder kept simple)
│       ├── public/
│       ├── scripts/
│       │   └── seed.ts                   NEW
│       └── src/
│           ├── middleware.ts
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── globals.css
│           │   ├── (auth)/
│           │   │   └── login/
│           │   │       └── page.tsx
│           │   ├── dashboard/
│           │   │   ├── layout.tsx        AdminShell
│           │   │   └── page.tsx          empty placeholder
│           │   └── api/
│           │       ├── auth/[...all]/
│           │       │   └── route.ts
│           │       └── health/
│           │           └── route.ts
│           ├── lib/
│           │   ├── auth.ts               Better Auth instance
│           │   ├── auth-client.ts        client SDK
│           │   └── utils.ts              cn()
│           ├── components/
│           │   ├── ui/                   shadcn components (button, input, label, form, etc.)
│           │   └── admin/
│           │       ├── admin-shell.tsx
│           │       ├── sidebar.tsx
│           │       └── user-menu.tsx
│           └── test/
│               ├── lib/auth.test.ts      unit
│               └── e2e/
│                   └── login.spec.ts     Playwright smoke
└── (root) package.json                    add seed/dev/build/test scripts
```

### File responsibilities

- **`packages/db/prisma/schema.prisma`** — single source of truth for the data model. Sub-plan A only declares the Better Auth tables (`User`, `Session`, `Account`, `Verification`). Domain models (Webinar, Lead, etc.) are added in their respective sub-plans to keep migrations small and reviewable.
- **`packages/db/src/index.ts`** — exports a singleton `PrismaClient` with proper `globalThis` caching so the dev server doesn't open new connections per HMR cycle.
- **`apps/web/src/lib/auth.ts`** — server-only Better Auth instance configured with the Prisma adapter, email/password enabled, secret + base URL from env.
- **`apps/web/src/lib/auth-client.ts`** — client-side helpers (`signIn`, `signOut`, `useSession`).
- **`apps/web/src/middleware.ts`** — guards `/dashboard/**` by checking session cookie; redirects to `/login` when missing.
- **`apps/web/src/components/admin/admin-shell.tsx`** — sidebar + header layout for all `/dashboard/**` pages.
- **`apps/web/scripts/seed.ts`** — idempotent script that creates the super-admin from `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`. Runs against the local DB; Coolify pre-deploy hook in sub-plan F runs the same script on prod.

---

## Task 1: Wipe stale scaffold and bootstrap `packages/db`

**Files:**
- Delete: `apps/web/` (entire untracked scaffold)
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Wipe stale `apps/web/` so we can rebuild fresh**

```bash
rm -rf apps/web
```

- [ ] **Step 2: Create `packages/db/package.json`**

```json
{
  "name": "db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio",
    "format": "prisma format"
  },
  "dependencies": {
    "@prisma/client": "5.22.0"
  },
  "devDependencies": {
    "prisma": "5.22.0",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 3: Create `packages/db/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create `packages/db/prisma/schema.prisma` (Better Auth tables only)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("admin")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions Session[]
  accounts Account[]

  @@map("user")
}

model Session {
  id        String   @id
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id
  userId                String
  accountId             String
  providerId            String
  password              String?
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}
```

- [ ] **Step 5: Create `packages/db/src/index.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
```

- [ ] **Step 6: Install + generate**

Run from repo root:

```bash
pnpm install
pnpm --filter db generate
```

Expected: `pnpm install` succeeds; `prisma generate` writes the client into `packages/db/node_modules/.prisma/client`.

- [ ] **Step 7: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): scaffold Prisma package with Better Auth tables"
```

---

## Task 2: Postgres + initial migration

**Files:**
- Modify: `.env.example`
- Create: `.env.local` (NOT committed; user-specific)

- [ ] **Step 1: Add DB-related env vars to `.env.example`**

Append to `.env.example`:

```env
# ============ Web ============
DATABASE_URL="postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public"

# Better Auth
BETTER_AUTH_SECRET="change-me-32-chars-minimum-please"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"

# Seed admin (run pnpm seed once)
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="change-me-min-12-chars"
SEED_ADMIN_NAME="Admin"
```

- [ ] **Step 2: Run a local Postgres for development**

The repo already has `docker-compose.yml` (untracked from an earlier scaffold). Either reuse it or run a one-off container:

```bash
docker run -d \
  --name hotwebinar-pg \
  -e POSTGRES_USER=hotwebinar \
  -e POSTGRES_PASSWORD=hotwebinar \
  -e POSTGRES_DB=hotwebinar \
  -p 5432:5432 \
  postgres:16-alpine
```

The user must copy `.env.example` → `.env.local` and adjust the password. The implementer of this task verifies the connection string works but DOES NOT commit `.env.local`.

- [ ] **Step 3: Create initial migration**

```bash
DATABASE_URL="postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public" \
  pnpm --filter db prisma migrate dev --name init_better_auth
```

Expected: `packages/db/prisma/migrations/<timestamp>_init_better_auth/migration.sql` is generated containing CREATE TABLE statements for `user`, `session`, `account`, `verification`. The tables exist in the local Postgres.

- [ ] **Step 4: Verify migration committed**

```bash
ls packages/db/prisma/migrations/
```

Expected: at least one timestamped folder with a `migration.sql` inside, plus `migration_lock.toml`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/migrations packages/db/prisma/migration_lock.toml .env.example
git commit -m "feat(db): add init migration with Better Auth tables"
```

---

## Task 3: Bootstrap `apps/web` Next.js app

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/components.json`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "seed": "tsx scripts/seed.ts"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0-rc-66855b96-20241106",
    "react-dom": "19.0.0-rc-66855b96-20241106",
    "better-auth": "1.0.7",
    "db": "workspace:*",
    "zod": "3.23.8",
    "tailwindcss": "3.4.14",
    "class-variance-authority": "0.7.0",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.4",
    "lucide-react": "0.454.0",
    "@radix-ui/react-slot": "1.1.0",
    "@radix-ui/react-label": "2.1.0"
  },
  "devDependencies": {
    "@types/node": "22.7.5",
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.47",
    "typescript": "5.6.3",
    "tsx": "4.19.1",
    "eslint": "9.13.0",
    "eslint-config-next": "15.0.3",
    "vitest": "2.1.4",
    "@vitejs/plugin-react": "4.3.3",
    "@playwright/test": "1.48.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["db"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }
  }
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
};
```

- [ ] **Step 5: Create `apps/web/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: []
} satisfies Config;
```

- [ ] **Step 6: Create `apps/web/components.json` (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 7: Create `apps/web/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 8: Create `apps/web/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Create `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HotWebinar",
  description: "Webinars automáticos simulando ao vivo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Create `apps/web/src/app/page.tsx` (root marketing/redirect page — bare for now)**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
```

- [ ] **Step 11: Install + verify build**

```bash
pnpm install
pnpm --filter web typecheck
pnpm --filter web build
```

Expected: typecheck passes; build emits `.next/standalone`. (`build` will fail later if env vars are missing — for now, the bare layout + redirect page should build without env.)

- [ ] **Step 12: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): bootstrap Next.js 15 App Router with Tailwind"
```

---

## Task 4: Wire Better Auth (TDD)

**Files:**
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/auth-client.ts`
- Create: `apps/web/src/app/api/auth/[...all]/route.ts`
- Create: `apps/web/src/test/lib/auth.test.ts`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

- [ ] **Step 2: Write the failing test `apps/web/src/test/lib/auth.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";

const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];

function isolatedImport() {
  return import("@/lib/auth");
}

describe("auth instance", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long-okay";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
  });

  it("exports an auth object with handler and api", async () => {
    const { auth } = await isolatedImport();
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
  });

  it("exposes Session type via $Infer", async () => {
    const mod = await isolatedImport();
    expect(mod.auth.$Infer).toBeDefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
pnpm --filter web test src/test/lib/auth.test.ts
```

Expected: FAIL — module `@/lib/auth` not found.

- [ ] **Step 4: Implement `apps/web/src/lib/auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "db";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret) throw new Error("Missing env: BETTER_AUTH_SECRET");
if (!baseURL) throw new Error("Missing env: BETTER_AUTH_URL");

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, autoSignIn: true },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24
  },
  secret,
  baseURL
});

export type Session = typeof auth.$Infer.Session;
```

- [ ] **Step 5: Run to verify it passes**

```bash
pnpm --filter web test src/test/lib/auth.test.ts
```

Expected: 2 passing.

- [ ] **Step 6: Implement `apps/web/src/lib/auth-client.ts`**

```ts
"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

- [ ] **Step 7: Implement `apps/web/src/app/api/auth/[...all]/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
```

- [ ] **Step 8: Verify the route handler typechecks**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/lib/auth.ts apps/web/src/lib/auth-client.ts apps/web/src/app/api/auth apps/web/src/test/lib/auth.test.ts
git commit -m "feat(web): wire Better Auth with Prisma adapter"
```

---

## Task 5: Seed super-admin script (TDD)

**Files:**
- Create: `apps/web/scripts/seed.ts`
- Create: `apps/web/src/test/scripts/seed.test.ts`

- [ ] **Step 1: Write the failing test `apps/web/src/test/scripts/seed.test.ts`**

This is an integration test that connects to a real Postgres test DB. The CI/local environment must already have the `init_better_auth` migration applied. Pre-clean the `user` and `account` tables before each run.

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { runSeed } from "../../../scripts/seed";

beforeEach(async () => {
  process.env.DATABASE_URL ??= "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.BETTER_AUTH_SECRET ??= "test-secret-at-least-32-chars-long-okay";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed", () => {
  it("creates the super-admin from env", async () => {
    process.env.SEED_ADMIN_EMAIL = "admin@example.com";
    process.env.SEED_ADMIN_PASSWORD = "test-password-min-12";
    process.env.SEED_ADMIN_NAME = "Test Admin";

    await runSeed();

    const user = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
    expect(user).not.toBeNull();
    expect(user!.name).toBe("Test Admin");
    expect(user!.role).toBe("admin");

    const account = await prisma.account.findFirst({ where: { userId: user!.id, providerId: "credential" } });
    expect(account).not.toBeNull();
    expect(account!.password).toBeTruthy();
  });

  it("is idempotent (running twice does not create duplicates)", async () => {
    process.env.SEED_ADMIN_EMAIL = "admin@example.com";
    process.env.SEED_ADMIN_PASSWORD = "test-password-min-12";
    process.env.SEED_ADMIN_NAME = "Test Admin";

    await runSeed();
    await runSeed();

    const users = await prisma.user.findMany({ where: { email: "admin@example.com" } });
    expect(users).toHaveLength(1);
  });

  it("throws when required env is missing", async () => {
    delete process.env.SEED_ADMIN_EMAIL;
    await expect(runSeed()).rejects.toThrow(/SEED_ADMIN_EMAIL/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter web test src/test/scripts/seed.test.ts
```

Expected: FAIL — module `../../../scripts/seed` not found.

- [ ] **Step 3: Implement `apps/web/scripts/seed.ts`**

```ts
import { auth } from "../src/lib/auth.js";
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run to verify the seed test passes**

```bash
pnpm --filter web test src/test/scripts/seed.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Smoke run from CLI**

```bash
SEED_ADMIN_EMAIL=admin@example.com \
SEED_ADMIN_PASSWORD=change-me-min-12-chars \
SEED_ADMIN_NAME=Admin \
DATABASE_URL=postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar \
BETTER_AUTH_SECRET=test-secret-at-least-32-chars-long-okay \
BETTER_AUTH_URL=http://localhost:3000 \
  pnpm --filter web seed
```

Expected: prints `Seeded admin: admin@example.com`. Re-running prints `Admin already exists: admin@example.com`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/scripts/seed.ts apps/web/src/test/scripts/seed.test.ts
git commit -m "feat(web): add idempotent super-admin seed script"
```

---

## Task 6: Login page (TDD via Playwright smoke)

**Files:**
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/components/ui/button.tsx` (shadcn)
- Create: `apps/web/src/components/ui/input.tsx` (shadcn)
- Create: `apps/web/src/components/ui/label.tsx` (shadcn)
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/src/test/e2e/login.spec.ts`

- [ ] **Step 1: Add minimal shadcn primitives**

`apps/web/src/components/ui/button.tsx`:

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      },
      size: { default: "h-10 px-4 py-2", sm: "h-9 rounded-md px-3", lg: "h-11 rounded-md px-8", icon: "h-10 w-10" }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };
```

`apps/web/src/components/ui/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

`apps/web/src/components/ui/label.tsx`:

```tsx
"use client";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
));
Label.displayName = "Label";
```

- [ ] **Step 2: Implement `apps/web/src/app/(auth)/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      setError("Credenciais inválidas");
      return;
    }
    const target = params.get("from") ?? "/dashboard";
    router.push(target);
  }

  return (
    <main className="container mx-auto flex min-h-screen items-center justify-center py-16">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <p className="text-sm text-muted-foreground">HotWebinar admin</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Create `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
```

- [ ] **Step 4: Write the failing E2E test `apps/web/src/test/e2e/login.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "change-me-min-12-chars";

test("admin can log in and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/dashboard");
});

test("invalid credentials show an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("nope@example.com");
  await page.getByLabel("Senha").fill("wrong-password-here");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("Credenciais inválidas");
});
```

- [ ] **Step 5: Install Playwright browsers**

```bash
cd apps/web && pnpm exec playwright install chromium && cd -
```

- [ ] **Step 6: Run E2E to verify the login test fails (no `/dashboard` route yet)**

```bash
pnpm --filter web test:e2e
```

Expected: the second test ("invalid credentials") passes; the first test fails because `/dashboard` does not exist (404, not the URL we expect). That failure is fine for now — Task 7 adds the dashboard.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui apps/web/src/app/\(auth\) apps/web/playwright.config.ts apps/web/src/test/e2e
git commit -m "feat(web): add login page and Playwright smoke test"
```

---

## Task 7: Middleware guard + empty dashboard

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/dashboard/layout.tsx`
- Create: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/components/admin/admin-shell.tsx`
- Create: `apps/web/src/components/admin/sidebar.tsx`
- Create: `apps/web/src/components/admin/user-menu.tsx`

- [ ] **Step 1: Implement middleware that guards `/dashboard/**`**

`apps/web/src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const session = getSessionCookie(request);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"]
};
```

- [ ] **Step 2: Implement the admin shell components**

`apps/web/src/components/admin/sidebar.tsx`:

```tsx
import Link from "next/link";
import { LayoutDashboard, TvMinimalPlay, Video, Bolt } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/webinars", label: "Webinars", icon: TvMinimalPlay },
  { href: "/dashboard/videos", label: "Vídeos", icon: Video },
  { href: "/dashboard/settings", label: "Configurações", icon: Bolt }
];

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="px-6 py-5 text-2xl font-bold text-destructive">HotWebinar</div>
      <nav className="grid gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

`apps/web/src/components/admin/user-menu.tsx`:

```tsx
"use client";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  async function logout() {
    await signOut();
    router.push("/login");
  }
  return (
    <div className="flex items-center gap-3 border-t px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-sm font-bold text-destructive-foreground">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={logout} aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

`apps/web/src/components/admin/admin-shell.tsx`:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

export async function AdminShell({
  pathname,
  children
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <div className="flex w-60 flex-col">
        <Sidebar pathname={pathname} />
        <UserMenu name={session.user.name ?? session.user.email} email={session.user.email} />
      </div>
      <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Implement the dashboard layout + page**

`apps/web/src/app/dashboard/layout.tsx`:

```tsx
import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "/dashboard";
  return <AdminShell pathname={pathname}>{children}</AdminShell>;
}
```

`apps/web/src/app/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Bem-vindo. KPIs e funil aparecem aqui na sub-plan E.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 5: Run E2E again — both tests should pass now**

```bash
pnpm --filter web test:e2e
```

Expected: 2 passing (login success + invalid credentials).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/app/dashboard apps/web/src/components/admin
git commit -m "feat(web): add session middleware and empty dashboard shell"
```

---

## Task 8: Health endpoint

**Files:**
- Create: `apps/web/src/app/api/health/route.ts`
- Create: `apps/web/src/test/api/health.test.ts`

- [ ] **Step 1: Write the failing test `apps/web/src/test/api/health.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
});

describe("/api/health", () => {
  it("returns ok when DB is reachable", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", db: "ok" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter web test src/test/api/health.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/app/api/health/route.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter web test src/test/api/health.test.ts
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/health apps/web/src/test/api/health.test.ts
git commit -m "feat(web): add /api/health endpoint"
```

---

## Task 9: Wire root scripts + docs

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/web/Dockerfile` (placeholder; full multi-stage in sub-plan F)
- Create: `apps/web/README.md`

- [ ] **Step 1: Update root `package.json` scripts**

Replace the existing `scripts` block in `package.json` with:

```json
"scripts": {
  "dev": "pnpm --filter web dev",
  "build": "pnpm -r build",
  "test": "pnpm -r test",
  "typecheck": "pnpm -r typecheck",
  "test:e2e": "pnpm --filter web test:e2e",
  "seed": "pnpm --filter web seed",
  "db:generate": "pnpm --filter db generate",
  "db:migrate:dev": "pnpm --filter db migrate:dev",
  "db:migrate:deploy": "pnpm --filter db migrate:deploy",
  "db:studio": "pnpm --filter db studio",
  "scrape:record": "pnpm --filter scraper scrape:record",
  "scrape:replay": "pnpm --filter scraper scrape:replay",
  "scrape:crawl": "pnpm --filter scraper scrape:crawl",
  "scrape:analyze": "pnpm --filter scraper scrape:analyze",
  "scrape:all": "pnpm --filter scraper scrape:all"
}
```

- [ ] **Step 2: Add a placeholder `apps/web/Dockerfile` (full multi-stage in sub-plan F)**

```dockerfile
# Placeholder — full standalone build added in sub-plan F (Deploy Coolify).
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter db generate
RUN pnpm --filter web build
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
```

- [ ] **Step 3: Create `apps/web/README.md`**

```markdown
# web

Next.js 15 admin + public webinar app.

## Setup

```bash
pnpm install
docker run -d --name hotwebinar-pg -e POSTGRES_USER=hotwebinar -e POSTGRES_PASSWORD=hotwebinar -e POSTGRES_DB=hotwebinar -p 5432:5432 postgres:16-alpine
cp ../../.env.example ../../.env.local
# Edit .env.local — set DATABASE_URL, BETTER_AUTH_SECRET, SEED_ADMIN_*

pnpm db:migrate:dev
pnpm seed
pnpm dev
```

Open http://localhost:3000/login.

## Tests

```bash
pnpm --filter web test         # unit + integration (vitest)
pnpm --filter web test:e2e     # Playwright smoke
pnpm --filter web typecheck
```

## Sub-plans

This package is built incrementally. Sub-plan A (Foundation) ships login + empty dashboard. See `docs/superpowers/plans/2026-05-04-mvp-A-foundation.md`.
```

- [ ] **Step 4: Run the full test suite to confirm green**

```bash
pnpm -r test
pnpm -r typecheck
```

Expected: web has 3 vitest tests (auth, seed, health) passing + scraper's existing 58 still passing. typecheck across all packages clean.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/web/Dockerfile apps/web/README.md
git commit -m "chore(web): wire root scripts and Foundation README"
```

---

## Final acceptance

- [ ] **Step 1: Walk through the Definition of Done for sub-plan A**

1. `pnpm install` succeeds; lockfile updated.
2. `pnpm db:migrate:dev` creates `user`, `session`, `account`, `verification` tables.
3. `pnpm seed` creates the super-admin from env. Re-running prints "Admin already exists".
4. `pnpm dev` starts the app on `:3000`.
5. `GET /api/health` returns `{status: "ok", db: "ok"}` with HTTP 200.
6. `/login` renders the form. Invalid creds show "Credenciais inválidas". Valid creds redirect to `/dashboard`.
7. Direct visit to `/dashboard` without a session redirects to `/login?from=/dashboard`.
8. `/dashboard` renders the AdminShell (sidebar, user menu, "Dashboard" placeholder) for an authenticated admin.
9. Logout from the user menu clears the session and returns to `/login`.
10. `pnpm -r test` and `pnpm --filter web test:e2e` pass.
11. `pnpm -r typecheck` clean.
12. Capture-phase scraper code under `apps/scraper/` is unchanged.

If any item fails, file a follow-up commit before moving to sub-plan B.

- [ ] **Step 2: Final commit if anything changed during acceptance**

```bash
git status
git add -p
git commit -m "chore(web): foundation acceptance fixes"
```

---

## Self-Review (notes for the implementer)

- **Spec coverage for Foundation slice:** Login flow, session guard, admin shell, seed script, Better Auth wiring, Prisma + Postgres init migration, health endpoint. All present.
- **Out-of-scope deferred:** Domain models (Webinar, Lead, Video, etc.), wizard, public player, upload route, worker, analytics queries, Coolify Dockerfiles. Each lives in its own future sub-plan.
- **Settings page** referenced in the sidebar nav but its real form is in sub-plan B (it appears but renders an empty placeholder for now). Add a stub page in Task 7 if route 404s become noisy during dev — defer otherwise.
- **`auth.test.ts` isolation note:** Better Auth instance is module-scoped. Tests set env in `beforeEach` then dynamically import. If you ever see flaky pass/fail in test 4, switch to `vi.resetModules()` like the scraper config tests did.
- **Seed script integration test** requires a live Postgres. CI must spin one up (docker-compose service) before running. Documented in `apps/web/README.md`.
- **Better Auth role:** the spec says `role: "admin"`. `auth.api.signUpEmail` doesn't accept a role field, so the seed script updates it post-signup. Acceptable — the column has a default of `"admin"` anyway, so even if the update fails the value is correct.
- **Cookie domain:** Better Auth sets cookies on the request host. In dev (localhost:3000) this is fine. Production cookies are configured by `BETTER_AUTH_URL`.
