# Changelog 0032: Infrastructure and Development Improvements

**Date**: November 3, 2025  
**Type**: Infrastructure Improvement  
**Impact**: Medium - Improves development workflow, deployment, and cross-platform compatibility

## Overview

This update includes several infrastructure and development workflow improvements: PostgreSQL 18+ compatibility in Docker Compose, development host configuration for localcan.dev, cookie domain fixes for non-localhost environments, enhanced release workflow with Docker Hub publishing, and platform-aware build system with OS detection.

## Features Added

### 1. PostgreSQL 18+ Docker Compose Compatibility

**Changes**: Updated `docker-compose.yml` to support PostgreSQL 18+ volume mount structure

**Problem**: PostgreSQL 18+ changed its data directory structure to support version-specific subdirectories (e.g., `/var/lib/postgresql/18/data`) for better major version upgrades using `pg_upgrade --link`.

**Solution**:
- Changed volume mount from `/var/lib/postgresql/data` to `/var/lib/postgresql`
- Added healthcheck to verify database readiness
- Container now automatically creates version-specific data directory

**Benefits**:
- Fixes restart loop issues with PostgreSQL 18+
- Supports future major version upgrades using `pg_upgrade --link`
- Better health monitoring with automatic healthchecks

**Configuration**:
```yaml
services:
  postgres:
    image: postgres:18
    volumes:
      - postgres_data:/var/lib/postgresql  # Changed from /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paideia"]
      interval: 5s
      timeout: 5s
      retries: 10
```

### 2. Development Host Configuration

**Changes**: Added support for localcan.dev development domains in Vite configuration

**Features**:
- Wildcard support for all `*.localcan.dev` subdomains
- Allows development with local tunneling services (like localcan.dev)
- No need to add individual subdomains manually

**Configuration**:
```typescript
// vite.config.mts
server: {
  allowedHosts: [".localcan.dev"],
}
```

### 3. Cookie Domain and Security Fixes

**Changes**: Fixed cookie handling for non-localhost domains

**Problems Fixed**:
- Cookies were not being set for non-localhost domains
- Domain extraction was incorrect (using full URLs instead of domain names)
- Secure flag was always true, preventing cookies in HTTP development environments

**Solutions**:

**Domain Extraction**:
- Properly extracts hostname from origin headers
- For subdomains (e.g., `paideia-13.localcan.dev`), sets domain to `.localcan.dev` (with leading dot for subdomain sharing)
- For localhost, omits domain entirely (as required by browsers)
- For regular domains, uses the domain name directly

**Secure Flag Logic**:
- Only uses secure flag when HTTPS is available
- Allows non-secure cookies for development domains (localhost, 127.0.0.1, `.localcan.dev`)
- Requires HTTPS for production domains

**Implementation**:
```typescript
// New helper functions in app/utils/cookie.ts
function getCookieDomain(domainUrl: string, headers: Headers): string
function shouldUseSecureCookie(domainUrl: string, headers: Headers): boolean
```

**Affected Functions**:
- `setCookie()` - Authentication token cookies
- `removeCookie()` - Cookie removal
- `setImpersonationCookie()` - Impersonation cookies
- `removeImpersonationCookie()` - Impersonation cookie removal

**Benefits**:
- Login works correctly on non-localhost domains
- Cookies work across subdomains (e.g., all `*.localcan.dev` subdomains)
- Development-friendly (works with HTTP in development)
- Production-secure (requires HTTPS in production)

### 4. Enhanced Release Workflow

**Changes**: Improved GitHub Actions release workflow with Docker Hub publishing

**Features Added**:

**Docker Hub Publishing**:
- Automatically publishes to both GitHub Container Registry and Docker Hub
- Uses Docker Hub username from secrets (no hardcoded organization)
- Supports version tags and `latest` tag on both registries

**Docker Image Existence Check**:
- Checks if Docker image already exists before building
- Skips build if image with same version tag already exists
- Saves CI/CD time and resources

**Multi-Platform Binary Support**:
- Builds binaries for macOS ARM64, Linux ARM64, Linux x64, and Windows x64
- Platform-aware building (builds for current platform locally, all platforms in CI)
- Conditional building via `BUILD_ALL_PLATFORMS` environment variable

**Release Notes Integration**:
- Automatically includes release notes from `release-notes/` directory
- Finds release notes file matching version pattern
- Falls back to placeholder if release notes not found

**Configuration**:
```yaml
# Builds for all platforms when BUILD_ALL_PLATFORMS=true
env:
  BUILD_ALL_PLATFORMS: true

# Docker Hub tags use authenticated username
tags: |
  ghcr.io/paideia-lms/paideia:v${VERSION}
  ghcr.io/paideia-lms/paideia:latest
  ${DOCKERHUB_USERNAME}/paideia:v${VERSION}
  ${DOCKERHUB_USERNAME}/paideia:latest
```

### 5. Platform-Aware Build System

**Changes**: Added OS detection and platform-aware binary building

**Features Added**:

