# Incident Report: Test Search Data Collision with Seed Data

**Date**: March 7, 2026  
**Severity**: Low (flaky test)  
**Affected**: `packages/module-user/src/tests/user-management.test.ts`  
**Status**: Resolved  
**Incident ID**: INC-2026-03-07-001

## Summary

The test "should comprehensively test search functionality with text and role filters" failed with:

```
expect(searchByLastName.value.docs.length).toBe(1)
Expected: 1
Received: 2
```

The test searched for `"Manager"` expecting to find exactly one user (Bob Manager). It returned two users because the predefined seed data also includes a user with lastName "Manager" (Content Manager).

## Impact

**Symptoms**:
- `tryFindAllUsers` search tests fail intermittently or when seed data overlaps with test data
- Assertions like `expect(docs.length).toBe(1)` fail when seed + test data both match the query

**Root Cause**:
- `beforeAll` seeds `predefinedUserSeedData` which includes users like "Content Manager" (lastName: "Manager")
- The test creates additional users (e.g. Bob Manager) and searches for "Manager"
- Search matches both the test user and the seed user → 2 results instead of 1

## Resolution

Use unique test data that does not overlap with seed data.

**Before** (collides with seed):
```typescript
{
  email: "bob.manager@search-test.com",
  firstName: "Bob",
  lastName: "Manager",  // Also matches seed: Content Manager
  role: "content-manager",
}
// Search: "Manager" → 2 users (Bob + Content Manager)
```

**After** (unique):
```typescript
{
  email: "bob.coordinator@search-test.com",
  firstName: "Bob",
  lastName: "Coordinator",  // Not in predefined-user-seed-data
  role: "content-manager",
}
// Search: "Coordinator" → 1 user (Bob only)
```

## Prevention

1. **Check seed data before writing search tests**: Inspect `predefined-*-seed-data.ts` (or equivalent) for the module.
2. **Use unique values**: For search/filter assertions that expect exactly N results, use values that do not appear in seed data.
3. **Document overlap**: If seed data is shared across tests, add a comment in the test explaining why certain values are chosen.

## References

- Test: `packages/module-user/src/tests/user-management.test.ts`
- Seed: `packages/module-user/src/seeding/predefined-user-seed-data.ts`
- Skill: `.cursor/skills/module-package-refactoring/SKILL.md` (Test Data Isolation section)

## Status

✅ **RESOLVED** - Test uses "Coordinator" instead of "Manager" to avoid collision with seed user "Content Manager".
