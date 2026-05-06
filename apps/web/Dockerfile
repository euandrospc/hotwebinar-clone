# Web Dockerfile (Coolify deploy)
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat ca-certificates
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY . .
RUN NODE_ENV=development pnpm install --frozen-lockfile --prod=false
RUN pnpm --filter db exec prisma generate
ENV NODE_ENV=production
RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat ca-certificates tini
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=production
COPY --from=builder /app /app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "pnpm --filter db exec prisma migrate deploy && (pnpm --filter web ensure-buckets || echo '[ensure-buckets] failed, continuing') && pnpm --filter web start"]
