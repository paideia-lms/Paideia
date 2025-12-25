# Sandbox Reset Transaction Fix

**Date:** December 25, 2025  
**Type:** Bug Fix  
**Impact:** Medium - Ensures transaction consistency during sandbox database resets, preventing partial data states if operations fail

## Overview

Fixed a bug in the sandbox reset functionality where the seed operation was not running within the transaction context. This could lead to inconsistent database states if the seed operation failed partway through, as the deletion of user data would be committed but the seeding would not be rolled back.

## Bug Fix

### Transaction Context for Seed Operation

**Problem**:
- The `tryRunSeed` function was being called without the transaction-aware request object during sandbox reset
- This meant seed operations were not part of the transaction that deletes user data
- If seeding failed, the deletion would still be committed, leaving the database in an inconsistent state

**Solution**:
- Added `req: txInfo.reqWithTransaction` parameter to the `tryRunSeed` call in `tryResetSandbox`
- Ensures all seed operations execute within the same transaction as the user data deletion
- If any operation fails, the entire transaction is rolled back, maintaining database consistency

**Implementation**:
- Modified `server/utils/db/sandbox-reset.ts` to pass `txInfo.reqWithTransaction` to `tryRunSeed`
- The seed operation now properly participates in the transaction lifecycle
- All database operations during sandbox reset (deletion + seeding) are now atomic

**Files Changed**:
- `server/utils/db/sandbox-reset.ts`: Added transaction context to seed operation

## Technical Details

The fix ensures that when `tryResetSandbox` executes:

1. A transaction is created via `handleTransactionId`
2. User data deletion runs within the transaction using `txInfo.reqWithTransaction`
3. Seed operation now also runs within the same transaction using `txInfo.reqWithTransaction`
4. If any step fails, the entire transaction is rolled back
5. Only if all operations succeed is the transaction committed

This maintains the atomicity guarantee that was intended but not fully implemented for the seed operation.

## Impact

- **Data Consistency**: Sandbox resets are now fully transactional, preventing partial states
- **Error Recovery**: Failed seed operations will properly roll back the entire reset operation
- **Reliability**: Sandbox mode is now more reliable for development and testing environments

