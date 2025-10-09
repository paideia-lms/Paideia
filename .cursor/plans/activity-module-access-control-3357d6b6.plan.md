<!-- 3357d6b6-4668-42ce-a8bc-10210402a812 1447da45-e1ad-4d89-9920-72428f5c3e46 -->
# Activity Module Access Control & Ownership Transfer

## Implementation Steps

### 1. Create Activity Module Grants Collection

**File: `server/collections/activity-module-grants.ts`** (new file)

Create a new collection to track access grants:

```typescript
export const ActivityModuleGrants = {
  slug: "activity-module-grants",
  fields: [
    {
      name: "activityModule",
      type: "relationship",
      relationTo: "activity-modules",
      required: true,
    },
    {
      name: "grantedTo",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "grantedBy",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "grantedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date(),
    },
  ],
  indexes: [
    {
      fields: ["activityModule", "grantedTo"],
      unique: true,
    },
    {
      fields: ["activityModule"],
    },
    {
      fields: ["grantedTo"],
    },
  ],
}
```

### 2. Add Owner Field to Activity Modules

**File: `server/collections/activity-modules.ts`**

Add an `owner` field separate from `createdBy` to support ownership transfer:

```typescript
{
  name: "owner",
  type: "relationship",
  relationTo: "users",
  required: true,
  label: "Owner",
  access: {
    update: () => false, // Cannot be updated directly, only via transfer function
  },
}
```

### 3. Add Join Field for Grants

**File: `server/collections/activity-modules.ts`**

Add a join field to see all grants on an activity module:

```typescript
{
  name: "grants",
  type: "join",
  on: "activityModule",
  collection: "activity-module-grants",
  hasMany: true,
}
```

### 4. Implement Access Control on Activity Modules

**File: `server/collections/activity-modules.ts`**

Add access control logic:

```typescript
access: {
  read: ({ req }) => {
    if (!req.user) return false;
    if (req.user.role === "admin") return true;
    
    return {
      or: [
        { owner: { equals: req.user.id } },
        { createdBy: { equals: req.user.id } },
        { "grants.grantedTo": { equals: req.user.id } },
      ],
    };
  },
  update: ({ req }) => {
    if (!req.user) return false;
    if (req.user.role === "admin") return true;
    
    return {
      or: [
        { owner: { equals: req.user.id } },
        { "grants.grantedTo": { equals: req.user.id } },
      ],
    };
  },
  delete: ({ req }) => {
    if (!req.user) return false;
    if (req.user.role === "admin") return true;
    
    return {
      owner: { equals: req.user.id },
    };
  },
}
```

### 5. Implement Access Control on Config Collections

**Files: `server/collections/assignments.ts`, `server/collections/quizzes.ts`, `server/collections/discussions.ts`**

Add similar access control to each config collection, checking access via their parent activity module.

### 6. Create Internal Functions for Access Management

**File: `server/internal/activity-module-access.ts`** (new file)

Implement helper functions:

- `tryGrantAccessToActivityModule(payload, activityModuleId, userId, grantedBy)` - Grant access to a user
- `tryRevokeAccessFromActivityModule(payload, activityModuleId, userId)` - Revoke access from a user
- `tryTransferActivityModuleOwnership(payload, activityModuleId, newOwnerId, currentOwnerId)` - Transfer ownership (previous owner gets automatic grant)
- `tryCheckActivityModuleAccess(payload, activityModuleId, userId)` - Check if user has access

### 7. Update Collection Index

**File: `server/collections/index.ts`**

Export the new collection:

```typescript
export { ActivityModuleGrants } from "./activity-module-grants";
```

### 8. Create Database Migration

Generate migration for:

- New `activity-module-grants` collection
- New `owner` field on `activity-modules`
- Backfill `owner` field with `createdBy` values for existing records

### 9. Add Tests

**File: `server/internal/activity-module-access.test.ts`** (new file)

Test all access control scenarios:

- Grant and revoke access
- Ownership transfer
- Access checks for owner, granted users, and non-granted users
- Admin override
- Delete permissions

### 10. Create Changelog

**File: `changelogs/0004-2025-10-09-activity-module-access-control.md`** (new file)

Document the new access control system.

### To-dos

- [ ] Create activity-module-grants collection
- [ ] Add owner field, grants join field, and access control to activity-modules collection
- [ ] Add access control to assignments, quizzes, and discussions collections
- [ ] Implement internal functions for access management and ownership transfer
- [ ] Export new collection in collections/index.ts
- [ ] Generate and update database migration
- [ ] Write comprehensive tests for access control system
- [ ] Document changes in changelog