**OS Information Logging**:
- Logs platform, architecture, hostname, CPU model, memory, and uptime
- Helps with debugging and identifying build environment
- Visible at start of each build

**Platform Detection**:
- Automatically detects current platform and architecture
- Maps to appropriate Bun build target:
  - macOS ARM64 → `bun-darwin-arm64`
  - macOS x64 → `bun-darwin-x64`
  - Linux ARM64 → `bun-linux-arm64`
  - Linux x64 → `bun-linux-x64`
  - Windows x64 → `bun-windows-x64`

**Conditional Building**:
- Local builds: Builds only for current platform
- CI builds: Builds for all supported platforms (when `BUILD_ALL_PLATFORMS=true`)
- Saves time during local development
- Ensures all platforms are built in CI

**Implementation**:
```typescript
// scripts/build.ts
function getBuildTarget(): { target: string; outfile: string }

// OS information logged at build start
console.log("🖥️  OS Information:");
console.log(`   Platform: ${platform}`);
console.log(`   Architecture: ${arch}`);
// ... more details
```

**Build Modes**:
```bash
# Local build (current platform only)
bun run build

# CI build (all platforms)
BUILD_ALL_PLATFORMS=true bun run build
```

**Benefits**:
- Faster local builds (only builds for current platform)
- Automatic platform detection (no manual configuration)
- Consistent CI builds (all platforms built automatically)
- Better debugging with OS information

## Technical Details

### PostgreSQL 18+ Volume Mount

**Before**:
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

**After**:
```yaml
volumes:
  - postgres_data:/var/lib/postgresql
```

**Why**: PostgreSQL 18+ uses version-specific subdirectories (`/var/lib/postgresql/18/data`) to support safe major version upgrades. Mounting the parent directory allows the container to create these subdirectories automatically.

### Cookie Domain Extraction

**Before**:
```typescript
const origin = headers.get("Origin");
const domain = origin ? origin : url.hostname; // Could be full URL
domain: isLocalhost ? "" : domain, // Could be invalid URL
```

**After**:
```typescript
function getCookieDomain(domainUrl: string, headers: Headers): string {
  // Properly extracts hostname from origin
  // For subdomains: "paideia-13.localcan.dev" → ".localcan.dev"
  // For localhost: "" (omitted)
}
```

### Build System Platform Detection

**Before**: Always built both macOS and Linux binaries regardless of platform

**After**: 
- Detects current platform
- Builds only for current platform locally
- Builds for all platforms in CI when `BUILD_ALL_PLATFORMS=true`

## Migration Guide

### PostgreSQL 18+ Upgrade

If you have existing data in the old volume structure:

1. **Stop services**:
   ```bash
   docker compose down
   ```

2. **Migrate data** (if needed):
   ```bash
   docker run --rm \
     -v <project_name>_postgres_data:/var/lib/postgresql \
     postgres:18 \
     sh -c "mkdir -p /var/lib/postgresql/18 && mv /var/lib/postgresql/data/* /var/lib/postgresql/18/data/ 2>/dev/null || true && chown -R 999:999 /var/lib/postgresql/18"
   ```

3. **Restart services**:
   ```bash
   docker compose up -d
   ```

**Note**: If you're starting fresh, no migration needed - just update `docker-compose.yml` and restart.

### Cookie Configuration

No manual migration needed. The changes are automatic and backward compatible:

- Localhost continues to work (domain omitted)
- Non-localhost domains now work correctly
- Subdomain sharing works automatically (e.g., `.localcan.dev`)

### Build System

No changes needed for existing workflows:

- Local builds automatically detect platform
- CI builds use `BUILD_ALL_PLATFORMS=true` environment variable
- Existing build scripts continue to work

## Breaking Changes

None. All changes are backward compatible.

## Bug Fixes

1. **PostgreSQL 18+ restart loop**: Fixed by updating volume mount path
2. **Cookie not setting on non-localhost**: Fixed by proper domain extraction and secure flag logic
3. **Docker Hub push failures**: Fixed by using authenticated username instead of hardcoded organization
4. **Build failures on unsupported platforms**: Fixed by platform detection and conditional building

## Dependencies

No new dependencies added.

## Testing

- ✅ PostgreSQL 18+ starts correctly with new volume mount
- ✅ Cookies set correctly on localhost and non-localhost domains
- ✅ Cookies work across subdomains (e.g., all `*.localcan.dev` subdomains)
- ✅ Build system detects platform correctly
- ✅ CI builds all platforms when `BUILD_ALL_PLATFORMS=true`
- ✅ Docker Hub publishing works with authenticated username
- ✅ Release notes integrated into GitHub releases

## Future Enhancements

- Support for additional platforms (e.g., Linux ARM32)
- Option to specify build targets manually
- Enhanced cookie domain configuration
- PostgreSQL major version upgrade automation

## References

- [PostgreSQL 18+ Docker Image Changes](https://github.com/docker-library/postgres/pull/1259)
- [Cookie Domain Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [Bun Cross-Compilation Documentation](https://bun.com/docs/bundler/executables#cross-compile-to-other-platforms)

