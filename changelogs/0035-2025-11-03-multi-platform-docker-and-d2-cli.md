# Changelog 0035: Multi-Platform Docker Support and D2 CLI Integration

**Date**: November 3, 2025  
**Type**: Feature Enhancement  
**Impact**: Medium - Enables Docker deployment on AMD64 servers and adds D2 diagram rendering support

## Overview

This update adds multi-platform Docker support for both ARM64 and AMD64 architectures, enabling deployment on a wider range of servers including Hetzner and other AMD64-based hosting providers. This release also includes D2 CLI installation in the Docker image for diagram rendering capabilities.

## Features Added

### 1. Multi-Platform Docker Support

**Changes**: Updated Dockerfile and GitHub Actions workflow to support both `linux/arm64` and `linux/amd64` platforms

**Problem**: Docker images were only built for ARM64 architecture, causing "no matching manifest for linux/amd64" errors when pulling images on AMD64 servers (e.g., Hetzner).

**Solution**:
- Updated Dockerfile to use `TARGETARCH` build argument for platform-specific binary selection
- Updated GitHub Actions workflow to build and push multi-platform images
- Added support for both ARM64 and AMD64 architectures

**Features**:
- Multi-platform Docker builds (ARM64 and AMD64)
- Automatic platform detection during Docker build
- Platform-specific binary selection based on `TARGETARCH`
- Single Docker image manifest supporting both architectures

**Technical Details**:

**Dockerfile Changes**:
```dockerfile
# Build arguments for platform-specific binary
ARG TARGETARCH
ARG TARGETPLATFORM

# Copy the pre-built Linux binary based on architecture
# TARGETARCH will be 'arm64' or 'amd64' (x86_64)
COPY dist/paideia-linux-${TARGETARCH} /app/paideia
```

**GitHub Actions Workflow Changes**:
- Added step to download Linux X64 binary
- Added step to rename `paideia-linux-x64` to `paideia-linux-amd64` (Docker uses `amd64`)
- Updated `platforms` to include both `linux/arm64` and `linux/amd64`

**Benefits**:
- ✅ Docker images work on both ARM64 and AMD64 servers
- ✅ No more "no matching manifest" errors on AMD64 servers
- ✅ Automatic platform selection when pulling images
- ✅ Single image tag supports multiple architectures
- ✅ Better compatibility with various hosting providers

### 2. D2 CLI Installation in Docker Image

**Changes**: Added D2 CLI installation to Dockerfile for diagram rendering support

**Problem**: D2 diagrams could not be rendered in Docker containers because D2 CLI was not available.

**Solution**:
- Added `curl` to runtime dependencies
- Installed D2 CLI using official installation script
- Verified installation with version check

**Features**:
- D2 CLI available in Docker container
- Automatic architecture detection by D2 install script
- Verified installation with version check

**Technical Details**:

**Dockerfile Changes**:
```dockerfile
# Install required runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install D2 CLI for diagram rendering
RUN curl -fsSL https://d2lang.com/install.sh | sh && \
    d2 --version
```

**Benefits**:
- ✅ D2 diagrams can be rendered in Docker containers
- ✅ `isD2Available()` function works correctly in Docker
- ✅ No need for external D2 CLI installation
- ✅ Automatic architecture detection

## Technical Details

### Before (ARM64 Only)
```dockerfile
# Only ARM64 support
COPY dist/paideia-linux-arm64 /app/paideia
```

```yaml
# GitHub Actions workflow
platforms: linux/arm64
```

### After (Multi-Platform)
```dockerfile
# Platform-specific binary selection
ARG TARGETARCH
COPY dist/paideia-linux-${TARGETARCH} /app/paideia
```

```yaml
# GitHub Actions workflow
platforms: linux/arm64,linux/amd64
```

### Docker Build Process

1. **Buildx detects platform**: Automatically sets `TARGETARCH` based on build platform
2. **Binary selection**: Dockerfile copies the correct binary based on `TARGETARCH`:
   - `linux/arm64` → `TARGETARCH=arm64` → copies `dist/paideia-linux-arm64`
   - `linux/amd64` → `TARGETARCH=amd64` → copies `dist/paideia-linux-amd64`
3. **Multi-platform manifest**: Docker Buildx creates a manifest supporting both architectures
4. **Automatic selection**: When pulling, Docker automatically selects the correct platform variant

### D2 CLI Installation

1. **Install curl**: Required for downloading D2 install script
2. **Download and install**: Uses official D2 installation script from `https://d2lang.com/install.sh`
3. **Automatic detection**: Script automatically detects architecture and installs correct binary
4. **Verification**: Runs `d2 --version` to verify installation

## Migration Guide

### No Breaking Changes

This update is **backward compatible**. Existing installations will continue to work:

- ✅ ARM64 servers continue to work (no changes)
- ✅ AMD64 servers now work (previously failed)
- ✅ Docker images automatically select correct platform
- ✅ No configuration changes needed

### To Deploy on AMD64 Servers

**No changes needed** - simply pull the image:

```bash
docker pull ghcr.io/paideia-lms/paideia:latest
# or
docker pull <dockerhub-username>/paideia:latest
```

Docker will automatically select the AMD64 variant if you're on an AMD64 server.

### To Use D2 Diagrams in Docker

**No changes needed** - D2 CLI is now included in the Docker image:

```bash
# D2 CLI is available in the container
docker exec -it <container-name> d2 --version
```

The `isD2Available()` function will now return `true` in Docker containers.

## Breaking Changes

None. All changes are backward compatible.

## Bug Fixes

### Docker Pull on AMD64 Servers

**Problem**: Pulling Docker images on AMD64 servers (e.g., Hetzner) failed with "no matching manifest for linux/amd64" error.

**Root Cause**: Docker images were only built for ARM64 architecture.

**Solution**: Added multi-platform support to build images for both ARM64 and AMD64.

**Benefits**:
- ✅ Docker images now work on AMD64 servers
- ✅ No more "no matching manifest" errors
- ✅ Automatic platform selection
- ✅ Better compatibility with hosting providers

## Dependencies

- **curl**: Added to Docker runtime dependencies (for D2 CLI installation)
- **D2 CLI**: Installed via official installation script

## Testing

- ✅ Docker images build for both ARM64 and AMD64
- ✅ Docker images pull correctly on ARM64 servers
- ✅ Docker images pull correctly on AMD64 servers
- ✅ D2 CLI is available in Docker containers
- ✅ `isD2Available()` returns `true` in Docker containers
- ✅ D2 diagrams render correctly in Docker containers
- ✅ Backward compatible with existing deployments

## Future Enhancements

- Support for additional architectures (e.g., ARM32)
- Option to build platform-specific images
- D2 CLI version pinning
- Enhanced Docker build caching

## References

- [Docker Multi-Platform Builds](https://docs.docker.com/build/building/multi-platform/)
- [Docker Buildx](https://docs.docker.com/build/building/multi-platform/)
- [D2 CLI Documentation](https://d2lang.com/)

