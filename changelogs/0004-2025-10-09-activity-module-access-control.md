# Activity Module Access Control and Ownership Transfer

**Date:** October 9, 2025

## Overview

Implemented a comprehensive access control system for activity modules that allows creators and admins to grant access to other users and transfer ownership. The system ensures that only authorized users can view and modify activity modules while providing granular control over permissions.

## Changes

### New Collections

#### `activity-module-grants`
A new collection to track access grants for activity modules:
- `activityModule` - Reference to the activity module
- `grantedTo` - User who receives access
- `grantedBy` - User who granted the access
- `grantedAt` - Timestamp of when access was granted

Unique constraint on `(activityModule, grantedTo)` to prevent duplicate grants.

### Schema Changes

#### `activity-modules`
- Added `owner` field - Separate from `createdBy` to support ownership transfer
  - Cannot be updated directly through normal updates (protected)
  - Must use the ownership transfer function
- Added `grants` join field - Shows all access grants for the module
- Added comprehensive access control:
  - **Read**: Owner, creator, granted users, or admin
  - **Update**: Owner, granted users, or admin
  - **Delete**: Owner or admin only

#### `assignments`, `quizzes`, `discussions`
- Added access control logic that inherits from parent activity module
- Users who have access to the activity module can read/update these configs
- Only creators can delete the configs

### New Internal Functions

Located in `server/internal/activity-module-access.ts`:

#### `tryGrantAccessToActivityModule`
Grants access to an activity module for a specific user.
- Only owner or admin can grant access
- Prevents duplicate grants
- Returns the created grant record

#### `tryRevokeAccessFromActivityModule`
Revokes access from a user.
- Only owner or admin can revoke access
- Removes the grant record
- User immediately loses access

#### `tryTransferActivityModuleOwnership`
Transfers ownership of an activity module to another user.
- Previous owner automatically receives a grant (becomes admin without delete permission)
- New owner's existing grant is removed (if any)
- Uses database transaction for atomicity
- Only current owner or admin can transfer ownership

#### `tryCheckActivityModuleAccess`
Checks if a user has access to an activity module.
- Returns detailed information:
  - `hasAccess` - Whether user can access the module
  - `isOwner` - Whether user owns the module
  - `isCreator` - Whether user created the module
  - `isGranted` - Whether user has been granted access
  - `isAdmin` - Whether user is a global admin

### Database Migration

**Migration:** `20251009_204003`
- Created `activity_module_grants` table
- Added `owner_id` column to `activity_modules`
- Backfilled `owner_id` with existing `created_by_id` values
- Added necessary foreign key constraints and indexes
- Used `afterSchemaInit` hook to set CASCADE on delete for activity module foreign key

## Access Control Summary

### Permissions Matrix

| Action | Owner | Granted User | Creator (not owner) | Admin | Others |
|--------|-------|--------------|---------------------|-------|--------|
| Read   | ✅    | ✅           | ✅                  | ✅    | ❌     |
| Update | ✅    | ✅           | ❌                  | ✅    | ❌     |
| Delete | ✅    | ❌           | ❌                  | ✅    | ❌     |

### Key Behaviors

1. **Ownership Transfer**: When ownership is transferred, the previous owner retains full read/update access through an automatic grant but loses delete permission.

2. **Grant Management**: Only the owner (or admin) can grant or revoke access to other users.

3. **Config Collections**: Access to assignments, quizzes, and discussions is controlled by access to their parent activity module.

4. **Admin Override**: Global admins have full access to all activity modules regardless of ownership or grants.

5. **Creator vs Owner**: The creator and owner are initially the same, but after an ownership transfer, they may differ. The creator always has read access.

## Testing

Comprehensive test suite added in `server/internal/activity-module-access.test.ts`:
- Owner CRUD operations
- Access grant and revoke functionality
- Ownership transfer with automatic grant creation
- Permission boundaries (e.g., granted users cannot delete)
- Admin override capabilities
- Edge cases (duplicate grants, invalid transfers)

## Migration Notes

For existing activity modules:
- The `owner` field is automatically populated with the `createdBy` user
- No manual data migration required
- All existing modules remain accessible to their creators

## Breaking Changes

None. This is a purely additive feature that enhances existing functionality without breaking compatibility.

## Future Enhancements

Potential improvements for future iterations:
- Role-based permissions (view-only vs full access)
- Batch grant management
- Grant expiration/time-limited access
- Access audit logs
- Notification system for grant changes

