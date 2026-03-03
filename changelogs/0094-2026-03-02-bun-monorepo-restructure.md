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

### Modified Files
- `.github/workflows/release.yml` - Paths updated to `apps/paideia`
- `README.md` - Paths and instructions updated for monorepo
- `.gitignore` - Monorepo layout
- `apps/paideia/server/index.ts` - Migration check, seed failure handling
- `apps/paideia/app/utils/error.ts` - `S3BucketNotFoundError`, `isNoSuchBucketError`, `transformError` updates
- `apps/paideia/scripts/build.ts` - Node modules path resolution for monorepo
- `apps/paideia/scripts/check-native-deps.sh` - Monorepo node_modules resolution

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

## Related Changes

This restructure builds on existing infrastructure:
- Uses existing `getMigrationStatus` and `getMigrations` from Payload
- Integrates with `prompts` for interactive confirmation
- Extends `transformError` pattern for S3 errors
- Preserves single-binary deployment from `apps/paideia`
