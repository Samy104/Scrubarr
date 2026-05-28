FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund
COPY tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs ./
COPY src ./src
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin

ENV PATH="/app/node_modules/.bin:${PATH}"
EXPOSE 8080
VOLUME ["/db"]

# Apply Prisma schema at startup (creates the sqlite db if missing), then start Next
CMD ["sh","-c","prisma db push --skip-generate && node server.js"]
