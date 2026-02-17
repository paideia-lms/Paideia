# Debug Logging Utility

**Date:** 2025-01-15  
**Type:** Infrastructure, Developer Experience  
**Impact:** Low - Internal development tool, no user-facing changes

## Overview

This update introduces a centralized debug logging utility that replaces ad-hoc `console.log` statements throughout the codebase. The utility provides a controlled way to enable debug logging during development while ensuring that debug logs are completely disabled in production environments for security and performance reasons.

## Problem Statement

The codebase had scattered `console.log` statements used for debugging, particularly in the quiz submission management code. These debug logs had several issues:

- **No Control**: Debug logs were always active, cluttering console output
- **Production Risk**: No mechanism to ensure debug logs are disabled in production
- **Inconsistent Format**: Each developer used different logging formats
- **No Centralized Management**: No way to enable/disable debug logging globally

## Solution

A new debug logging utility (`server/utils/debug.ts`) was created that:
- Only logs when `NODE_ENV === "development"` AND `DEBUG_LOGS` environment variable is enabled
- Completely ignores debug logs in production (even if `DEBUG_LOGS` is set)
- Provides a consistent logging format with prefixes
- Allows developers to enable/disable debug logging via environment variable

## Key Changes

### 1. New Debug Utility

**File:** `server/utils/debug.ts` (new)

Created a centralized debug logging function:

```typescript
export function debugLog(prefix: string, data?: unknown): void {
	// Early return: completely ignore debug logs in production
	if (process.env.NODE_ENV !== "development") {
		return;
	}

	// Only check DEBUG_LOGS flag in development mode
	if (!envVars.DEBUG_LOGS.enabled) {
		return;
	}

	// Log the debug message
	if (data !== undefined) {
		console.log(`[${prefix}]`, data);
	} else {
		console.log(`[${prefix}]`);
	}
}
```

**Key Features:**
- Early return in production ensures `DEBUG_LOGS` is never evaluated outside development
- Consistent format: `[prefix]` followed by data
- Type-safe with optional data parameter
- Zero overhead in production (function returns immediately)

### 2. Environment Variable Configuration

**File:** `server/env.ts`

Added `DEBUG_LOGS` environment variable following the same pattern as `SANDBOX_MODE`:

```typescript
DEBUG_LOGS: {
	required: false,
	sensitive: false,
	value: process.env.DEBUG_LOGS,
	default: "0",
	get enabled() {
		const val = this.value ?? this.default;
		return val === "1" || val === "true";
	},
},
```

**Usage:**
- Set `DEBUG_LOGS=1` or `DEBUG_LOGS=true` in `.env` to enable debug logs
- Defaults to disabled (`"0"`)
- Only has effect in development mode

### 3. Replaced Console.log Statements

**File:** `server/internal/quiz-submission-management.ts`

Replaced all 7 `console.log` debug statements with `debugLog` calls:

**Before:**
```typescript
console.log("[tryFlagQuizQuestion] Debug:", {
	submissionId,
	questionId,
	// ... data
});
```

**After:**
```typescript
debugLog("tryFlagQuizQuestion Debug", {
	submissionId,
	questionId,
	// ... data
});
```

**Replaced Logs:**
- `tryFlagQuizQuestion Debug` - Initial state logging
- `tryFlagQuizQuestion Updated array` - Array update logging
- `tryFlagQuizQuestion About to update with` - Pre-update logging
- `tryFlagQuizQuestion Update error` - Error logging in catch block
- `tryUnflagQuizQuestion Debug` - Initial state logging
- `tryUnflagQuizQuestion Found index` - Index finding logging
- `tryUnflagQuizQuestion Updated array` - Array update logging

## Technical Details

### Security Considerations

The debug utility is designed with security in mind:

1. **Production Safety**: The function checks `NODE_ENV` first and returns immediately if not in development mode. This ensures:
   - `DEBUG_LOGS` environment variable is never evaluated in production
   - Even if someone accidentally sets `DEBUG_LOGS=1` in production, it has no effect
   - No performance overhead from checking the flag in production

