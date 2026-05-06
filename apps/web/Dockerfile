# Web Dockerfile (Coolify deploy)
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=development
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter db exec prisma generate
RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=production
COPY --from=builder /app /app
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter db exec prisma migrate deploy && pnpm --filter web start"]
