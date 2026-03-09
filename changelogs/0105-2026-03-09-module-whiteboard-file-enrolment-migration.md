# Module Migration: Whiteboard, File, and Enrolment to Standalone Packages

**Date:** March 9, 2026  
**Type:** Feature / Architecture  
**Impact:** High - Three modules extracted from paideia-backend to standalone workspace packages

## Overview

Migrated the whiteboard, file, and enrolment modules from `packages/paideia-backend/src/modules/` to self-contained standalone packages under `packages/`. Each package has its own Payload config, type generation, migrations, services, ORPC API, seeding layer, and comprehensive test suites.

## Packages Created

### 1. `@paideia/module-whiteboard`

- **Collection**: Whiteboards with `richTextContentWithHook` for description field
- **Services**: 6 CRUD functions (create, update, delete, findById, search, findByUser)
- **API**: 6 ORPC endpoints
- **Seeding**: SeedBuilder with predefined + test data
- **Tests**: 53 tests across 4 files
- **Migration**: `20260309_014744`

### 2. `@paideia/module-file`

- **Collection**: Files with `mediaFieldWithHook({ hasMany: true })` for media attachments
- **Services**: 6 CRUD functions; interfaces accept `media?: (number | File)[]` for automatic File conversion
- **API**: 6 ORPC endpoints
- **Seeding**: SeedBuilder with media filename resolution
- **Tests**: 57 tests across 4 files
- **Migration**: `20260309_020149`

### 3. `@paideia/module-enrolment` (Most Complex)

- **Collections**: 2 — Enrollments (user-course-role-groups) and Groups (hierarchical with path auto-generation)
- **Services**: 21 total — 13 enrollment functions + 8 group functions
- **API**: 13 ORPC endpoints for enrollment operations
- **Seeding**: 2 SeedBuilder subclasses (groups-builder, enrollments-builder), 2 seed schemas, predefined + test data
- **Custom Errors**: `DuplicateEnrollmentError`, `EnrollmentNotFoundError`
- **Tests**: 69 tests across 5 files (seed-builders, enrollment-management, groups-before-validate, openapi, module)
- **Migration**: `20260309_022544`

## Critical Bug Fix: Groups Collection beforeValidate Hook Transaction Visibility

The Groups collection's `beforeValidate` hook auto-generates a hierarchical `path` field by looking up the parent group. When seeding parent-child groups within a single SeedBuilder transaction, the hook's `findByID` call could not find the parent group because it was executed outside the active transaction.

**Root Cause**: The `beforeValidate` hook called `req.payload.findByID({ collection: "groups", id: data.parent })` without passing the `req` parameter, causing the lookup to run in a separate connection that couldn't see uncommitted writes.

**Fix**: Pass `req` to maintain transaction context:
```typescript
// Before (broken)
const parentGroup = await req.payload.findByID({
  collection: "groups",
  id: data.parent,
});

// After (fixed)
const parentGroup = await req.payload.findByID({
  collection: "groups",
  id: data.parent,
  req,  // Maintains transaction context
});
```

See incident report: `release-notes/incidents/2026-03-09-groups-hook-transaction-visibility.md`

## Key Patterns Used

- **UserModule.fieldHooks**: `richTextContentWithHook` (whiteboard), `mediaFieldWithHook` (file)
- **Result pattern**: All service functions use `typescript-result`'s `Result.try()`
- **SeedBuilder**: All modules use the `SeedBuilder` abstract class with transaction handling
- **handleTransactionId**: All service functions use transaction-aware request handling
- **Module class pattern**: Static `api`, `collections`, `dependencies`, `seedData` properties

## Dependencies

| Package | Depends On |
|---------|-----------|
| `@paideia/module-whiteboard` | `@paideia/module-user`, `@paideia/module-infrastructure`, `@paideia/shared` |
| `@paideia/module-file` | `@paideia/module-user`, `@paideia/module-infrastructure`, `@paideia/shared` |
| `@paideia/module-enrolment` | `@paideia/module-user`, `@paideia/module-course`, `@paideia/module-infrastructure`, `@paideia/shared` |

## Test Summary

| Package | Tests | Files |
|---------|-------|-------|
| module-whiteboard | 53 | 4 |
| module-file | 57 | 4 |
| module-enrolment | 69 | 5 |
| **Total** | **179** | **13** |

## Files Created

### packages/module-whiteboard/ (NEW)
- `package.json`, `tsconfig.json`, `.env`, `.env.example`, `.gitignore`
- `src/collections/whiteboards.ts`
- `src/services/whiteboard-management.ts`
- `src/api/whiteboard-management.ts`
- `src/seeding/` (schema, builder, predefined data, test data, index)
- `src/tests/` (management, openapi, builder, module)
- `src/payload.config.ts`, `src/index.ts`, `src/errors.ts`, `src/orpc/context.ts`, `src/utils/constants.ts`
- `src/migrations/20260309_014744.ts`, `src/migrations/index.ts`

### packages/module-file/ (NEW)
- Same structure as whiteboard, plus `mediaFieldWithHook` usage
- `src/migrations/20260309_020149.ts`

### packages/module-enrolment/ (NEW)
- `src/collections/enrollments.ts`, `src/collections/groups.ts`
- `src/services/enrollment-management.ts`, `src/services/group-management.ts`
- `src/api/enrollment-management.ts`
- `src/seeding/` (2 schemas, 2 builders, predefined data for groups + enrollments, test user/course data)
- `src/tests/` (seed-builders, enrollment-management, groups-before-validate, openapi, module)
- `src/migrations/20260309_022544.ts`

## References

- Skill: `.agents/skills/payload-module-pattern/SKILL.md`
- Skill: `.agents/skills/seed-builder-pattern/SKILL.md`
- Skill: `.cursor/skills/module-package-refactoring/SKILL.md`
- Incident: `release-notes/incidents/2026-03-09-groups-hook-transaction-visibility.md`
