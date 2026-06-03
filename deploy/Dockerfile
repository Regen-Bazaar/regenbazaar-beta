# syntax=docker/dockerfile:1
# Multi-stage build for the Regen Bazaar web app (Next.js 15 standalone) in the pnpm monorepo.
# Build context = monorepo root.  Targets:
#   build   — full toolchain + deps + source; also used by the one-shot `migrate` service.
#   runtime — minimal standalone server (node apps/web/server.js).

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- build: install workspace deps (cached on manifests), then build web ----
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# Copy only manifests first so `pnpm install` is cached until deps change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/impact-engine/package.json packages/impact-engine/package.json
COPY packages/pipeline/package.json packages/pipeline/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Copy the rest of the source and build the standalone server.
COPY . .
RUN pnpm --filter web build

# ---- runtime: minimal image that serves the standalone bundle ----
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next standalone output preserves the monorepo layout (outputFileTracingRoot = repo root):
#   apps/web/server.js  + traced node_modules + packages/*  live under .next/standalone.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
USER node
CMD ["node", "apps/web/server.js"]
