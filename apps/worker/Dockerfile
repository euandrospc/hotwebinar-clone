FROM node:20-alpine

RUN apk add --no-cache ffmpeg curl tini openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
COPY apps/worker/package.json ./apps/worker/
# Install ALL deps (incl devDeps like prisma cli, tsx) — needed for prisma generate + tsx runtime.
# Web/scraper aren't installed (only worker + its workspace deps via pnpm-workspace inference of imports).
RUN pnpm install --frozen-lockfile --prod=false

COPY packages/db ./packages/db
COPY packages/jobs ./packages/jobs
COPY apps/worker ./apps/worker

RUN cd /repo/packages/db && pnpm exec prisma generate

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "worker", "start"]
