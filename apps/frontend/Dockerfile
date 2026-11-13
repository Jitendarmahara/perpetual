# Frontend image: Next.js is built at IMAGE-BUILD time, NOT at container start.
#
# The old deploy ran `next build` in the container's startup command on every
# boot. A Next build spikes to ~1-2 GB RAM, which was a second source of the
# VM OOM-crash. Here the heavy build happens once, during `docker build`; the
# container only runs `next start` (light).
#
# NEXT_PUBLIC_* are inlined into the CLIENT bundle at build time, so they must
# be build ARGs here, not runtime env. Build with your production URLs:
#   docker build -f apps/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.thinks.live \
#     --build-arg NEXT_PUBLIC_WS_BASE_URL=wss://ws.thinks.live \
#     -t jiten56/preps-frontend:latest .
# Build context is the REPO ROOT (same as docker/Dockerfile.service).

FROM oven/bun:1.3.14-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WS_BASE_URL=${NEXT_PUBLIC_WS_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /repo/apps/frontend
RUN bun run build

# Runtime: serve the prebuilt output only. No build => no boot-time RAM spike.
EXPOSE 3001
CMD ["bunx", "next", "start", "-p", "3001", "-H", "0.0.0.0"]
