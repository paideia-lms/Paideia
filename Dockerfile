# Runtime Dockerfile
# This image packages the pre-built Linux binary for deployment
# Build the binary first using Dockerfile.build or build-linux.ts in a Linux environment
FROM debian:bookworm-slim

# Build arguments for platform-specific binary
ARG TARGETARCH
ARG TARGETPLATFORM

# Install required runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    make \
    && rm -rf /var/lib/apt/lists/*

# Install D2 CLI for diagram rendering
RUN curl -fsSL https://d2lang.com/install.sh | sh && \
    d2 --version

# Create app directory
WORKDIR /app

# Copy the pre-built Linux binary based on architecture
# This binary should be built using Dockerfile.build or build-linux.ts in a Linux environment
# TARGETARCH will be 'arm64' or 'amd64' (x86_64)
COPY dist/paideia-linux-${TARGETARCH} /app/paideia

# Make binary executable
RUN chmod +x /app/paideia

# Expose default ports
# PORT (backend): 3001
# FRONTEND_PORT (frontend): 3000
EXPOSE 3000 3001

# Set the binary as entrypoint
ENTRYPOINT ["/app/paideia"]

# Default command (can be overridden)
CMD []

