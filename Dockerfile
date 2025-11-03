# Runtime Dockerfile
# This image packages the pre-built Linux ARM64 binary for deployment
# Build the binary first using Dockerfile.build or build-linux.ts in a Linux environment
FROM debian:bookworm-slim

# Install required runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy the pre-built Linux ARM64 binary
# This binary should be built using Dockerfile.build or build-linux.ts in a Linux environment
COPY dist/paideia-linux-arm64 /app/paideia

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

