# Incident Report: v0.6.0 Migration Failure

**Date**: November 12, 2025  
**Severity**: Critical  
**Affected Version**: v0.6.0  
**Status**: Resolved in v0.6.1  
**Incident ID**: INC-2025-11-12-001

## Summary

The v0.6.0 release contains a critical migration bug that prevents the database migration from completing successfully. This causes the Paideia LMS server to fail to start, effectively making v0.6.0 unusable. Users attempting to upgrade to v0.6.0 will find their server unable to start, and will remain on their previous version (typically v0.5.6) due to Payload's automatic migration rollback mechanism.

## Impact

**Severity**: Critical - Complete deployment failure

**Affected Users**:
- All users attempting to upgrade to v0.6.0
- Users who have already attempted to upgrade to v0.6.0

**Symptoms**:
- Server fails to start after upgrade
- Migration fails during database schema update
- Error messages related to database migration
- System automatically rolls back to previous version

**User Impact**:
- Cannot deploy v0.6.0
- Must skip directly to v0.6.1
- No data loss (thanks to rollback mechanism)
- Temporary inability to access new features

## Root Cause

The migration script `20251112_215652_v0_6_0.ts` contains a critical flaw in how it handles the addition of the `created_by_id` column to the `media` table:

### The Problem

1. **Column Addition Strategy**: The migration attempts to add a `NOT NULL` column to an existing `media` table that may already contain rows.

2. **Data Population Logic**: The migration tries to populate existing `media` rows with user IDs using UPDATE statements:
   ```sql
   UPDATE "media"
   SET "created_by_id" = (SELECT "id" FROM "users" WHERE "role" = 'admin' ...)
   WHERE "created_by_id" IS NULL
   AND EXISTS (SELECT 1 FROM "users" WHERE "role" = 'admin' LIMIT 1);
   ```

3. **Failure Scenarios**: The migration can fail in several scenarios:
   - If there are no users in the database
   - If there are no admin users
   - If there are media rows but no matching users
   - If the UPDATE statements don't cover all existing media rows
   - Race conditions or timing issues during migration

4. **Constraint Conflict**: The foreign key constraint uses `ON DELETE restrict` with a `NOT NULL` column, which can create conflicts if users are deleted while media references exist.

### Technical Details

**Original Migration (v0.6.0)**:
```sql
ALTER TABLE "media" ADD COLUMN "created_by_id" integer;
-- UPDATE statements to populate existing rows
ALTER TABLE "media" ALTER COLUMN "created_by_id" SET NOT NULL;
ALTER TABLE "media" ADD CONSTRAINT "media_created_by_id_users_id_fk" 
  FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") 
  ON DELETE restrict ON UPDATE no action;
```

**Issues Identified**:
- The UPDATE statements may not cover all edge cases
- No guarantee that all existing media rows will have valid user IDs
- The `ON DELETE restrict` constraint prevents user deletion if media exists, but doesn't handle orphaned media gracefully
- Missing error handling for cases where no users exist

## Resolution

**Fixed in**: v0.6.1

The migration has been corrected in v0.6.1 with improved error handling and a more robust data population strategy. The fix includes:

1. Better handling of existing data
2. Improved error messages
3. More robust user assignment logic
4. Proper handling of edge cases

## Workaround

**For users who have not yet upgraded**:
- **DO NOT** upgrade to v0.6.0
- Upgrade directly to v0.6.1 instead
- v0.6.1 contains all features from v0.6.0 plus the migration fix

**For users who already attempted v0.6.0 upgrade**:
- The system should have automatically rolled back to the previous version
- Verify you are on v0.5.6 or earlier
- Upgrade directly to v0.6.1
- No data loss should have occurred due to transaction rollback

## Prevention

**Lessons Learned**:
1. Migration scripts must handle all edge cases, including empty databases
2. Adding NOT NULL columns to existing tables requires careful data population
3. Foreign key constraints must be compatible with deletion policies
4. Comprehensive testing of migration scripts is critical before release

**Process Improvements**:
- Enhanced migration testing procedures
- Better validation of migration scripts
- More thorough edge case testing
- Improved rollback mechanisms

## Timeline

- **2025-11-12**: v0.6.0 released with migration bug
- **2025-11-12**: Bug discovered during deployment attempts
- **2025-11-12**: Incident report created
- **2025-11-12**: v0.6.1 released with fix

## References

- Release Notes: [v0.6.0 Release Notes](../0.6.0-2025-11-12.md)
- Migration File: `src/migrations/20251112_215652_v0_6_0.ts`
- Fixed Version: v0.6.1

## Status

✅ **RESOLVED** - Fixed in v0.6.1

Users should upgrade directly to v0.6.1 to avoid this issue.

