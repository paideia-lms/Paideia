# Changelog 0026: Paideia CLI Mode

**Date**: November 1, 2025  
**Type**: Feature Enhancement  
**Impact**: High - Transforms Paideia into a dual-mode application supporting both server and CLI operations

## Overview

This update transforms Paideia from a server-only application into a dual-mode binary that can function as both a web server and a command-line interface (CLI). The implementation uses Commander.js for command parsing and execution, provides migration management through the CLI, and includes a custom ASCII logo. All CLI commands work seamlessly with compiled single binary deployments.

## Features Added

### 1. Dual-Mode Binary Architecture

**Features**:
- Single binary that can run as server or CLI
- Default behavior: runs as server when no arguments provided
- CLI commands available via `paideia <command>`
- Works with compiled single binary deployments

**Implementation**:
- Integrated Commander.js for command parsing
- Separated server startup logic from CLI command handling
- Default action runs server if no command specified

### 2. CLI Command Structure

**Main Commands**:
- `paideia` (no args) - Starts the server (default behavior)
- `paideia server` - Explicitly starts the server
- `paideia help` - Displays help information and logo
- `paideia migrate` - Database migration commands

**Migration Subcommands**:
- `paideia migrate status` - Shows migration status
- `paideia migrate up` - Runs pending migrations
- `paideia migrate down` - Rollback last batch of migrations
- `paideia migrate refresh` - Rollback all and re-run migrations
- `paideia migrate reset` - Rollback all migrations
- `paideia migrate fresh` - Drop all entities and re-run migrations from scratch
- `paideia migrate create` - Create new migration (placeholder)

### 3. ASCII Logo

**Features**:
- Custom ASCII art logo displaying "Paideia LMS"
- Shown on CLI command execution
- Included in help command output

**Implementation**:
- Created `server/utils/constants.ts` with `asciiLogo` constant
- Displays logo before migration commands and help command
- Simple text-based logo for portability

### 4. Migration Utilities for Compiled Binaries

**Features**:
- Custom migration status utility that works with compiled binaries
- Custom migrate fresh utility that works with compiled binaries
- Accepts migrations array directly instead of reading from disk
- No filesystem dependencies for compiled single binary deployments

**Implementation**:
- Created `server/utils/db/migration-status.ts` - Migration status utility
- Created `server/utils/db/migrate-fresh.ts` - Migrate fresh utility
- Both utilities accept migrations array as parameter
- Replicate Payload's functionality without disk reads

### 5. Help Command

**Features**:
- Displays ASCII logo
- Shows introduction and available commands
- Provides overview of Paideia LMS functionality

**Implementation**:
- Dedicated `help` command in Commander.js
- Calls `displayIntroduction()` function
- Exits with code 0 after displaying help

## Technical Implementation

### Commander.js Integration

**Setup**:
```typescript
import { Command } from "commander";

const program = new Command();

program
    .name("paideia")
    .description("Paideia LMS - Server and CLI application")
    .version("0.0.1");
```

**Default Action**:
- Runs server when no command provided
- Allows `paideia` to start server directly

### Server Command

```typescript
program
    .command("server")
    .description("Start the Paideia server")
    .action(async () => {
        await startServer();
    });
```

### Migration Commands

**Status Command**:
```typescript
migrateCommand
    .command("status")
    .description("Show migration status")
    .action(async () => {
        console.log(asciiLogo);
        const statuses = await getMigrationStatus({
            payload,
            migrations: migrations as MigrationType[],
        });
        if (statuses) {
            printMigrationStatus(statuses);
        }
        process.exit(0);
    });
```

**Fresh Command**:
```typescript
migrateCommand
    .command("fresh")
    .description("Drop all database entities and re-run migrations from scratch")
    .option("--force-accept-warning", "Force accept warning prompts")
    .action(async (options) => {
        console.log(asciiLogo);
        await migrateFresh({
            payload,
            migrations: migrations as MigrationType[],
            forceAcceptWarning: options.forceAcceptWarning || false,
        });
        process.exit(0);
    });
```

### Migration Utilities

**Migration Status** (`server/utils/db/migration-status.ts`):
- Accepts migrations array directly
- Checks migration table existence across adapters
- Compares provided migrations with database records
- Returns formatted status table

**Migrate Fresh** (`server/utils/db/migrate-fresh.ts`):
- Accepts migrations array directly
- Includes transaction management
- Prompts user for confirmation
- Drops database and re-runs migrations

### ASCII Logo

Created `server/utils/constants.ts`:
```typescript
export const asciiLogo = `
╔══════════════════════════════════════╗
║                                      ║
║  ██████╗ █████╗ ██╗██████╗          ║
║  ██╔══██╗██╔══██╗██║██╔══██╗         ║
║  ██████╔╝███████║██║██║  ██║         ║
║  ██╔═══╝ ██╔══██║██║██║  ██║         ║
║  ██║     ██║  ██║██║██████╔╝         ║
║  ╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝          ║
║                                      ║
║  Learning Management System         ║
║                                      ║
╚══════════════════════════════════════╝
`;
```

### Process Exit Management

**Implementation**:
- All CLI commands use `process.exit()` after completion
- Server command does not exit (runs indefinitely)
- Migration commands exit with appropriate codes:
  - `0` for success
  - `1` for errors

## Files Changed

### New Files

- `server/utils/db/migration-status.ts` - Migration status utility for CLI
- `server/utils/db/migrate-fresh.ts` - Migrate fresh utility for CLI
- `server/utils/constants.ts` - ASCII logo and constants

### Modified Files

- `server/index.ts` - Integrated Commander.js for CLI mode
- `package.json` - Added `commander` dependency

## CLI Command Reference