2. **Early Return Pattern**: The early return pattern ensures minimal code execution in production:
   ```typescript
   if (process.env.NODE_ENV !== "development") {
       return; // Fast exit, no further evaluation
   }
   ```

3. **No Sensitive Data Exposure**: While the utility doesn't filter sensitive data, developers should be mindful not to log sensitive information. The utility is only active in development mode where this is less of a concern.

### Performance Impact

- **Production**: Zero overhead - function returns immediately on first check
- **Development (disabled)**: Minimal overhead - two simple checks before returning
- **Development (enabled)**: Same overhead as `console.log` (which is acceptable for debugging)

### Modified Files

1. **`server/utils/debug.ts`** (new)
   - Created debug logging utility
   - Imports `envVars` from `server/env.ts`
   - Exports `debugLog` function

2. **`server/env.ts`**
   - Added `DEBUG_LOGS` environment variable configuration
   - Follows same pattern as `SANDBOX_MODE` for consistency

3. **`server/internal/quiz-submission-management.ts`**
   - Added import: `import { debugLog } from "../utils/debug";`
   - Replaced 7 `console.log` statements with `debugLog` calls
   - Maintained all existing debug information and formatting

## Usage

### Enabling Debug Logs

To enable debug logs during development:

1. Set environment variable in `.env`:
   ```bash
   DEBUG_LOGS=1
   ```

   Or:
   ```bash
   DEBUG_LOGS=true
   ```

2. Ensure `NODE_ENV=development` (default in development)

3. Debug logs will now appear in console with format:
   ```
   [prefix] { data }
   ```

### Disabling Debug Logs

- Set `DEBUG_LOGS=0` or remove the variable (defaults to disabled)
- Or simply don't set the variable

### Example Output

When enabled, debug logs appear like:
```
[tryFlagQuizQuestion Debug] {
  submissionId: 123,
  questionId: "q1",
  questionIdType: "string",
  currentFlaggedQuestions: [...],
  ...
}
```

## Testing Considerations

### Manual Testing

- [ ] Verify debug logs appear when `DEBUG_LOGS=1` and `NODE_ENV=development`
- [ ] Verify debug logs don't appear when `DEBUG_LOGS=0` in development
- [ ] Verify debug logs don't appear in production even if `DEBUG_LOGS=1`
- [ ] Test with quiz flagging/unflagging functionality to see debug output
- [ ] Verify no performance impact in production

### Edge Cases

- Debug logs with `undefined` data (should log just prefix)
- Debug logs with complex nested objects
- Debug logs in error catch blocks (already tested in quiz submission code)

## Migration Notes

### No Breaking Changes

- All changes are internal to the server codebase
- No API changes
- No database changes
- No user-facing changes

### For Developers

When adding new debug logs:
1. Use `debugLog(prefix, data)` instead of `console.log`
2. Choose descriptive prefixes (e.g., function name + action)
3. Remember that debug logs are only visible in development with `DEBUG_LOGS=1`

### Future Improvements

Potential enhancements:
1. Add log levels (debug, info, warn, error)
2. Add log filtering by prefix pattern
3. Add structured logging format (JSON)
4. Add log file output option
5. Add performance timing for operations

## Related Issues

This changelog addresses:
- Scattered `console.log` statements in quiz submission management
- Need for controlled debug logging during development
- Security concern of debug logs potentially appearing in production
- Inconsistent debug logging format across codebase

## Conclusion

The debug logging utility provides a clean, secure, and developer-friendly way to add debug logs to the codebase. It ensures that debug logs are completely disabled in production while providing an easy way to enable them during development. The early return pattern ensures zero performance overhead in production, and the consistent format makes debug logs easier to read and filter.

This utility can be used throughout the codebase to replace ad-hoc `console.log` statements, making debugging easier while maintaining production security and performance.
