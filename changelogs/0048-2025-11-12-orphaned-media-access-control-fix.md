# Changelog 0048: Orphaned Media Access Control Fix

**Date**: November 12, 2025  
**Type**: Bug Fix  
**Impact**: High - Fixes access control errors preventing orphaned media management functionality from working

## Overview

Fixed a critical bug where orphaned media management functions were missing required access control parameters (`user`, `req`, `overrideAccess`), causing "Forbidden: You are not allowed to perform this action" errors when attempting to view or manage orphaned media files. The functions were hardcoding `overrideAccess: true` internally instead of accepting these parameters from callers, which violated the project's access control patterns and caused failures when access control was enforced.

## Bug Fixed

### Problem

Four orphaned media management functions were missing standard access control parameters in their function signatures:

1. `tryGetOrphanedMedia` - Used to fetch paginated list of orphaned media files
2. `tryGetAllOrphanedFilenames` - Used to get all orphaned filenames without pagination
3. `tryPruneAllOrphanedMedia` - Used to delete all orphaned media files
4. `tryDeleteOrphanedMedia` - Used to delete specific orphaned media files

These functions were hardcoding `overrideAccess: true` in their internal `payload.find()` calls, which:
- Violated the project's standardized internal function signature pattern
- Prevented proper access control enforcement
- Caused "Forbidden" errors when Payload's access control was enforced
- Made it impossible to use these functions with proper user context and transaction support

### Solution

Added missing access control parameters to all four functions:

**Updated Function Signatures**:
- Added `user?: TypedUser | null` parameter
- Added `req?: Partial<PayloadRequest>` parameter  
- Added `overrideAccess?: boolean` parameter

**Updated Function Implementations**:
- Removed hardcoded `overrideAccess: true` from internal `payload.find()` calls
- Now properly pass `user`, `req`, and `overrideAccess` parameters to Payload operations
- Default values: `user = null`, `overrideAccess = false` (following project conventions)

**Updated Call Sites**:
- `app/routes/admin/media.tsx` loader: Added `user` and `req: request` parameters
- `app/routes/admin/media.tsx` action: Added `user`, `req: { transactionID }`, and `overrideAccess: true` for admin operations
- `server/internal/media-management.test.ts`: Added `overrideAccess: true` to all test calls

## Technical Details

### Functions Fixed

1. **`GetOrphanedMediaArgs` interface and `tryGetOrphanedMedia` function**:
   - Added `user`, `req`, `overrideAccess` to interface
   - Updated function to accept and use these parameters
   - Changed internal `payload.find()` call from hardcoded `overrideAccess: true` to using passed parameters

2. **`GetAllOrphanedFilenamesArgs` interface and `tryGetAllOrphanedFilenames` function**:
   - Added `user`, `req`, `overrideAccess` to interface
   - Updated function to accept and use these parameters
   - Changed internal `payload.find()` call from hardcoded `overrideAccess: true` to using passed parameters

3. **`PruneAllOrphanedMediaArgs` interface and `tryPruneAllOrphanedMedia` function**:
   - Added `user`, `req`, `overrideAccess` to interface
   - Updated function to accept and use these parameters
   - Changed internal `payload.find()` call from hardcoded `overrideAccess: true` to using passed parameters

4. **`DeleteOrphanedMediaArgs` interface and `tryDeleteOrphanedMedia` function**:
   - Added `user`, `req`, `overrideAccess` to interface
   - Updated function to accept and use these parameters
   - Changed internal `payload.find()` call from hardcoded `overrideAccess: true` to using passed parameters

### Access Control Pattern

All internal functions in the project follow a standardized pattern:
- Accept `user?: TypedUser | null` for user context
- Accept `req?: Partial<PayloadRequest>` for transaction support and request context
- Accept `overrideAccess?: boolean` to control access control enforcement
- Default to `overrideAccess = false` to enforce access control by default
- Pass these parameters through to Payload operations

This fix ensures orphaned media functions follow the same pattern as all other internal functions in the codebase.

### Transaction Support

The fix also enables proper transaction support:
- Functions now accept `req` parameter which can include `transactionID`
- Transaction context is properly propagated to Payload operations
- Enables atomic operations when deleting orphaned media within transactions

## Files Changed

### Modified Files
- `server/internal/media-management.ts` - Added access control parameters to 4 function interfaces and implementations
- `app/routes/admin/media.tsx` - Updated all call sites to pass `user` and `req` parameters
- `server/internal/media-management.test.ts` - Updated test calls to include `overrideAccess: true`

### Additional Improvements

- Simplified return type annotation for `tryGetAllMedia` function (removed explicit Promise return type annotation, letting TypeScript infer it)

## Impact

**Before Fix**:
- Admin users could not view orphaned media files (403 Forbidden errors)
- Admin users could not delete orphaned media files (403 Forbidden errors)
- Functions violated project's access control patterns
- No transaction support for orphaned media operations

**After Fix**:
- ✅ Admin users can view orphaned media files with proper access control
- ✅ Admin users can delete orphaned media files with proper access control
- ✅ Functions follow standardized access control patterns
- ✅ Transaction support enabled for atomic operations
- ✅ Consistent with all other internal functions in the codebase

## Testing

- ✅ Updated all test cases to include `overrideAccess: true` parameter
- ✅ Tests verify orphaned media detection and deletion functionality
- ✅ Access control now properly enforced in production while tests can override

## Related Issues

This bug was discovered when accessing the admin media management page, where orphaned media operations were failing with access control errors. The fix ensures that orphaned media management functions work correctly while maintaining proper security through access control enforcement.