### Server Commands

**Start Server (Default)**:
```bash
paideia
# or
paideia server
```

**Help**:
```bash
paideia help
```

### Migration Commands

**View Migration Status**:
```bash
paideia migrate status
```

**Run Pending Migrations**:
```bash
paideia migrate up
```

**Rollback Last Batch**:
```bash
paideia migrate down
```

**Refresh Migrations**:
```bash
paideia migrate refresh
# or with force
paideia migrate refresh --force-accept-warning
```

**Reset All Migrations**:
```bash
paideia migrate reset
```

**Fresh Migration**:
```bash
paideia migrate fresh
# or with force
paideia migrate fresh --force-accept-warning
```

## Architecture Decisions

### 1. Dual-Mode Design

**Decision**: Single binary that supports both server and CLI modes

**Rationale**:
- Simplifies deployment and distribution
- Single binary contains all functionality
- Works seamlessly with Bun's compilation feature
- Reduces complexity of having separate CLI and server binaries

**Implementation**:
- Default action starts server when no arguments
- CLI commands available via Commander.js
- Process exits for CLI commands, runs indefinitely for server

### 2. Migration Utilities Without Filesystem

**Decision**: Accept migrations array directly instead of reading from disk

**Rationale**:
- Compiled single binary cannot read filesystem migrations
- Bundles migrations into binary during compilation
- Works with Payload's migration system
- Maintains compatibility with existing migrations

**Implementation**:
- Migrations imported from `src/migrations/index.ts`
- Passed directly to migration utilities
- No filesystem reads during execution

### 3. Commander.js Over Custom CLI Parser

**Decision**: Use Commander.js for command parsing

**Rationale**:
- Industry-standard CLI framework
- Rich feature set (commands, options, arguments)
- Built-in help generation
- Extensive documentation and community support

**Implementation**:
- Commander.js for command structure
- Custom action handlers for each command
- Process exit management for CLI commands

### 4. ASCII Logo Over External Library

**Decision**: Use plain ASCII string instead of external logo library

**Rationale**:
- No external dependencies
- Works with compiled binaries
- Simple and portable
- Fast rendering

**Implementation**:
- Plain string constant in `server/utils/constants.ts`
- Displayed before CLI commands
- No rendering overhead

## Best Practices for Future Development

### 1. CLI Command Structure

**When adding new CLI commands**:
- Use Commander.js command structure
- Display logo before command execution (when appropriate)
- Use `process.exit()` after command completion
- Return appropriate exit codes (0 for success, 1 for errors)

**Example**:
```typescript
program
    .command("new-command")
    .description("Description of command")
    .option("--option", "Option description")
    .action(async (options) => {
        console.log(asciiLogo); // Optional
        // Command logic
        process.exit(0); // or process.exit(1) on error
    });
```

### 2. Migration Utilities

**When creating migration utilities for CLI**:
- Accept migrations array as parameter (not filesystem)
- Works with compiled single binary deployments
- Replicate Payload's functionality without disk dependencies
- Use type-safe implementations with proper error handling

**Pattern**:
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

### 3. Process Exit Management

**For CLI commands**:
- Always exit after command completion
- Use exit code 0 for success
- Use exit code 1 for errors
- Server command should NOT exit (runs indefinitely)

**Example**:
```typescript
// CLI command - exits after completion
.action(async () => {
    // ... command logic
    process.exit(0);
});

// Server command - runs indefinitely
.action(async () => {
    await startServer(); // Does not exit
});
```

### 4. Logo Display

**When to show logo**:
- Help command - always show
- Migration commands - show before execution
- Server command - optional (usually don't show)

**Implementation**:
```typescript
console.log(asciiLogo);
console.log("Command description...");
```

### 5. Error Handling in CLI

**For CLI commands**:
- Display error messages clearly
- Exit with appropriate error codes
- Show helpful error messages with actionable solutions

**Example**:
```typescript
.action(async () => {
    try {
        // ... command logic
        process.exit(0);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
});
```

## Integration with Build System

### Compiled Binary Support

The CLI mode works seamlessly with Bun's compilation feature:

1. **Development**: Run commands directly with `bun server/index.ts <command>`
2. **Production**: Compile to single binary and run `./paideia <command>`

**Compilation**:
- All migrations bundled into binary
- Commander.js code included
- Migration utilities work without filesystem access

### Migration Bundling

Migrations are imported at build time:
```typescript
import { migrations } from "src/migrations";
```

This ensures migrations are available in compiled binary without filesystem access.

## Testing Checklist

- [x] Default behavior (no args) starts server
- [x] `paideia server` starts server
- [x] `paideia help` displays logo and help
- [x] `paideia migrate status` shows migration status
- [x] `paideia migrate up` runs pending migrations
- [x] `paideia migrate down` rolls back last batch
- [x] `paideia migrate refresh` refreshes migrations
- [x] `paideia migrate reset` resets all migrations
- [x] `paideia migrate fresh` drops and re-runs migrations
- [x] Logo displays correctly on CLI commands
- [x] Migration utilities work with compiled binary
- [x] Process exits correctly after CLI commands
- [x] Server command runs indefinitely
- [x] Error handling works correctly

## Migration Notes

No database migration needed - this is a feature addition. The CLI mode works with existing migrations and database structure. All migration commands operate on the existing migration system.

## Future Enhancements

Potential future CLI enhancements:

1. **Migration Creation**: Implement `migrate create` command (currently placeholder)
2. **Seed Command**: Add `paideia seed` for database seeding
3. **Backup Command**: Add `paideia backup` for database backups
4. **Environment Commands**: Add commands for environment variable management
5. **Health Check**: Add `paideia health` for server health checks

