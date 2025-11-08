# Changelog 0037: CLI Refactoring and Cron Jobs Management

**Date**: November 8, 2025  
**Type**: Refactoring / Enhancement  
**Impact**: Medium - Improves code organization and maintainability

## Overview

Refactored CLI commands into a dedicated module and extracted cron jobs loader logic into an internal function. This improves code organization, maintainability, and follows established patterns in the codebase. Added a new sandbox reset CLI command for manual database resets.

## Features Added

### 1. CLI Commands Module

**Features**:
- Moved all CLI command definitions from `server/index.ts` to `server/cli/commands.ts`
- Centralized command configuration in `configureCommands()` function
- Exported `displayHelp()` function for reuse
- Better organization and separation of concerns

**Implementation**:
- Created `server/cli/commands.ts` with all command definitions
- `configureCommands(payload: Payload)` function returns configured Commander.js program
- All migration commands (status, up, fresh, dump) remain unchanged
- Help command updated to include new sandbox reset command

**Benefits**:
- ✅ Cleaner `server/index.ts` file (reduced from ~365 to ~226 lines)
- ✅ Better code organization
- ✅ Easier to add new CLI commands
- ✅ Commands are now in a dedicated module

### 2. Sandbox Reset CLI Command

**Features**:
- New CLI command: `paideia sandbox reset`
- Manually resets sandbox database when `SANDBOX_MODE` is enabled
- Provides clear success/error messages
- Exits with appropriate status codes

**Usage**:
```bash
# Reset sandbox database (only works when SANDBOX_MODE is enabled)
paideia sandbox reset
```

**Implementation**:
- Added `sandbox` command group to CLI
- `sandbox reset` subcommand calls `tryResetSandbox()`
- Validates sandbox mode is enabled (handled by `tryResetSandbox`)
- Shows ASCII logo and appropriate messages
- Exits with code 0 on success, 1 on failure

**Benefits**:
- ✅ Manual sandbox reset capability
- ✅ Useful for development and testing
- ✅ Consistent with other CLI commands
- ✅ Clear error messages

### 3. Cron Jobs Management Internal Function

**Features**:
- Extracted cron jobs loader logic to `server/internal/cron-jobs-management.ts`
- Created `tryGetCronJobs()` function following Result pattern
- Exported types: `CronJobInfo` and `GetCronJobsResult`
- Reusable function for getting cron jobs information

**Implementation**:
- Created `server/internal/cron-jobs-management.ts`
- `tryGetCronJobs(payload: Payload)` function:
  - Gets cron instances from `payload.crons`
  - Matches cron patterns with config to get names, types, queues
  - Maps cron instances to displayable information
  - Returns `Result<GetCronJobsResult>`
- Updated `app/routes/admin/cron-jobs.tsx` loader to use internal function
- Proper error handling using `InternalServerErrorResponse`

**Benefits**:
- ✅ Separation of concerns (business logic vs HTTP handling)
- ✅ Reusable function (can be used elsewhere)
- ✅ Testable independently
- ✅ Consistent with other internal functions
- ✅ Cleaner loader code

## Technical Implementation

### CLI Commands Structure

**Before**:
```typescript
// All commands in server/index.ts
const program = new Command();
program.command("help")...
program.command("server")...
const migrateCommand = program.command("migrate")...
// ... many more commands
```

**After**:
```typescript
// server/cli/commands.ts
export function configureCommands(payload: Payload): Command {
  const program = new Command();
  // ... all command definitions
  return program;
}

// server/index.ts
const program = configureCommands(payload);
program.command("server")... // Only server-specific commands
```

### Cron Jobs Management

**Before**:
```typescript
// app/routes/admin/cron-jobs.tsx
export const loader = async ({ context }) => {
  // ... authentication/authorization
  // ... 100+ lines of cron job mapping logic
  return { cronJobs, cronEnabled };
};
```

**After**:
```typescript
// server/internal/cron-jobs-management.ts
export const tryGetCronJobs = Result.wrap(
  async (payload: Payload): Promise<GetCronJobsResult> => {
    // ... cron job mapping logic
  }
);

// app/routes/admin/cron-jobs.tsx
export const loader = async ({ context }) => {
  // ... authentication/authorization
  const cronJobsResult = await tryGetCronJobs(payload);
  if (!cronJobsResult.ok) {
    throw new InternalServerErrorResponse(...);
  }
  return cronJobsResult.value;
};
```

## Files Changed

### New Files

1. **`server/cli/commands.ts`**
   - All CLI command definitions
   - `configureCommands()` function
   - `displayHelp()` function
   - Sandbox reset command

2. **`server/internal/cron-jobs-management.ts`**
   - `tryGetCronJobs()` function
   - `CronJobInfo` and `GetCronJobsResult` types
   - Cron job mapping logic

### Modified Files

1. **`server/index.ts`**
   - Removed all CLI command definitions
   - Imported `configureCommands` and `displayHelp` from `server/cli/commands.ts`
   - Simplified to just configure program and add server command
   - Reduced from ~365 lines to ~226 lines

2. **`app/routes/admin/cron-jobs.tsx`**
   - Removed cron job mapping logic (moved to internal function)
   - Updated loader to use `tryGetCronJobs()`
   - Added proper error handling with `InternalServerErrorResponse`
   - Loader now focuses on authentication/authorization only

## Migration Guide

### No Breaking Changes

This update is **backward compatible**. All existing functionality continues to work:

- ✅ All CLI commands work exactly as before
- ✅ Admin cron jobs page works exactly as before
- ✅ No configuration changes needed
- ✅ No API changes

### New CLI Command

**Sandbox Reset Command**:
```bash
# Reset sandbox database manually
paideia sandbox reset
```

**Note**: This command only works when `SANDBOX_MODE` is enabled. If sandbox mode is disabled, the command will exit silently (as designed by `tryResetSandbox`).

## Benefits

### Code Organization

- **Better separation of concerns**: CLI commands are now in a dedicated module
- **Cleaner main file**: `server/index.ts` is now more focused on server startup
- **Easier maintenance**: Commands are easier to find and modify
- **Consistent patterns**: Follows established patterns for internal functions

### Reusability

- **Cron jobs function**: Can be reused in other parts of the application
- **CLI commands**: Easier to add new commands in the future
- **Help function**: Can be used elsewhere if needed

### Testability

- **Internal functions**: Can be tested independently
- **CLI commands**: Can be tested separately from server startup
- **Better isolation**: Business logic separated from HTTP handling

## Testing

- ✅ All existing CLI commands work correctly
- ✅ Sandbox reset command works when `SANDBOX_MODE` is enabled
- ✅ Admin cron jobs page displays correctly
- ✅ Error handling works properly
- ✅ Help command shows all commands including sandbox reset

## Future Enhancements

- Additional sandbox commands (e.g., `sandbox status`)
- More CLI commands for common operations
- CLI command testing utilities
- Enhanced help system with command examples

## References

- Related changelog: [0036-2025-11-08-sandbox-reset-preserve-system-tables.md](./0036-2025-11-08-sandbox-reset-preserve-system-tables.md)
- Related changelog: [0026-2025-11-01-paideia-cli-mode.md](./0026-2025-11-01-paideia-cli-mode.md)

