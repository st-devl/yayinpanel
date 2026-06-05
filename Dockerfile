# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# openssl: Prisma çalışma zamanı
# sqlite3: entrypoint migration kontrolü
# libcairo2, libpango*, libgif-dev: @napi-rs/canvas (pdf-parse dep)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     openssl sqlite3 \
     libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgif7 \
  && rm -rf /var/lib/apt/lists/*

# ── bağımlılıklar ──────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

# ── builder ────────────────────────────────────────────────────────────────────
FROM deps AS builder

ENV DATABASE_URL="file:/tmp/build.db"

COPY . .
RUN npx prisma generate
RUN npm run build

# ── web (production) ───────────────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/dev.db"
ENV STORAGE_DIR="/app/storage"

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/docker-entrypoint.sh \
  && mkdir -p /app/data /app/storage

EXPOSE 3000

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]

# ── scheduler ──────────────────────────────────────────────────────────────────
FROM base AS scheduler

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/dev.db"
ENV STORAGE_DIR="/app/storage"

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scheduler.ts ./scheduler.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

CMD ["node", "--conditions=react-server", "--import", "tsx", "scheduler.ts"]
