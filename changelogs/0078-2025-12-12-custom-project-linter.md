# Custom Project-Specific Linter

**Date:** December 12, 2025  
**Type:** Infrastructure & Code Quality  
**Impact:** Low - Adds automated code quality checks to enforce project-specific patterns and prevent common mistakes

## Overview

This changelog documents the implementation of a custom, rule-based project linter that enforces project-specific coding patterns and prevents the use of banned code patterns in specific file globs. The linter supports both regex-based and AST-based pattern matching, providing flexibility and accuracy for different use cases.

## Features Added

### 1. Rule-Based Linter Architecture

**Features**:
- Extensible rule-based configuration system
- Support for glob patterns with negation (`!` prefix)
- Dual detection modes: regex and AST-based pattern matching
- Type-safe discriminated union for rule configuration
- Clear violation reporting with file paths and line numbers

**Implementation**:
- Created `scripts/lint-project.ts`:
  - Rule-based configuration system with `LintRule` discriminated union type
  - Glob pattern matching using Bun's native `Glob` class
  - File filtering with positive and negative glob patterns
  - Violation detection using both regex and AST methods
  - Grouped violation reporting by rule and file

**Rule Structure**:
```typescript
type LintRule =
  | {
      name: string;
      description: string;
      includes: string[]; // glob patterns, supports negation with !
      patterns: RegExp[];
      mode: "regex";
      level?: "error" | "warning"; // default: "error"
    }
  | {
      name: string;
      description: string;
      includes: string[];
      astPatterns: ASTPattern[];
      mode: "ast";
      level?: "error" | "warning"; // default: "error"
    };
```

**Benefits**:
- ✅ Extensible: Easy to add new rules without modifying core logic
- ✅ Type-safe: Discriminated union ensures correct rule configuration
- ✅ Flexible: Supports both regex and AST detection methods
- ✅ Clear reporting: Violations grouped by rule and file with line numbers

### 2. Regex-Based Pattern Matching

**Features**:
- Fast pattern detection using regular expressions
- Line and column calculation from match positions
- Support for multiple patterns per rule

**Implementation**:
- `findRegexViolations` function processes regex patterns
- Calculates line and column numbers from match indices
- Returns violations with file path, line, column, and matched text

**Benefits**:
- ✅ Fast execution for simple pattern matching
- ✅ Easy to write and maintain patterns
- ✅ Suitable for simple text-based pattern detection

### 3. AST-Based Pattern Matching

**Features**:
- Accurate pattern detection using TypeScript compiler API
- Ignores patterns in comments and strings
- Distinguishes actual code usage from other contexts
- Type-safe AST node matching

**Implementation**:
- Uses TypeScript compiler API (no additional dependencies)
- `findASTViolations` function traverses AST and matches patterns
- AST pattern matchers for specific code constructs:
  - Function calls (e.g., `createLocalReq()`)
  - Import statements (e.g., `import { createLocalReq }`)
  - Await expressions (e.g., `await payload.find()`)

**AST Pattern Matchers**:
- `createLocalReqCall`: Matches `createLocalReq()` function calls
- `createLocalReqImport`: Matches imports containing `createLocalReq`
- `awaitPayloadFind`: Matches `await payload.find()` calls
- `awaitPayloadFindById`: Matches `await payload.findById()` calls
- `parseFormDataWithFallbackCall`: Matches `parseFormDataWithFallback()` function calls
- `parseFormDataWithFallbackImport`: Matches imports containing `parseFormDataWithFallback`
- `awaitTryParseFormDataWithMediaUpload`: Matches `await tryParseFormDataWithMediaUpload()` calls
- `tryParseFormDataWithMediaUploadImport`: Matches imports containing `tryParseFormDataWithMediaUpload`

**Benefits**:
- ✅ More accurate: Only matches actual code, not comments or strings
- ✅ No false positives: Distinguishes real usage from other contexts
- ✅ Type-safe: Uses TypeScript's own AST structure
- ✅ No dependencies: Uses existing `typescript` package

### 4. Glob Pattern Support

**Features**:
- Positive glob patterns for file inclusion
- Negative glob patterns (with `!` prefix) for file exclusion
- Recursive file scanning
- Automatic filtering of TypeScript/TSX files only

**Implementation**:
- `parsePatterns` function separates positive and negative patterns
- `matchesGlob` function uses Bun's native `Glob` class
- `getMatchingFiles` function recursively scans and filters files
- Supports patterns like `app/routes/**/*.tsx` and `!app/root.tsx`

**Benefits**:
- ✅ Flexible file selection: Include/exclude specific files or directories
- ✅ Pattern-based: Uses familiar glob syntax
- ✅ Efficient: Uses Bun's native glob implementation

### 5. Warning Level Support

**Features**:
- Rules can be configured with severity levels: `"error"` or `"warning"`
- Errors fail the build and prevent commits
- Warnings are displayed but don't fail the build
- Color-coded output: red for errors, yellow for warnings
- Log level configuration to filter violations by severity

