# OpenSpec UI container image.
#
# Default target (`docker build .`): builds everything from source. The binary
# is built for musl so the same small Alpine runtime serves both paths.
#
# Target `prebuilt` (used by the release workflow): copies the already-built,
# already-tested musl release binaries instead of compiling under QEMU:
#   docker buildx build --target prebuilt --platform linux/amd64,linux/arm64 \
#     --build-context bins=<dir containing amd64/openspec-ui and arm64/openspec-ui> .
#
# Run:  docker run -p 3000:3000 -v "$PWD":/workspace ghcr.io/toruai/openspec-ui
# (with no arguments it serves the project mounted at /workspace, i.e. /workspace/openspec)

# --- Stage 1: frontend -------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend (musl) --------------------------------------------------
FROM rust:1-alpine AS backend-builder
RUN apk add --no-cache musl-dev
WORKDIR /app
# Cargo.lock is optional (it is not committed upstream yet).
COPY backend/Cargo.toml backend/Cargo.loc[k] ./backend/
WORKDIR /app/backend
# Cache dependencies with a dummy main.
RUN mkdir -p src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY backend/src ./src
# The frontend is embedded into the binary at compile time (rust-embed).
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
RUN touch src/main.rs && cargo build --release

# --- Shared runtime base ------------------------------------------------------
FROM alpine:3.21 AS runtime-base
LABEL org.opencontainers.image.source="https://github.com/ToruAI/openspec-ui" \
      org.opencontainers.image.description="Read-only dashboard for OpenSpec changes and specs" \
      org.opencontainers.image.licenses="MIT"
# Numeric uid, no RUN: keeps multi-arch builds free of emulated steps.
WORKDIR /workspace
WORKDIR /app
COPY --chown=10001:10001 docker/openspec-ui.json /app/openspec-ui.json
COPY --chmod=755 docker/entrypoint.sh /app/entrypoint.sh
USER 10001:10001
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]

# --- Release image: prebuilt binaries ----------------------------------------
FROM runtime-base AS prebuilt
ARG TARGETARCH
COPY --from=bins --chmod=755 ${TARGETARCH}/openspec-ui /app/openspec-ui

# --- Default image: built from source (last stage = default target) ----------
FROM runtime-base AS runtime
COPY --from=backend-builder --chmod=755 /app/backend/target/release/openspec-ui /app/openspec-ui
