# Validation Error Handling Improvement

**Date:** 2026-01-17  
**Type:** Bug Fix, Infrastructure Enhancement  
**Impact:** Low - Improves error message preservation and test reliability

## Overview

This update improves validation error handling by introducing a dedicated `ValidationError` class and enhancing error message preservation in internal functions. The changes ensure that validation error messages are properly propagated through the error handling system, making debugging easier and tests more reliable.

## Problem Statement

When validation errors were thrown in collection hooks (such as the `beforeValidate` hook in the courses collection), they were being caught and transformed by internal functions, but the original error messages were being lost. This caused:

- Test failures where error message assertions couldn't find the expected validation messages
- Poor debugging experience when validation errors occurred
- Generic error messages like "Failed to update course with file" instead of specific validation messages like "End date must be after start date"

The root cause was that generic `Error` instances thrown in validation hooks were not recognized by the `transformError` function, causing them to be wrapped in `UnknownError` with a generic message, losing the original validation message.

## Key Changes

### 1. ValidationError Class

**File:** `app/utils/error.ts`

- Added new `ValidationError` class following the existing error class pattern
- Includes `static readonly type = "ValidationError"` for type identification
- Extends standard `Error` class
- Added to `transformError` function so validation errors are properly recognized

**Implementation:**
```typescript
export class ValidationError extends Error {
	static readonly type = "ValidationError";
	get type() {
		return ValidationError.type;
	}
}
```

### 2. Courses Collection Validation

**File:** `server/collections/courses.ts`

- Updated `beforeValidate` hook to throw `ValidationError` instead of generic `Error`
- Imported `ValidationError` from `app/utils/error`
- Ensures date validation errors are properly typed and recognized

**Before:**
```typescript
if (endDate <= startDate) {
	throw new Error("End date must be after start date");
}
```

**After:**
```typescript
if (endDate <= startDate) {
	throw new ValidationError("End date must be after start date");
}
```

### 3. Error Message Preservation

**File:** `server/internal/course-management.ts`

- Enhanced error handling in `tryUpdateCourse` to preserve original error messages
- When `transformError` returns `undefined`, the function now checks if the error is an `Error` instance and preserves its message
- Falls back to generic message only when error is not an `Error` instance

**Before:**
```typescript
(error) =>
	transformError(error) ??
	new UnknownError("Failed to update course with file", {
		cause: error,
	}),
```

**After:**
```typescript
(error) => {
	const transformed = transformError(error);
	if (transformed) return transformed;
	// Preserve original error message if available
	const errorMessage =
		error instanceof Error ? error.message : "Failed to update course";
	return new UnknownError(errorMessage, {
		cause: error,
	});
},
```

### 4. Error Transformation

**File:** `app/utils/error.ts`

- Added `ValidationError` to the `transformError` function's type checking chain
- Ensures validation errors are recognized and returned as-is without transformation
- Maintains consistency with other error types

## Technical Details

### Error Flow

1. **Validation Hook**: `beforeValidate` hook in courses collection throws `ValidationError`
2. **Payload Operation**: Payload's `update` operation catches the error
3. **Internal Function**: `tryUpdateCourse` catches the error in its `Result.try` error handler
4. **Error Transformation**: `transformError` recognizes `ValidationError` and returns it as-is
5. **Result**: Error message is preserved and available to callers

### Error Recognition Chain

The `transformError` function now checks for `ValidationError` in this order:
1. System errors (UnauthorizedError, InvalidArgumentError, etc.)
2. Domain errors (EnrollmentNotFoundError, CourseAccessDeniedError, etc.)
3. **ValidationError** (new)
4. Other known errors (QuizConfigValidationError, etc.)
5. Unknown errors (returns `undefined`)

### Message Preservation Strategy

When an error is not recognized by `transformError`:
- If error is an `Error` instance: Preserve `error.message`
- If error is not an `Error` instance: Use generic fallback message
- Always include original error as `cause` for debugging

## User Impact

### For Developers

#### Improved Debugging
- **Clear Error Messages**: Validation errors now show specific messages like "End date must be after start date"
- **Better Stack Traces**: Original error is preserved as `cause` in `UnknownError`
- **Type Safety**: `ValidationError` provides type-safe error handling

#### Test Reliability
- **Accurate Assertions**: Tests can now reliably check for specific validation error messages
- **Better Test Coverage**: Validation error scenarios can be properly tested
- **Consistent Behavior**: Error handling is consistent across all validation scenarios

### For End Users

#### Better Error Messages
- **Specific Feedback**: Users see clear validation error messages instead of generic errors
- **Actionable Information**: Error messages help users understand what needs to be fixed
- **Consistent Experience**: All validation errors follow the same pattern

## Testing Considerations

### Test Fixes

**File:** `server/internal/course-management.test.ts`

- Test "should fail to update course when endDate is before startDate" now passes
- Error message assertion correctly finds "End date must be after start date"
- All 39 tests in the test suite pass

### Test Scenarios

1. **Date Validation**: 
   - ✅ Creating course with invalid date range throws `ValidationError`
   - ✅ Updating course with invalid date range throws `ValidationError`
   - ✅ Error message is preserved and accessible

2. **Error Propagation**:
   - ✅ Validation errors propagate through internal functions
   - ✅ Error messages are preserved through error transformation
   - ✅ Original error is available as `cause` for debugging

3. **Error Recognition**:
   - ✅ `transformError` recognizes `ValidationError`
   - ✅ `ValidationError` is returned as-is without transformation
   - ✅ Unknown errors still preserve original message when possible

## Migration Notes

### No Breaking Changes

- ✅ All changes are backward compatible
- ✅ Existing error handling continues to work
- ✅ No database migrations required
- ✅ No API contract changes

### Code Updates

#### For New Validation Logic

When adding new validation in collection hooks:
```typescript
import { ValidationError } from "app/utils/error";

// In beforeValidate hook
if (/* validation fails */) {
	throw new ValidationError("Clear validation message");
}
```

#### For Error Handling

When handling errors in internal functions:
- `ValidationError` is automatically recognized by `transformError`
- Error messages are preserved automatically
- No special handling required

## Related Features

### Error Handling System

- Integrates with existing error handling infrastructure
- Follows established error class patterns
- Works with `Result` type from `typescript-result`
- Compatible with Payload's error handling

### Course Date Validation

- Fixes error handling for course start/end date validation
- Improves test reliability for date validation scenarios
- Ensures validation errors are properly communicated

## Future Enhancements

### Potential Extensions

- Apply `ValidationError` to other validation scenarios (enrollments, assignments, etc.)
- Create specific validation error subclasses for different validation types
- Add validation error codes for programmatic error handling
- Enhance error messages with more context (field names, current values, etc.)

### Error Message Improvements

- Add field-level error messages
- Include validation context in error messages
- Support multiple validation errors in a single response
- Add error message templates for common validation scenarios

## Conclusion

The introduction of `ValidationError` and improved error message preservation significantly enhances the error handling system. Validation errors now provide clear, actionable feedback to both developers and end users. The fix ensures that validation error messages are properly propagated through the error handling chain, making debugging easier and tests more reliable.

The changes are minimal, focused, and maintain full backward compatibility while improving the overall developer and user experience.

---

**Summary**: Introduced `ValidationError` class and enhanced error message preservation in internal functions. Validation errors in collection hooks now properly propagate with their original messages, fixing test failures and improving debugging experience. All changes are backward compatible and require no migrations.
