# Changelog 0030: CLI Database Dump Command

**Date**: November 2, 2025  
**Type**: Feature Enhancement  
**Impact**: Low - Adds CLI command for database dumps and improves dump file organization

## Overview

This update adds a CLI command for database dumps (`paideia migrate dump`) and improves the organization of dump files by saving them to a dedicated `paideia_data` directory. The CLI command complements the existing UI-based dump functionality, providing administrators with flexible options for database backups.

## Features Added

### 1. CLI Database Dump Command

**New Command**: `paideia migrate dump`

**Features**:
- Dump database to SQL file from command line
- Optional custom filename via `-o` or `--output` flag
- Same version-independent Drizzle-based implementation as UI
- All dumps saved to `paideia_data/` directory
- Automatic directory creation if it doesn't exist

**Usage**:
```bash
# Dump with auto-generated filename
paideia migrate dump

# Dump with custom filename
paideia migrate dump -o my-backup.sql

# Or using long form
paideia migrate dump --output my-backup.sql
```

### 2. Dump File Organization

**Changes**:
- All database dump files now saved to `paideia_data/` directory
- Directory automatically created if it doesn't exist
- Consistent location for all Paideia-generated data files

**Implementation**:
- UI dumps automatically saved to `paideia_data/`
- CLI dumps automatically saved to `paideia_data/`
- Custom filenames treated as relative to `paideia_data/` directory

### 3. Git and Docker Ignore Updates

**Changes**:
- Added `paideia_data/` to `.gitignore`
- Added `paideia_data/` to `.dockerignore`
- Prevents accidental commit of database dumps
- Prevents including dump files in Docker builds

## Technical Implementation

### CLI Command Integration

The new command was added to the migration subcommand group in `server/index.ts`:

```typescript
migrateCommand
    .command("dump")
    .description("Dump database to SQL file")
    .option("-o, --output <path>", "Output file path (relative to paideia_data directory)")
    .action(async (options) => {
        const result = await dumpDatabase({
            payload,
            outputPath: options.output,
        });
        // Error handling and success messaging
    });
```

### Directory Management

The `dumpDatabase` function was updated to:

1. **Create directory if needed**:
   ```typescript
   const dataDir = "paideia_data";
   await mkdir(dataDir, { recursive: true });
   ```

2. **Use consistent path structure**:
   ```typescript
   const filename = outputPath || `paideia-dump-${timestamp}.sql`;
   const finalOutputPath = join(dataDir, filename);
   ```

### Help Text Updates

Added `paideia migrate dump` to the help table displayed by `paideia help` command.

## Files Changed

### Modified Files

- `server/index.ts`:
  - Added `dumpDatabase` import
  - Added `migrate dump` command to Commander.js program
  - Updated help table to include dump command

- `server/utils/db/dump.ts`:
  - Added `mkdir` and `join` imports
  - Updated to save files to `paideia_data/` directory
  - Automatic directory creation

- `.gitignore`:
  - Added `/paideia_data` to ignore database dumps

- `.dockerignore`:
  - Added `/paideia_data` to prevent including dumps in Docker builds

## Integration with Existing Features

### UI Dump Functionality

The CLI command uses the same `dumpDatabase` function as the UI:
- Same version-independent Drizzle ORM approach
- Same SQL generation logic
- Same file location (`paideia_data/`)
- Consistent behavior across CLI and UI

### Migration Commands

The dump command is grouped with other migration-related commands:
- `paideia migrate status` - View migration status
- `paideia migrate up` - Run pending migrations
- `paideia migrate fresh` - Fresh migration (drop and recreate)
- `paideia migrate dump` - **NEW** - Dump database

## Benefits

### For Administrators

1. **CLI Access**: Dump databases from command line without UI access
2. **Automation**: Can be integrated into backup scripts and cron jobs
3. **Consistency**: Same implementation as UI, ensuring reliability
4. **Organization**: All dumps in dedicated directory, easy to locate

### For Development

1. **No CLI Dependencies**: Still no requirement for `pg_dump` or other external tools
2. **Version Independence**: Works with any PostgreSQL version
3. **Clean Repository**: Dump files automatically ignored by git
4. **Docker Ready**: Dump files excluded from Docker builds

## Usage Examples

### Basic Dump

```bash
paideia migrate dump
# Output: paideia_data/paideia-dump-2025-11-02T10-30-45-123Z.sql
```

### Custom Filename

```bash
paideia migrate dump -o backup-before-update.sql
# Output: paideia_data/backup-before-update.sql
```

### In Backup Scripts

```bash
#!/bin/bash
# Daily backup script
paideia migrate dump -o daily-$(date +%Y-%m-%d).sql
# Rotate old backups, upload to S3, etc.
```

### Error Handling

```bash
paideia migrate dump
# ❌ Failed to dump database: Database connection error
# Exit code: 1

paideia migrate dump
# ✅ Database dump completed: paideia_data/paideia-dump-2025-11-02T10-30-45-123Z.sql
# Exit code: 0
```

## Best Practices

### File Organization

- **Location**: All dumps in `paideia_data/` directory
- **Naming**: Use descriptive names for custom dumps
- **Rotation**: Consider implementing backup rotation for old dumps

### Backup Strategy

1. **Regular Dumps**: Schedule regular dumps via cron or similar
2. **Before Changes**: Always dump before major migrations or updates
3. **Storage**: Move dumps to external storage (S3, etc.) for long-term retention
4. **Testing**: Test restore procedures regularly

### Security

- Dump files contain sensitive data
- Ensure `paideia_data/` directory has proper permissions
- Consider encrypting dumps before long-term storage
- Remove old dumps that are no longer needed

## Testing Checklist

- [x] CLI command appears in help (`paideia help`)
- [x] CLI command works without arguments (auto-generated filename)
- [x] CLI command works with `-o` flag (custom filename)
- [x] CLI command works with `--output` flag (custom filename)
- [x] Dump files saved to `paideia_data/` directory
- [x] Directory created automatically if missing
- [x] Error handling works correctly
- [x] Success message shows correct file path
- [x] Exit codes correct (0 for success, 1 for error)
- [x] UI dump still works (same directory)
- [x] `.gitignore` properly ignores `paideia_data/`
- [x] `.dockerignore` properly ignores `paideia_data/`

## Migration Notes

No database migration needed - this is a CLI and file organization improvement. Existing functionality remains unchanged, just with better organization.

## Related Features

This changelog extends the work done in:
- **Changelog 0025**: Admin Database Migration Management (Drizzle-based dump implementation)
- **Changelog 0026**: Paideia CLI Mode (CLI command structure)