**Implementation**:
- Added `level?: "error" | "warning"` to `LintRule` type (defaults to `"error"`)
- Added `logLevel` configuration in `linter.config.ts` to control which violations are shown
- `logLevel: "error"` shows only errors
- `logLevel: "warning"` shows warnings and errors
- Uses `styleText` from `node:util` for color-coded output

**Log Level Configuration**:
- `logLevel: "error"` - Only shows errors (warnings are filtered out)
- `logLevel: "warning"` - Shows both warnings and errors
- Configured in `linter.config.ts` via `export const logLevel`
- Defaults to `"error"` if not specified

**Benefits**:
- ✅ Flexible severity levels for different rule types
- ✅ Warnings don't block development workflow
- ✅ Visual distinction between errors and warnings (red vs yellow)
- ✅ Configurable log level for different environments
- ✅ Can focus on critical issues by setting log level to "error"

### 6. Initial Linting Rules

**Error Rules**:

**Rule 1: Ban createLocalReq in routes**
- **Pattern**: Prevents use of `createLocalReq` in route files
- **Scope**: `app/routes/**/*.tsx` except `app/root.tsx`
- **Detection**: AST-based (more accurate)
- **Level**: Error (blocks commits)
- **Patterns**: Function calls and import statements

**Rule 2: Ban await payload.find/findById in routes**
- **Pattern**: Prevents direct use of `payload.find()` and `payload.findById()` in route files
- **Scope**: `app/routes/**/*.tsx` except `app/root.tsx`
- **Detection**: AST-based (more accurate)
- **Level**: Error (blocks commits)
- **Patterns**: `await payload.find()` and `await payload.findById()` calls

**Warning Rules**:

