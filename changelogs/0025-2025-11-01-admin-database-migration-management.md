# Changelog 0025: Admin Database Migration Management

**Date**: November 1, 2025  
**Type**: Feature Enhancement  
**Impact**: Medium - Adds database migration status viewing and database dump functionality for administrators

## Overview

This update adds comprehensive database migration management features to the admin interface. Administrators can now view migration status through the UI and perform database dumps directly from the web interface. The implementation includes custom migration utilities that work with compiled binaries, avoiding disk file dependencies.

## Features Added

### 1. Database Migration Status Page

**New Route**: `/admin/migrations`

**Features**:
- View all migration files and their execution status
- Display migration batch numbers
- Visual indicators (green for ran, red for not run)
- Automatic status checking on page load

**Implementation**:
- Created `server/utils/db/migration-status.ts` utility
- Replicates Payload's `migrateStatus.js` functionality without reading from disk
- Works with compiled single binary deployments
- Accepts migrations array as argument instead of reading from filesystem

### 2. Database Dump Functionality

**Features**:
- Dump database to SQL file using `pg_dump`
- Automatic version compatibility checking
- Enhanced error handling for version mismatches
- Disabled button state when `pg_dump` is not available

**Implementation**:
- Created `server/utils/db/dump.ts` utility
- Uses `DATABASE_URL` from environment variables directly
- No dependency on Payload instance
- Includes version mismatch detection and helpful error messages

### 3. CLI Dependencies Checking

**Features**:
- Check if `pg_dump` command is available
- Used by both migration status page and dump functionality
- Centralized dependency checking

**Implementation**:
- Created `server/utils/cli-dependencies-check.ts`
- Exports `isPgDumpAvailable()` function
- Reusable across multiple features

## Technical Implementation

### Migration Status Utility

Created `server/utils/db/migration-status.ts` that:

1. **Checks migration table existence**:
   - Supports PostgreSQL and SQLite adapters
   - Uses adapter-specific SQL queries
   - Gracefully handles missing tables

2. **Compares migrations**:
   - Takes migrations array as parameter (not filesystem)
   - Fetches existing migrations from database
   - Compares provided migrations with database records
   - Returns status for each migration

3. **Type-safe implementation**:
   ```typescript
   export async function getMigrationStatus({
       payload,
       migrations,
   }: {
       payload: Payload;
       migrations: Migration[];
   }): Promise<Array<{
       Name: string;
       Batch: number | null;
       Ran: string;
   }> | undefined>
   ```

### Database Dump Utility

Created `server/utils/db/dump.ts` that:

1. **Uses environment variables**:
   - Reads `DATABASE_URL` directly from `envVars`
   - No dependency on Payload adapter
   - Simpler and more portable

2. **Version mismatch handling**:
   - Detects version mismatch errors from `pg_dump`
   - Extracts server and client versions from error message
   - Provides platform-specific upgrade instructions

3. **Error messages**:
   ```typescript
   if (errorOutput.includes("server version mismatch")) {
       // Extract versions and provide helpful error message
       return {
           success: false,
           error: `pg_dump version mismatch detected. Server version: ${serverVersion}, pg_dump version: ${clientVersion}. Please install a compatible version...`
       };
   }
   ```

### Migration Page Integration

The migrations page (`app/routes/admin/migrations.tsx`) includes:

1. **Loader**:
   - Checks `pg_dump` availability
   - Fetches migration status
   - Returns both statuses and availability

2. **Action**:
   - Handles database dump requests
   - Validates admin permissions
   - Checks `pg_dump` availability before attempting dump
   - Returns success/error with file path or error message

3. **Client Action**:
   - Shows success/error notifications
   - Displays dump file path on success

4. **Hook**:
   - `useDumpPostgres()` hook for dump functionality
   - Manages fetcher state
   - Provides loading indicators

## Files Changed

### New Files

- `server/utils/db/migration-status.ts` - Migration status utility
- `server/utils/db/dump.ts` - Database dump utility
- `server/utils/cli-dependencies-check.ts` - CLI dependency checking
- `app/routes/admin/migrations.tsx` - Migration management page

### Modified Files

- `app/routes.ts` - Added migration route
- `server/contexts/global-context.ts` - Added `isAdminMigrations` to PageInfo
- `app/root.tsx` - Added migration page detection in middleware
- `app/routes/admin/index.tsx` - Added "Database migration" link
- `app/layouts/server-admin-layout.tsx` - Added migration page to Server tab
- `server/index.ts` - Added initial `isAdminMigrations: false` to pageInfo

## User Interface

### Migration Status Page

**Layout**:
- Title with "Dump Database" button (disabled when `pg_dump` unavailable)
- Informational alert about migrations and CLI usage
- Migration status table with:
  - Migration name
  - Batch number (or "-" if not run)
  - Status badge (green "Ran" or red "Not Run")

