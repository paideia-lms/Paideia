# Bun Monorepo Restructure

**Date:** March 2, 2026  
**Type:** Infrastructure & Developer Experience  
**Impact:** High - Restructures the project as a Bun workspace monorepo, improves server startup validation, and enhances error handling for common setup issues

## Overview

This changelog documents the migration of Paideia LMS from a single-package layout to a Bun workspace monorepo. The application now lives under `apps/paideia`, with the root acting as the workspace coordinator. Additional improvements include migration checks before server startup, clearer S3 bucket error handling, and native dependency checks that work correctly in the monorepo layout.

## Features Added

### 1. Bun Workspace Monorepo

**Features**:
- Root `package.json` with `workspaces: ["apps/*"]`
- Paideia application moved to `apps/paideia`
- Root scripts delegate to `apps/paideia` via `bun run --cwd apps/paideia <script>`
- Dependencies hoisted to workspace root `node_modules`
- Single `bun install` at root installs all workspace dependencies

**Implementation**:
- Created root `package.json` with workspace configuration
- Moved `app/`, `server/`, `src/`, `tests/`, config files, and scripts into `apps/paideia`
- Updated `.gitignore` for monorepo layout
- Removed root-level `Dockerfile` and `.dockerignore` (moved to `apps/paideia`)

**Root Scripts**:
```json
{
  "build": "bun run --cwd apps/paideia build",
  "dev": "bun run --cwd apps/paideia dev",
  "start": "bun run --cwd apps/paideia start",
  "migrate:up": "bun run --cwd apps/paideia migrate:up",
  ...
}
```

**Benefits**:
- ✅ Scalable: Ready for additional apps or packages
- ✅ Shared deps: Single install, hoisted dependencies
- ✅ Consistent: Same commands from root or app directory
- ✅ CI-friendly: `bun install` at root covers all workspaces

### 2. Migration Check Before Server Start

**Features**:
- Check for pending migrations at server startup
- Interactive prompt when migrations are pending (TTY)
- Non-interactive auto-run in CI/pipe environments
- Clear exit message when user declines to run migrations
- Prevents "relation does not exist" errors from starting with an unmigrated database

**Implementation**:
- Added `getMigrationStatus` call at start of `startServer()` in `server/index.ts`
- If pending migrations exist:
  - **Interactive**: Prompt "You have N pending migration(s). Run them now before starting the server?" (default: Yes)
  - **Non-interactive**: Log and run migrations automatically
  - **User declines**: Print "Run `bun run migrate:up` to apply migrations, then start the server." and exit
**Benefits**:
- ✅ Clear feedback: Users know migrations are required before proceeding
- ✅ No ugly errors: Avoids "relation users does not exist" stack traces
- ✅ CI-safe: Non-interactive mode runs migrations automatically

### 3. S3 Bucket Not Found Error Handling

**Features**:
- Dedicated `S3BucketNotFoundError` for missing S3 bucket
- Clear, actionable error message when bucket does not exist
- Suppresses raw AWS SDK stack traces for this case
- Message includes bucket name and configuration hint (e.g. `S3_BUCKET` env var)

**Implementation**:
- Added `S3BucketNotFoundError` class in `app/utils/error.ts`
- Added `isNoSuchBucketError()` helper to detect AWS `NoSuchBucket` errors
- Updated `transformError()` to return `S3BucketNotFoundError` with message:
  - "The S3 bucket \"{bucket}\" does not exist. Please create the bucket first before using media uploads. See your S3 configuration (e.g. S3_BUCKET env var) and ensure the bucket exists in your storage provider."

**Benefits**:
- ✅ User-friendly: Clear instruction instead of AWS stack trace
- ✅ Actionable: Tells user exactly what to fix
- ✅ Consistent: Uses project error handling patterns

### 4. Seed Failure Exit with Clean Message

**Features**:
- Check seed result before continuing server startup
- Exit with formatted message when seed fails
- Special handling for `S3BucketNotFoundError` with dedicated message
- Server does not start when seed fails in development

**Implementation**:
- In `server/index.ts`, `tryRunSeed` result is checked
- If `!seedResult.ok`:
  - **S3BucketNotFoundError**: Print "❌ S3 bucket not found. Cannot proceed with seed." plus error message and "Create the bucket and try again."
  - **Other errors**: Print "❌ Seed failed: {message}"
- `process.exit(1)` in both cases

