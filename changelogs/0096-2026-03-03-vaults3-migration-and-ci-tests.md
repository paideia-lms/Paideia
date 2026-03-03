# VaultS3 Migration and CI Tests

**Date:** March 3, 2026  
**Type:** Infrastructure / Developer Experience  
**Impact:** Medium - S3 storage provider change, CI test coverage added

## Overview

Migrated from MinIO to [VaultS3](https://github.com/eniz1806/VaultS3) for S3-compatible object storage. VaultS3 is a lightweight alternative (<80MB RAM) with a built-in dashboard. Also added GitHub Actions test job that runs backend tests against Docker Compose services before release builds.

## Key Features

### 1. VaultS3 as S3 Storage Provider

**Changes**:
- Replaced MinIO container with VaultS3 (`eniz1806/vaults3`) in `docker-compose.yml`
- Dashboard at `http://localhost:9000/dashboard/` (login with `paideia_s3` / `paideia_s3_secret`)
- Generic credential naming (`paideia_s3` / `paideia_s3_secret`) for future provider flexibility

**Implementation**:
- Docker Compose: `vaults3` service with `VAULTS3_ACCESS_KEY` and `VAULTS3_SECRET_KEY`
- Volumes: `vaults3_data` and `vaults3_metadata` for persistence
- Health endpoint: `/health` (VaultS3 liveness)

### 2. S3 Bucket Auto-Creation

**Changes**:
- Added `ensure-s3-bucket.ts` script that creates the bucket if it does not exist
- Health check runs `ensureBucket()` before `testS3Connection()` so startup succeeds even when the bucket is missing

**Implementation**:
- `packages/paideia-backend/scripts/ensure-s3-bucket.ts` — uses AWS SDK `CreateBucketCommand`
- `package.json` script: `ensure-bucket`
- `health-check.ts` — calls `ensureBucket()` before testing S3 connection

### 3. GitHub Actions Test Job

**Changes**:
- New `test` job in release workflow runs before `build-binaries`
- Spins up PostgreSQL and VaultS3 via Docker Compose
- Runs `test:all` from paideia-backend, gates release on test success

**CI Fix — Payload CLI Runtime**:
- Changed migrate and typegen scripts from `bunx payload` to `bun payload`
- `bunx` runs the Payload CLI with Node.js, which cannot load `.ts` config files (`ERR_UNKNOWN_FILE_EXTENSION`)
- `bun payload` uses Bun as the runtime, which natively supports TypeScript for `payload.config.ts`
- Without this fix, `migrate:fresh` failed in CI, leaving the database empty and causing `relation "users" does not exist` in tests

**Implementation**:
- Start services: `docker compose up -d --wait`
- Wait for VaultS3: curl `http://localhost:9000/health` (retry loop)
- Create bucket: `bun run --cwd packages/paideia-backend ensure-bucket`
- Run tests: `bun run --cwd packages/paideia-backend test:all`
- Shutdown: `docker compose down` (always, even on failure)

### 4. Acknowledgements

**Changes**:
- Added Acknowledgements section to README for Bun, PostgreSQL, Payload CMS, React Router, and VaultS3

## Technical Details

### Files Modified

- `docker-compose.yml` — minio → vaults3 service
- `docker-compose.paideia.yml` — S3 URLs and credentials
- `.github/workflows/release.yml` — test job, VaultS3 health check
- `contribution.md` — VaultS3 setup, env example
- `README.md` — VaultS3 access, acknowledgements
- `apps/paideia/.env.example`
- `packages/paideia-backend/.env.example`
- `packages/paideia-backend/scripts/clean-s3.ts`
- `apps/paideia/scripts/clean-s3.ts`
- `packages/paideia-backend/scripts/ensure-s3-bucket.ts`
- `packages/paideia-backend/package.json` — migrate and typegen scripts: `bunx payload` → `bun payload`
- `packages/paideia-backend/src/env.ts` — comment updates
- `packages/paideia-backend/src/payload.config.ts` — comment updates
- `packages/paideia-backend/src/utils/s3-client.ts` — comment updates
- `packages/paideia-backend/src/health-check.ts` — ensureBucket before testS3Connection

### Files Added

- `packages/paideia-backend/scripts/ensure-s3-bucket.ts`

## Migration Notes

### Credential Change

Default credentials changed from `paideia_minio` / `paideia_minio_secret` to `paideia_s3` / `paideia_s3_secret`. Update `.env` files accordingly.

### Dashboard Access

- **URL**: `http://localhost:9000/dashboard/` (not the root URL)
- **Login**: Access key `paideia_s3`, Secret key `paideia_s3_secret`

### Clean Start

For a fresh setup after removing MinIO:

```sh
docker compose down -v
docker compose up -d
```

## Testing Considerations

- CI tests run against local Docker Compose stack
- All backend tests that use database and S3 continue to work with VaultS3
- `ensure-bucket` script is idempotent (safe to run multiple times)
