# Multi-stage Dockerfile for OpenSpec UI
#
#   docker build -t openspec-ui .
#   docker run -p 3000:3000 -v ~/code:/repos openspec-ui
#
# Repos mounted under /repos are found automatically. To use a fixed list
# instead, mount a config file as /repos/openspec-ui.json or point
# OPENSPEC_UI_CONFIG at it.

# Stage 1: Node builder - Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Rust builder - Build backend
# Current dependencies need Rust >= 1.85; track the latest stable on the same
# Debian release as the runtime image.
FROM rust:1-slim-bookworm AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files (Cargo.lock is optional), the build script and the
# version it stamps into the binary
COPY VERSION ./VERSION
COPY backend/Cargo.* backend/build.rs ./backend/

# Create a dummy main.rs to cache dependencies
RUN mkdir -p backend/src && \
    echo "fn main() {}" > backend/src/main.rs

# Build dependencies
WORKDIR /app/backend
RUN cargo build --release && \
    rm -rf src

# Copy actual backend source
COPY backend/src ./src

# Copy frontend assets for embedding
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Build backend
RUN touch src/main.rs && \
    cargo build --release

# Stage 3: Runtime - Copy artifacts and run
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies (wget is used by the health check)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 openspec

# Copy backend binary from builder (the frontend is embedded in it)
COPY --from=backend-builder /app/backend/target/release/openspec-ui /app/openspec-ui

# Mount repos here; openspec-ui searches this folder on start
RUN mkdir -p /repos && chown openspec:openspec /repos
WORKDIR /repos

# Switch to non-root user
USER openspec

# Listen on all interfaces inside the container (the host decides what to
# publish with -p), on a fixed port, and never try to open a browser.
ENV OPENSPEC_UI_HOST=0.0.0.0 \
    PORT=3000 \
    OPENSPEC_UI_NO_OPEN=1

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Run the application
CMD ["/app/openspec-ui"]