**Rule 3: Warn parseFormDataWithFallback in routes**
- **Pattern**: Warns about use of `parseFormDataWithFallback` in route files
- **Scope**: `app/routes/**/*.tsx` except `app/root.tsx`
- **Detection**: AST-based
- **Level**: Warning (doesn't block commits)
- **Patterns**: Function calls and import statements

**Rule 4: Warn tryParseFormDataWithMediaUpload in routes**
- **Pattern**: Warns about use of `tryParseFormDataWithMediaUpload` in route files
- **Scope**: `app/routes/**/*.tsx` except `app/root.tsx`
- **Detection**: AST-based
- **Level**: Warning (doesn't block commits)
- **Patterns**: `await tryParseFormDataWithMediaUpload()` calls and imports

**Rationale**:
- `createLocalReq` should only be used in `app/root.tsx` middleware
- Direct `payload.find()` calls should use internal functions instead
- `parseFormDataWithFallback` and `tryParseFormDataWithMediaUpload` should be avoided in favor of better patterns
- Enforces architectural patterns and prevents common mistakes

### 7. Configuration File Separation

**Features**:
- Linter configuration separated into `linter.config.ts` in root directory
- Type definitions remain in `scripts/lint-project.ts` for type stability
- Configuration loaded dynamically at runtime
- Clear error message if configuration file is missing

**Implementation**:
- Created `linter.config.ts` with AST pattern matchers and rules
- Types (`ASTPatternMatcher`, `ASTPattern`, `LintRule`) exported from `scripts/lint-project.ts`
- Configuration imported using `await import()` with error handling
- Supports extensibility: add new rules without modifying core linter logic

**Benefits**:
- ✅ Separation of concerns: configuration separate from implementation
- ✅ Easier to maintain and extend rules
- ✅ Type-safe configuration with discriminated unions
- ✅ Clear error messages for missing configuration

### 8. Performance Optimizations

**Features**:
- Parallel file reading for faster execution
- AST caching to avoid re-parsing files
- Set-based lookups for O(1) performance
- Single file scan with multi-rule checking
- Performance timing output

**Implementation**:
- Files read in parallel using `Promise.all()`
- AST source files cached in `Map` to reuse across rules
- File matching uses `Set` instead of `Array.includes()` for O(1) lookups
- Files scanned once, all applicable rules checked together
- Performance timing displayed at end of execution

**Performance Results**:
- **Before**: ~2.5 seconds
- **After**: ~1.8 seconds
- **Improvement**: ~28% faster

**Benefits**:
- ✅ Faster execution for better developer experience
- ✅ Reduced redundant file I/O operations
- ✅ Efficient AST parsing with caching
- ✅ Performance metrics for monitoring

### 9. Integration with Development Workflow

**Features**:
- Pre-commit hook integration via lefthook
- Standalone script execution
- Clear error reporting
- Non-zero exit code on violations

**Implementation**:
- Added `lint:project` script to `package.json`
- Added `lint-project` job to `lefthook.yml` pre-commit hook
- Violations prevent commit if found
- Clear error messages with file paths and line numbers

**Benefits**:
- ✅ Prevents violations from being committed
- ✅ Early detection of code quality issues
- ✅ Consistent enforcement across team
- ✅ Can be run manually: `bun lint:project`

## Technical Details

### File Matching Process

1. **Pattern Parsing**: Separates positive and negative glob patterns
2. **File Discovery**: Recursively scans directory for `.ts` and `.tsx` files
3. **Positive Matching**: Filters files matching positive patterns
4. **Negative Filtering**: Removes files matching negative patterns
5. **File Collection**: Collects all unique files from all rules
6. **Parallel Reading**: Reads all files in parallel for faster execution
7. **Violation Detection**: Processes each file once, checking all applicable rules together

**Performance Optimization**: Files are read in parallel and scanned once, with all applicable rules checked together for each file.

### AST Parsing Process

1. **Source File Creation**: Uses TypeScript compiler API to create source file
2. **AST Caching**: Parsed AST source files are cached to avoid re-parsing when multiple rules check the same file
3. **AST Traversal**: Recursively visits all nodes in the AST
4. **Pattern Matching**: Checks each node against AST pattern matchers
5. **Violation Collection**: Collects violations with line and column numbers
6. **Error Handling**: Falls back gracefully if AST parsing fails

**Performance Optimization**: AST parsing is cached per file, so when multiple rules check the same file, the AST is only parsed once and reused.

### Violation Reporting

Violations are grouped by:
- **Rule**: All violations for a specific rule
- **File**: All violations in a specific file
- **Line**: Each violation with its line number and code snippet

Example output:
```
❌ Lint errors found:

❌ Rule: Ban createLocalReq in routes
File: app/routes/user/notes.tsx
  Line 43: import { createLocalReq } from "server/internal/utils/internal-function-utils";
  Line 146: req: createLocalReq({

⚠️  Lint warnings found:

⚠️ Rule: Warn tryParseFormDataWithMediaUpload in routes
File: app/routes/user/note-create.tsx
  Line 21: import { tryParseFormDataWithMediaUpload } from "~/utils/upload-handler";
  Line 79: const parseResult = await tryParseFormDataWithMediaUpload({

⏱️  Linting completed in 1819.12ms (lint: 1808.42ms, print: 10.70ms)
```

**Note**: Warnings are displayed in yellow, errors in red. The linter shows performance timing at the end.

## Files Changed

### New Files
- `scripts/lint-project.ts` - Main linter script with rule-based configuration and performance optimizations
- `linter.config.ts` - Linter configuration file with AST pattern matchers and rules

### Modified Files
- `package.json` - Added `lint:project` script
- `lefthook.yml` - Added `lint-project` job to pre-commit hook

## Usage

### Running the Linter

**Manual execution**:
```bash
bun lint:project
```

**Automatic execution**:
- Runs automatically on `git commit` via lefthook pre-commit hook
- Prevents commit if violations are found
- Shows violations with file paths and line numbers

### Adding New Rules

To add a new linting rule, add a new object to the `rules` array in `linter.config.ts`:

**Regex-based rule**:
```typescript
{
  name: "Rule name",
  description: "Rule description",
  includes: ["glob/pattern/**/*.tsx", "!excluded/file.tsx"],
  mode: "regex",
  level: "error", // or "warning"
  patterns: [
    /pattern-to-match/g,
  ],
}
```

**AST-based rule**:
```typescript
{
  name: "Rule name",
  description: "Rule description",
  includes: ["glob/pattern/**/*.tsx", "!excluded/file.tsx"],
  mode: "ast",
  level: "error", // or "warning" (defaults to "error")
  astPatterns: [
    {
      name: "Pattern name",
      matcher: astPatterns.yourPatternMatcher,
    },
  ],
}
```

**Adding AST Pattern Matchers**:

First, add the pattern matcher function to `astPatterns` object in `linter.config.ts`:
```typescript
const astPatterns = {
  yourPatternMatcher: (node: ts.Node): boolean => {
    // Return true if node matches pattern
  },
};
```

Then use it in your rule's `astPatterns` array.

## Impact

### Positive Impacts

- **Code Quality**: Enforces architectural patterns and prevents common mistakes
- **Early Detection**: Catches violations before they're committed
- **Consistency**: Ensures consistent code patterns across the codebase
- **Documentation**: Rules serve as documentation of coding standards
- **Extensibility**: Easy to add new rules as patterns emerge

### Developer Experience

- **Clear Feedback**: Violations show exact file, line, and code
- **Fast Execution**: Linter runs quickly, doesn't slow down development
- **Flexible**: Supports both regex and AST modes for different use cases
- **Type-Safe**: TypeScript ensures rule configuration is correct

## Future Enhancements

Potential improvements for future iterations:
- Add rule categories/tags for better organization
- Support for auto-fixing violations where possible
- Additional severity levels (info, suggestion)
- Integration with IDE for real-time feedback
- Rule documentation and examples
- Custom error messages per rule
- Incremental linting (only check changed files)
- Rule-specific log levels

## Related Changes

This change builds upon existing infrastructure:
- Uses Bun's native `Glob` class for pattern matching
- Uses TypeScript compiler API (already in dependencies)
- Integrates with existing lefthook pre-commit hooks
- Follows project patterns for scripts and tooling

The custom linter complements existing code quality tools:
- **Biome**: Handles formatting and general linting
- **TypeScript**: Handles type checking
- **Custom Linter**: Handles project-specific patterns and architectural rules