**Benefits**:
- ✅ No silent failures: Seed errors surface immediately
- ✅ Clean output: Formatted message instead of raw stack traces
- ✅ Prevents bad state: Server does not start with incomplete seed

### 5. Native Dependencies Check for Monorepo

**Features**:
- `check-native-deps.sh` resolves `node_modules` correctly in monorepo
- Build script passes workspace root `node_modules` when packages are hoisted
- Fallback logic: try `./node_modules`, then `../../node_modules` (workspace root)
- Ensures native dependency check finds packages during build

**Implementation**:
- Updated `scripts/build.ts`: Resolve `node_modules` by checking for `react` in `../../node_modules` (workspace root) vs `./node_modules`
- Updated `scripts/check-native-deps.sh`:
  - When no path passed: try `node_modules` (with `react`), then `../../node_modules`
  - Document monorepo usage in script header
  - Use resolved path for all package lookups

**Benefits**:
- ✅ Build succeeds: Native deps check finds packages at workspace root
- ✅ Flexible: Works when run from `apps/paideia` or with explicit path
- ✅ Documented: Script explains monorepo usage

## Technical Details

### Workspace Structure

```
Paideia/
├── package.json          # Workspace root, workspaces: ["apps/*"]
├── node_modules/         # Hoisted dependencies
├── apps/
│   └── paideia/          # Main application
│       ├── app/
│       ├── server/
│       ├── src/
│       ├── package.json
│       └── ...
├── changelogs/
└── ...
```

### Migration Check Flow

1. `startServer()` runs after `displayHelp()`
2. `getMigrationStatus()` returns list of migrations with `Ran: "Yes" | "No"`
3. If any `Ran: "No"`:
   - Interactive: `prompts()` asks user
   - Non-interactive: Log and run `payload.db.migrate()`
   - User declines: Exit with message
4. Migrations run before `tryRunSeed`, `tryResetSandbox`, or production logic

### Error Handling Flow for S3

1. AWS SDK throws `NoSuchBucket` during media upload (e.g. seed)
2. `transformError()` detects via `isNoSuchBucketError()`
3. Returns `S3BucketNotFoundError` with clear message (skips raw error logging)
4. Seed `Result.try` propagates error
5. `server/index.ts` catches, prints formatted message, exits

## Files Changed

### New Files
- Root `package.json` - Workspace configuration and delegating scripts
- `apps/paideia/` - Entire application (moved from root)
- `apps/paideia/tsconfig.build.json` - Build-specific tsconfig with backend path fallbacks
- `packages/paideia-backend/src/tests/errors.ts` - `TestError` fixture for backend tests

### Modified Files
- `.github/workflows/release.yml` - Paths updated to `apps/paideia`
- `tsconfig.json` - Root config; avoid catch-all `*` path (breaks npm resolution)
- `apps/paideia/tsconfig.json` - Explicit `app/*`, `server/*` paths; `@fullcalendar/core` added
- `README.md` - Paths and instructions updated for monorepo
- `.gitignore` - Monorepo layout
- `apps/paideia/server/index.ts` - Relative imports for app utils, migration check, seed failure handling
- `apps/paideia/app/utils/error.ts` - Re-exports from `@paideia/paideia-backend` (error consolidation)
- `apps/paideia/scripts/build.ts` - Node modules path resolution, backend path resolver plugin, tsconfig.build.json
- `apps/paideia/server/contexts/*.ts` - Relative imports for app/utils; envVars from @paideia/paideia-backend
- `apps/paideia/scripts/check-native-deps.sh` - Monorepo node_modules resolution
- `packages/paideia-backend/src/index.ts` - Explicit v2 exports excluding conflicting `*Args` types
- `packages/paideia-backend/package.json` - Subpath export for `./json/raw-quiz-config/v2`

### Removed from Root (Moved to apps/paideia)
- `app/`, `server/`, `src/`, `tests/`
- `Dockerfile`, `.dockerignore`
- Config files (`vite.config.mts`, `tsconfig.json`, etc.)

## Usage

### Development

From repository root:
```sh
bun dev
```

Or from app directory:
```sh
cd apps/paideia && bun dev
```

### Build

```sh
bun run build
```

### First-Time Setup

1. Run migrations when prompted at server start, or:
   ```sh
   bun run migrate:up
   ```
2. Create S3 bucket (e.g. `paideia-bucket`) and set `S3_BUCKET` in `.env`
3. Start server: `bun dev`

## Impact

### Positive Impacts

