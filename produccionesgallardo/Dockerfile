# syntax=docker/dockerfile:1
# Imagen multi-etapa: deps → builder (también usada para migraciones) → runner (mínima).

FROM node:22-alpine AS base
# node:22-alpine ya incluye libssl3, que es lo que necesita el motor de Prisma (linux-musl-openssl-3.0.x)
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Compila la app. Esta etapa conserva todas las dependencias y el código fuente,
# por eso el servicio "migrate" la reutiliza para `prisma migrate deploy` y la semilla.
FROM deps AS builder
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
