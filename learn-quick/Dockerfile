# Learn Quick production image: the web app and the background jobs use the same image.
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# The site address is built into the pages and the security headers, so it is needed here
ARG NEXT_PUBLIC_SITE_URL
RUN test -n "$NEXT_PUBLIC_SITE_URL" || (echo "Set NEXT_PUBLIC_SITE_URL in deploy/.env" && exit 1)
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM base AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/data/storage
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 3000
# Apply database migrations, then start the site
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000 -H 0.0.0.0"]
