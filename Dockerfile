# Multi-stage Dockerfile for OpenSpec UI
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
FROM rust:1.75-slim AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY backend/Cargo.toml backend/Cargo.lock ./backend/

# Create a dummy main.rs to cache dependencies
RUN mkdir -p backend/src && \
    echo "fn main() {}" > backend/src/main.rs

# Build dependencies
WORKDIR /app/backend
RUN cargo build --release && \
    rm -rf src

# Copy actual backend source
COPY backend/src ./src

# Build backend
RUN touch src/main.rs && \
    cargo build --release

# Stage 3: Runtime - Copy artifacts and run
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 openspec

# Copy backend binary from builder
COPY --from=backend-builder /app/backend/target/release/openspec-ui /app/openspec-ui

# Copy frontend assets from builder
COPY --from=frontend-builder /app/frontend/dist /app/dist

# Set ownership
RUN chown -R openspec:openspec /app

# Switch to non-root user
USER openspec

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run the application
CMD ["/app/openspec-ui"]
