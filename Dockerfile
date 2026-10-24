FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY tooling/next-eslint-glob ./tooling/next-eslint-glob
RUN npm ci --no-audit --no-fund

FROM dependencies AS tools
COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1/build npm run db:generate
CMD ["npm", "run", "db:deploy"]

FROM tools AS builder
RUN DATABASE_URL=postgresql://build:build@127.0.0.1/build npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node scripts/telegram-scheduler.mjs ./scripts/telegram-scheduler.mjs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
