FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
ARG DATABASE_URL
ARG SESSION_SECRET
ARG ODOO_URL
ARG ODOO_DB
ARG ODOO_USERNAME
ARG ODOO_API_KEY
ENV DATABASE_URL=${DATABASE_URL}
ENV SESSION_SECRET=${SESSION_SECRET}
ENV ODOO_URL=${ODOO_URL}
ENV ODOO_DB=${ODOO_DB}
ENV ODOO_USERNAME=${ODOO_USERNAME}
ENV ODOO_API_KEY=${ODOO_API_KEY}
ENV NEXT_PRIVATE_TURBOPACK=false

# Copy dependencies from deps stage and project files, then build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
# Copy runtime artifacts including source used by prisma/seed.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:deploy && npm run prisma:seed && npm run start"]
