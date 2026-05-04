FROM node:20-alpine

RUN apk add --no-cache ffmpeg curl tini
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/jobs/package.json ./packages/jobs/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile --filter worker... --filter db... --filter jobs...

COPY packages/db ./packages/db
COPY packages/jobs ./packages/jobs
COPY apps/worker ./apps/worker

RUN pnpm --filter db generate

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "worker", "start"]
