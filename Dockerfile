FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Production ---
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Compiled output
COPY --from=builder /app/dist ./dist

# Prisma: schema, migrations, generated client, and config
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# prisma.config.ts imports src/config/env — needed for migrate deploy
COPY --from=builder /app/src/config/env.ts ./src/config/env.ts

EXPOSE ${PORT:-3000}

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
