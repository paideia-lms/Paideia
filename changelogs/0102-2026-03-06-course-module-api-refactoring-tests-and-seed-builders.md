# Course Module API Refactoring, Tests, and Seed Builders

**Date:** March 6, 2026  
**Type:** Feature Addition / Refactoring / Testing  
**Impact:** Medium - Adds course seeding, improves API patterns, enhances test coverage

## Overview

Added comprehensive test coverage and seed builders for the courses module, following the SeedBuilder abstraction pattern. Also fixed API handler patterns to match the note-management pattern with proper ORPCError handling.

## Features Added

### 1. Access Control Tests

**File**: `packages/paideia-backend/src/modules/courses/tests/access-control.test.ts`

Created unit tests for collection access control:

**Courses collection**:
- Create: admin and content-manager only
- Read: public access
- Update: admin only
- Delete: admin only

**CourseSections collection**:
- Create: admin, instructor, and content-manager
- Read: public access
- Update: admin, instructor, and content-manager
- Delete: admin, instructor, and content-manager

**32 passing tests** covering both positive and negative cases for each role.

### 2. API Handler Refactoring

**Files**:
- `packages/paideia-backend/src/modules/courses/api/course-management.ts`
- `packages/paideia-backend/src/modules/courses/api/course-section-management.ts`
- `packages/paideia-backend/src/modules/courses/api/course-activity-module-link-management.ts`

**Changed from**:
```typescript
const run = <T>(fn, args) => handleResult(() => fn({ ...args, req: undefined, overrideAccess: true }));

handler(async ({ input, context }) => run(tryCreateCourse, { payload: context.payload, ...input }))
```

**Changed to**:
```typescript
handler(async ({ input, context }) => {
  const result = await tryCreateCourse({
    payload: context.payload,
    ...input,
    req: context.req,  // Pass actual request
    overrideAccess: false,  // Respect collection access rules
  });
  if (!result.ok) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: result.error.message,
      cause: result.error,
    });
  }
  return result.value;
});
```

**Why**: The old pattern bypassed access control and passed undefined for req. The new pattern:
- Uses actual request context (`context.req`)
- Respects collection-level access rules (`overrideAccess: false`)
- Properly transforms errors using ORPCError

### 3. OpenAPI Generation Tests

**File**: `packages/paideia-backend/src/modules/courses/tests/openapi-generation.test.ts`

Created 16 tests covering:
- Course Management API paths and methods
- Section Management API paths and methods
- Activity Module Link API paths and methods

### 4. Course Seed Builders

**New directory**: `packages/paideia-backend/src/modules/courses/seeding/`

**Files created**:
- `course-seed-schema.ts` - Zod schemas for course seed data
- `course-section-seed-schema.ts` - Zod schemas for section seed data
- `courses-builder.ts` - Course seed builder with `trySeedCourses()`
- `course-sections-builder.ts` - Section seed builder with `trySeedCourseSections()`
- `course-management-test-seed-data.ts` - Test seed data
- `index.ts` - Barrel exports

**Features**:
- Uses SeedBuilder abstraction pattern
- User-friendly inputs (`createdByEmail`, `courseSlug`, `parentSectionTitle`)
- Automatic ID resolution via maps
- Returns helper functions (`getCourseBySlug`, `getSectionByTitle`)
- Supports hierarchical sections via parent references

### 5. Course Builder Tests

**File**: `packages/paideia-backend/src/modules/courses/tests/courses-builder.test.ts`

**19 passing tests** covering:
- Course creation with all fields
- Section creation with hierarchy
- Relationship mapping
- Helper function behavior

### 6. Unified User Seed Data

**Updated**: `packages/paideia-backend/src/modules/user/seeding/predefined-user-seed-data.ts`

Added instructor and content-manager roles to predefined users:
- `instructor@example.com` - instructor role
- `contentmanager@example.com` - content-manager role

**Removed**: Duplicate user seed data from `course-management-test-seed-data.ts`

## File Structure

```
packages/paideia-backend/src/modules/courses/
├── api/
│   ├── course-management.ts (REFACTORED - 161 lines)
│   ├── course-section-management.ts (REFACTORED - 161 lines)
│   └── course-activity-module-link-management.ts (REFACTORED - 220 lines)
├── seeding/
│   ├── course-seed-schema.ts (NEW - 19 lines)
│   ├── course-section-seed-schema.ts (NEW - 16 lines)
│   ├── courses-builder.ts (NEW - 103 lines)
│   ├── course-sections-builder.ts (NEW - 94 lines)
│   ├── course-management-test-seed-data.ts (NEW - 67 lines)
│   └── index.ts (NEW - 5 lines)
└── tests/
    ├── access-control.test.ts (NEW - 206 lines)
    ├── openapi-generation.test.ts (NEW - 236 lines)
    └── courses-builder.test.ts (NEW - 236 lines)
```

## Usage Pattern

### Seeding Courses

```typescript
// 1. Seed users first
const usersResult = await trySeedUsers({
  payload,
  data: predefinedUserSeedData,
  overrideAccess: true,
  req: undefined,
}).getOrThrow();

// 2. Seed courses
const coursesResult = await trySeedCourses({
  payload,
  data: courseSeedData,
  usersByEmail: usersResult.getUsersByEmail(),
  overrideAccess: true,
  req: undefined,
}).getOrThrow();

// 3. Seed sections
const sectionsResult = await trySeedCourseSections({
  payload,
  data: sectionSeedData,
  coursesBySlug: coursesResult.coursesBySlug,
  overrideAccess: true,
  req: undefined,
}).getOrThrow();
```

### Course Seed Input

```typescript
const courseSeedData = {
  courses: [
    {
      title: "Introduction to CS",
      slug: "cs-101",
      description: "Intro course",
      status: "published",
      createdByEmail: "instructor@example.com",
      tags: ["programming", "beginner"],
    },
  ],
};
```

### Section Seed Input

```typescript
const sectionSeedData = {
  sections: [
    {
      courseSlug: "cs-101",  // References course by slug
      title: "Week 1: Basics",
      description: "Introduction",
      contentOrder: 0,
    },
    {
      courseSlug: "cs-101",
      title: "Week 1.1: Exercises",  // Child section
      parentSectionTitle: "Week 1: Basics",  // References parent by title
      contentOrder: 0,
    },
  ],
};
```

## Tricky Issue: Type Incompatibility

**Problem**: Service functions return types that don't match Payload types exactly (e.g., `gradeTable`, `activityModules` join fields).

**Solution**: Use `as unknown as Type` cast in builder:

```typescript
const course = (await tryCreateCourse({
  ...context,
  data: { ... }
}).getOrThrow()) as unknown as Course;
```

This is acceptable because:
1. The actual runtime data is correct
2. Type mismatch is due to join field population differences
3. Cast is isolated to builder layer

## Lessons Learned

1. **API Handler Pattern**: Always use `context.req` and `overrideAccess: false` to respect collection access rules
2. **Seed Data**: Reuse predefined seed data from existing modules to avoid duplication
3. **Type Casting**: When Payload service return types don't match exactly, use `as unknown as` in builder layer
4. **Testing**: Access control tests should verify both positive and negative cases for each role
5. **OpenAPI Tests**: Create tests alongside API endpoints to ensure spec generation works

## References

- Skill: `.agents/skills/seed-builder-pattern/SKILL.md`
- Related: `packages/paideia-backend/src/shared/seed-builder.ts`
- Pattern: `packages/paideia-backend/src/modules/note/api/note-management.ts`
- Tests: `packages/paideia-backend/src/modules/user/tests/role-access.test.ts`