**Alert Content**:
- Explains automatic migration on server start
- Notes that migrations cannot be performed through UI
- Lists CLI commands (`paideia migrate up`, `paideia migrate fresh`)
- Shows note about `pg_dump` version compatibility when unavailable

### Dump Database Button

**Behavior**:
- Enabled only when `pg_dump` is available
- Shows loading state during dump operation
- Displays success notification with file path
- Shows error notification with helpful message

## Error Handling

### Version Mismatch Errors

When `pg_dump` version doesn't match server version, the error message includes:
- Detected server version
- Detected client version
- Platform-specific upgrade instructions:
  - macOS: `brew upgrade postgresql`
  - Debian/Ubuntu: `apt-get upgrade postgresql-client`

Example error message:
```
pg_dump version mismatch detected. Server version: 18.0, pg_dump version: 14.19. 
Please install a compatible version of PostgreSQL client tools that matches 
your server version (18.0). You may need to upgrade your pg_dump client using: 
brew upgrade postgresql (on macOS) or apt-get upgrade postgresql-client (on Debian/Ubuntu).
```

### Missing Dependencies

- Button is disabled when `pg_dump` is not available
- Alert shows note about version compatibility requirements
- Error messages clearly indicate what needs to be installed

## Best Practices for Future Development

### 1. Migration Utilities

**When creating migration utilities**:
- Accept migrations array as parameter instead of reading from disk
- Works with compiled single binary deployments
- Replicate Payload's functionality without filesystem dependencies
- Use type-safe implementations with proper error handling

**Example pattern**:
```typescript
export async function migrationUtility({
    payload,
    migrations,
}: {
    payload: Payload;
    migrations: Migration[];
}): Promise<Result> {
    // Use provided migrations array
    // Don't read from filesystem
}
```

### 2. Database Utilities

**When creating database utilities**:
- Use environment variables directly when possible
- Avoid unnecessary dependencies on Payload instance
- Provide clear error messages with actionable solutions
- Check for required CLI tools before attempting operations

**Example**:
```typescript
// Good: Direct environment variable access
const connectionString = envVars.DATABASE_URL.value;

// Avoid: Getting from adapter if not needed
const connectionString = payload.db.pool?.connectionString;
```

### 3. CLI Dependency Checking

**Centralize dependency checks**:
- Create shared utilities in `server/utils/cli-dependencies-check.ts`
- Export reusable functions for common CLI tools
- Use consistent checking pattern across features

**Example**:
```typescript
export async function isCliToolAvailable(tool: string): Promise<boolean> {
    try {
        const proc = Bun.spawn([tool, "--version"], {
            stdout: "pipe",
            stderr: "pipe",
        });
        const exitCode = await proc.exited;
        return exitCode === 0;
    } catch {
        return false;
    }
}
```

### 4. Error Messages

**Provide helpful error messages**:
- Include specific version information when available
- Provide platform-specific instructions
- Explain what action the user needs to take

**Good error message**:
```typescript
error: `pg_dump version mismatch detected. Server version: ${serverVersion}, 
pg_dump version: ${clientVersion}. Please install a compatible version...`
```

### 5. Admin Page Patterns

**When creating admin pages**:
- Add route to `app/routes.ts`
- Add pageInfo flag to `server/contexts/global-context.ts`
- Update middleware in `app/root.tsx` to detect page
- Add link in `app/routes/admin/index.tsx`
- Update `app/layouts/server-admin-layout.tsx` if needed for tab detection

**Consistent pattern**:
1. Create utility functions in `server/utils/` or `server/utils/db/`
2. Create route file in `app/routes/admin/`
3. Update all necessary routing and context files
4. Add proper error handling and user feedback

## Integration with CLI

The migration page complements the CLI commands:

- **View Status**: `paideia migrate status` (also available in UI)
- **Run Migrations**: `paideia migrate up` (CLI only)
- **Fresh Migration**: `paideia migrate fresh` (CLI only)
- **Database Dump**: Available in UI when `pg_dump` is installed

**Note**: Migration execution is CLI-only for security reasons. The UI provides status viewing and database dumps only.

## Security Considerations

### Permission Checks

- All admin pages require authenticated admin user
- Database dump requires admin role
- Migration status requires admin role

### CLI Tool Usage

- `pg_dump` is executed with proper environment variables
- Password passed via `PGPASSWORD` environment variable (not command line)
- No sensitive information exposed in error messages

## Testing Checklist

- [x] Migration status displays correctly
- [x] Migration status shows correct batch numbers
- [x] Migration status shows correct ran/not run status
- [x] Dump button disabled when `pg_dump` not available
- [x] Dump button enabled when `pg_dump` available
- [x] Dump operation completes successfully
- [x] Version mismatch error detected correctly
- [x] Helpful error message shown for version mismatch
- [x] Success notification shows dump file path
- [x] Error notification shows helpful message
- [x] Page appears in Server admin tab
- [x] Link appears in admin index page

## Migration Notes

No database migration needed - this is a feature addition. Existing migrations are unaffected. The new utilities work with existing migration files and database records.

