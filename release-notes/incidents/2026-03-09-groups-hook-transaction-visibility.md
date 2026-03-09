# Incident Report: Groups Collection beforeValidate Hook Transaction Visibility

**Date**: March 9, 2026  
**Severity**: High (breaks all hierarchical group seeding within transactions)  
**Affected**: `@paideia/module-enrolment` — Groups collection `beforeValidate` hook  
**Status**: Resolved  
**Incident ID**: INC-2026-03-09-001

## Summary

When seeding parent-child groups within a single SeedBuilder transaction, child group creation failed with `NotFound` error because the `beforeValidate` hook's `findByID` call for the parent group executed outside the active transaction. The parent group existed in the transaction but was invisible to the hook's separate database connection.

## Symptoms

```
NotFound: Not Found
  at findByID.js:108:23

error: Failed to create group
  at group-management.ts:117:4
```

Child groups (e.g., "Subsection A1" with parent "Section A") failed during `trySeedGroups()` even though the parent was created moments earlier in the same transaction.

## Root Cause

The Groups collection's `beforeValidate` hook auto-generates a hierarchical `path` field by looking up the parent group's path. The hook called `req.payload.findByID()` **without passing the `req` parameter**:

```typescript
// BROKEN: findByID runs in a NEW database connection, outside the transaction
hooks: {
  beforeValidate: [
    async ({ data, operation, req }) => {
      if (data?.parent && typeof data.parent === "number") {
        const parentGroup = await req.payload.findByID({
          collection: "groups",
          id: data.parent,
          // Missing: req  <-- THIS IS THE BUG
        });
        // ...
      }
    },
  ],
}
```

In PostgreSQL, uncommitted writes within a transaction are only visible to operations using the **same transaction connection**. Without `req`, Payload's `findByID` acquires a fresh connection from the pool, which cannot see the uncommitted parent group.

## Impact

- **SeedBuilder transactions**: Any `trySeedGroups()` call with parent-child groups fails
- **Service function transactions**: `tryCreateGroup()` with parent validation within a wrapping transaction also fails
- **Direct API calls without transactions**: Works fine (data is committed between calls)

## Resolution

Pass `req` to the `findByID` call inside the hook to maintain transaction context:

```typescript
// FIXED: findByID uses the same transaction connection
hooks: {
  beforeValidate: [
    async ({ data, operation, req }) => {
      if (data?.parent && typeof data.parent === "number") {
        const parentGroup = await req.payload.findByID({
          collection: "groups",
          id: data.parent,
          req,  // <-- CRITICAL: maintains transaction context
        });
        if (parentGroup?.path) {
          data.path = `${parentGroup.path}/${data.name}`;
        }
      } else if (data && !data?.parent) {
        data.path = data.name;
      }
      return data;
    },
  ],
}
```

**File**: `packages/module-enrolment/src/collections/groups.ts`

## General Rule

**ALL Payload operations inside collection hooks MUST pass `req` to maintain transaction context.** This includes:

- `req.payload.findByID({ ..., req })`
- `req.payload.find({ ..., req })`
- `req.payload.create({ ..., req })`
- `req.payload.update({ ..., req })`
- `req.payload.delete({ ..., req })`

Without `req`, Payload acquires a new database connection from the pool, breaking transaction isolation. This applies to:

- `beforeValidate` hooks
- `beforeChange` hooks
- `afterChange` hooks
- `beforeDelete` / `afterDelete` hooks

## Detection

This bug is particularly insidious because:

1. **Works without transactions**: Direct API calls commit between operations, so parent is visible
2. **Works in simple tests**: Tests that don't use SeedBuilder (which wraps in a transaction) pass
3. **Fails only in transactional contexts**: SeedBuilder, nested service calls, or any code that wraps multiple operations in a transaction

## Testing Approach

Created dedicated `groups-before-validate.test.ts` with 4 tests:
- Root group path generation
- Child group path generation (requires parent lookup within transaction)
- Nested child group path generation (grandchild)
- Path update when parent is changed during update

Also created `seed-builders.test.ts` (20 tests) that exercises the full SeedBuilder transaction flow with parent-child groups.

## Prevention Checklist

When writing or reviewing Payload collection hooks:

- [ ] Every `req.payload.*` call inside a hook passes `req` parameter
- [ ] Test with SeedBuilder to verify transaction-aware behavior
- [ ] Create dedicated hook tests that exercise parent-child creation within a single operation
- [ ] Review existing hooks for missing `req` parameters

## Related

- Payload docs on transactions: [ADAPTERS.md#threading-req-through-operations](reference/ADAPTERS.md)
- Skill: `.agents/skills/payload/SKILL.md` — "Transaction Failures in Hooks" security pitfall
- Skill: `.agents/skills/seed-builder-pattern/SKILL.md` — SeedBuilder transaction handling
- Changelog: `changelogs/0105-2026-03-09-module-whiteboard-file-enrolment-migration.md`
