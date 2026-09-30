# Production image: the API serves the prerendered web app on one origin.
#   docker build --build-arg PUBLIC_SITE_URL=https://kaufcheck.example -t kaufcheck .
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- Build ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/domain/package.json packages/domain/
RUN npm ci

COPY . .
# Public build-time values of the web app (canonical URLs, sitemap, imprint).
ARG PUBLIC_SITE_URL=http://localhost:3000
ARG VITE_IMPRINT_NAME=""
ARG VITE_IMPRINT_ADDRESS=""
ARG VITE_CONTACT_EMAIL=""
ARG VITE_ADS_PROVIDER=none
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL} \
    VITE_IMPRINT_NAME=${VITE_IMPRINT_NAME} \
    VITE_IMPRINT_ADDRESS=${VITE_IMPRINT_ADDRESS} \
    VITE_CONTACT_EMAIL=${VITE_CONTACT_EMAIL} \
    VITE_ADS_PROVIDER=${VITE_ADS_PROVIDER}
RUN npm run build

# ---------- Runtime ----------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Production dependencies of the API only (the web app is prebuilt, workspace code is bundled).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/domain/package.json packages/domain/
RUN npm ci --omit=dev --workspace @kaufcheck/api && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --chmod=755 apps/api/scripts/docker-entrypoint.sh /usr/local/bin/kaufcheck-entrypoint

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["kaufcheck-entrypoint"]