- **Monorepo**: Cleaner structure, ready for future packages
- **Startup validation**: Migration and seed errors caught early with clear messages
- **Error handling**: S3 and seed failures no longer produce confusing stack traces
- **Build**: Native deps check works correctly in workspace layout

### Developer Experience

- **Same commands**: `bun dev`, `bun run build` work from root
- **Clear errors**: Migration prompt, S3 message, seed failure message
- **Path updates**: README and CI reference `apps/paideia` consistently

### 6. Backend Package Error Consolidation and Export Fixes

**Features**:
- Error definitions consolidated in `packages/paideia-backend` as single source of truth
- App `app/utils/error.ts` re-exports from `@paideia/paideia-backend` (no local definitions)
- Resolved TypeScript duplicate export conflicts between `quiz-module-management` and `json/raw-quiz-config/v2`
- Added `TestError` fixture in backend package for tests

**Implementation**:
- **Error consolidation**: `apps/paideia/app/utils/error.ts` now re-exports all error classes and `transformError` from `@paideia/paideia-backend`
- **Duplicate exports**: Replaced `export * from "./json/raw-quiz-config/v2"` with explicit exports excluding conflicting `*Args` types (e.g. `AddPageArgs`, `AddNestedQuizArgs`) that clash with `quiz-module-management`'s internal function args
- **isolatedModules**: Split re-exports into `export type { ... }` and `export { ... }` to satisfy TS1205
- **Test fixture**: Created `packages/paideia-backend/src/tests/errors.ts` with `TestError` for `parse-media-from-html.test.ts`
- **Subpath export**: Added `"./json/raw-quiz-config/v2"` to backend package.json for consumers needing raw config types

**Benefits**:
- ✅ Single source of truth for errors in backend package
- ✅ No duplicate type definitions across app and backend
- ✅ Typecheck passes; explicit exports avoid name collisions
- ✅ Test fixtures available within package boundary

### 7. Linter Config Strict Mode Fix and tsconfig Consolidation

**Features**:
- Fixed "Function declarations are not allowed inside blocks in strict mode when targeting 'ES5'" in `linter.config.ts`
- Consolidated common tsconfig options into root `tsconfig.json`; app and backend extend with app-specific overrides

**Implementation**:
- **Strict mode fix**: In `packages/paideia-backend/linter.config.ts`, replaced function declarations inside blocks with arrow functions
- **tsconfig consolidation**: Root `tsconfig.json` holds shared options; app and backend extend with app-specific overrides

**References**: `release-notes/incidents/2026-03-03-strict-mode-function-declarations-in-blocks.md`, `.cursor/skills/linter-config-typescript/SKILL.md`

### 8. Bun Build Path Resolution for Monorepo

**Features**:
- `bun run build` in `apps/paideia` now succeeds; app bundles server entrypoint with `@paideia/paideia-backend` and workspace path aliases
- TypeScript path aliases (`app/*`, `server/*`) work at compile time but Bun.build does not fully apply tsconfig paths to workspace package sources

**Implementation**:
- **App server imports**: Switched from path aliases to relative imports in `server/` (e.g. `"app/utils/router/route-params-schema"` → `"../app/utils/router/route-params-schema"`, `"app/utils/error"` → `"../../app/utils/error"`)
- **Backend path aliases**: Added Bun build plugin in `scripts/build.ts` to resolve backend's `server/*`, `app/utils/error`, `src/*` when bundling (Bun.build tsconfig does not apply to workspace package sources)
- **tsconfig.build.json**: Build-specific tsconfig with `baseUrl` and fallback paths for app aliases
- **envVars**: `server/contexts/global-context.ts` imports `envVars` type from `@paideia/paideia-backend` (no `server/env` in app)
- **tsconfig paths**: Replaced catch-all `"*": ["./*"]` with explicit `app/*`, `server/*` mappings so npm packages (e.g. `nuqs`, `@fullcalendar/core`) resolve from node_modules

**Note**: The build plugin resolves directly into `packages/paideia-backend`; a more ideal approach would keep backend abstracted via the package boundary. This is a pragmatic workaround until Bun supports tsconfig path resolution for workspace packages.

**References**: `release-notes/incidents/2026-03-03-bun-build-path-aliases.md`, `.cursor/skills/bun-build-monorepo/SKILL.md`

## Related Changes

This restructure builds on existing infrastructure:
- Uses existing `getMigrationStatus` and `getMigrations` from Payload
- Integrates with `prompts` for interactive confirmation
- Extends `transformError` pattern for S3 errors
- Preserves single-binary deployment from `apps/paideia`
