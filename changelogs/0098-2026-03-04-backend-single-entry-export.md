# Backend Single Entry Export (Phase 3)

**Date:** March 4, 2026  
**Type:** Infrastructure  
**Impact:** Medium - Simplifies backend package exports; apps now use single entry point

## Overview

Consolidates `@paideia/paideia-backend` to a single export entry. All server and payload exports previously available via subpaths (`./server`, `./payload`) are now exported from the main package entry.

## Changes

### Package Exports

- **Before:** Multiple subpath exports (`./server`, `./payload`, `./payload-types`, `./json/raw-quiz-config/v2`, `./payload-generated-schema`)
- **After:** Single export `".": "./src/index.ts"`

### Consolidated Exports in Main Index

The following were moved from `server.ts` and `payload-exports.ts` into `packages/paideia-backend/src/index.ts`:

- OpenAPI: `createOpenApiGenerator`, `createOpenApiHandler`, `createScalarDocsHtml`
- oRPC: `orpcRouter`
- Auth: `generateCookie`, `parseCookies`, `executeAuthStrategies`
- Payload types: `PayloadRequest`, `BasePayload`
- Migrations: `getMigrationStatus`, `dumpDatabase`, `migrations`
- DB utilities: `tryRunSeed`, `tryResetSandbox`
- CLI: `displayHelp`
- System: `detectSystemResources`, `getServerTimezone`

### Removed Files

- `packages/paideia-backend/src/server.ts` - merged into index
- `packages/paideia-backend/src/payload-exports.ts` - merged into index

### App Import Updates

All `apps/paideia` imports updated from subpaths to main entry:

- `server/index.ts`: `@paideia/paideia-backend/server` → `@paideia/paideia-backend`
- `server/contexts/global-context.ts`: `@paideia/paideia-backend/payload` → `@paideia/paideia-backend`
- `server/contexts/user-context.ts`: `@paideia/paideia-backend/payload` → `@paideia/paideia-backend`
- `server/utils/bun-system-resources.ts`: `@paideia/paideia-backend/server` → `@paideia/paideia-backend`
- `app/routes/admin/migrations.tsx`: `@paideia/paideia-backend/server` → `@paideia/paideia-backend`

### Other Fixes

- `server/contexts/user-module-context.ts`: Fixed `Course` import from non-existent `../payload-types` to `../types/frontend-types`

## Benefits

- Single entry point simplifies consumption
- No subpath resolution; consistent import path
- Aligns with backend separation goals from monorepo restructure
