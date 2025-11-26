# Course Module Settings v2 and Timing Fields Migration

**Date:** 2025-11-26  
**Type:** Feature Enhancement & Data Model Refactoring  
**Impact:** High - Moves course-specific timing and attempt fields from activity modules to course module settings, enabling per-course configuration

## Overview

This changelog documents the migration of timing and attempt-related fields (`dueDate`, `maxAttempts`, `allowLateSubmissions`) from the assignments and quizzes collections to course module settings v2. This change enables the same activity module to have different due dates, attempt limits, and submission windows per course, providing greater flexibility for instructors reusing modules across multiple courses.

## Problem Statement

Previously, timing and attempt fields (`dueDate`, `maxAttempts`, `allowLateSubmissions`) were stored directly on assignment and quiz entities. This meant that:

1. **No Per-Course Customization**: The same assignment module couldn't have different due dates when used in different courses
2. **Inflexible Reuse**: Instructors couldn't reuse assignment templates with course-specific timing
3. **Redundant Fields**: Fields that should be course-specific were stored at the module level
4. **Inconsistent Model**: Course module settings v1 already had `dueDate` for assignments/quizzes, creating confusion about which field to use

## Solution

Migrated timing and attempt fields to course module settings v2, which already provides a versioned JSON schema for course-specific module configuration. This aligns the data model with the intended use case: course-specific settings belong in course module settings, not on the activity module itself.

## Technical Implementation

### 1. Course Module Settings v2 Schema

**Files Created**:
- `server/json/course-module-settings/types.v2.ts` - Standalone v2 type definitions (no imports from v1)
- Updated `server/json/course-module-settings/version-resolver.ts` - Added v2 support and migration

**Schema Structure** (v2):
```typescript
{
  version: "v2",
  settings: {
    type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion" | "file",
    name?: string,
    // Type-specific fields...
  }
}
```

### 2. Assignment Settings v2

**Fields**:
- `allowSubmissionsFrom` - ISO date string (preserved from v1)
- `dueDate` - ISO date string (preserved from v1)
- `cutoffDate` - ISO date string (preserved from v1)
- `maxAttempts` - **NEW**: Maximum number of submission attempts allowed
- `allowLateSubmissions` - **REMOVED**: CutoffDate > dueDate implies late submissions are allowed

**Rationale**: When `cutoffDate` is set later than `dueDate`, it inherently allows late submissions. The separate `allowLateSubmissions` flag was redundant.

### 3. Quiz Settings v2

**Fields**:
- `openingTime` - ISO date string (preserved from v1)
- `closingTime` - ISO date string (preserved from v1)
- `maxAttempts` - **NEW**: Maximum number of attempt attempts allowed
- `allowLateSubmissions` - **REMOVED**: ClosingTime is strict - no late submissions allowed

**Rationale**: Quiz closing times are strict deadlines. If a closing time is set, the entire class must align with this timestamp and no late submissions are allowed.

### 4. File Settings v2

**Fields**:
- `name` - Optional custom name for the file module (base settings)

**New Module Type**: File modules now have dedicated settings support in v2.

### 5. Version Migration

**Migration Function**: `migrateV1ToV2`
- Automatically converts v1 settings to v2 when accessed
- Preserves all v1 fields for assignments and quizzes
- Adds `maxAttempts: undefined` for assignments and quizzes
- Passes through other module types unchanged
- Ensures backward compatibility

**Version Resolver**: `tryResolveCourseModuleSettingsToLatest`
- Checks for v2 first (current version)
- Falls back to v1 migration if needed
- Throws error for invalid formats
- Returns `LatestCourseModuleSettings` type alias (points to v2)

### 6. Collection Schema Changes

**Assignments Collection** (`server/collections/assignments.ts`):
- **Removed Fields**:
  - `dueDate` (date field)
  - `maxAttempts` (number field, default: 1)
  - `allowLateSubmissions` (checkbox field, default: false)
- **Removed Index**: `dueDate` index (no longer needed)
- **Preserved Fields**: All other assignment fields remain unchanged

**Quizzes Collection** (`server/collections/quizzes.ts`):
- **Removed Fields**:
  - `dueDate` (date field)
  - `maxAttempts` (number field, default: 1)
  - `allowLateSubmissions` (checkbox field, default: false)
- **Removed Index**: `dueDate` index (no longer needed)
- **Preserved Fields**: All other quiz fields remain unchanged

**Database Migration Required**: 
- Columns must be dropped from `assignments` and `quizzes` tables
- Indexes must be dropped
- Migration should be non-breaking and backward compatible

### 7. Internal Function Updates

**File**: `server/internal/activity-module-management.ts`

**Updated Type Definitions**:
- `CreateAssignmentModuleArgs`: Removed `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `CreateQuizModuleArgs`: Removed `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `UpdateAssignmentModuleArgs`: Removed `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `UpdateQuizModuleArgs`: Removed `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `Assignment` type: Removed `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `Quiz` type: Removed `dueDate`, `maxAttempts`, `allowLateSubmissions`

**Updated Functions**:
- `tryCreateAssignmentModule`: Removed field handling for removed fields
- `tryCreateQuizModule`: Removed field handling for removed fields
- `tryUpdateAssignmentModule`: Removed field handling for removed fields
- `tryUpdateQuizModule`: Removed field handling for removed fields
- Result building updated to exclude removed fields

**File**: `server/internal/course-activity-module-link-management.ts`

**Updated Functions**:
- `tryUpdateCourseModuleSettings`: 
  - Added validation for `maxAttempts` (must be >= 1 if provided)
  - Updated type references from `CourseModuleSettingsV1` to `LatestCourseModuleSettings`
  - Validation applies to both AssignmentSettings and QuizSettings
- `tryGetCourseModuleSettings`: Updated return type to `LatestCourseModuleSettings`
- `tryCreateCourseActivityModuleLink`: Updated to accept `LatestCourseModuleSettings`

**Type Updates**:
- All function signatures updated to use `LatestCourseModuleSettings` instead of `CourseModuleSettingsV1`
- Import changed from `course-module-settings-version-resolver` to use `LatestCourseModuleSettings` type alias

### 8. Frontend Schema Updates

**File**: `app/utils/activity-module-schema.ts`

**Schema Changes**:
- `assignmentModuleSchema`: Removed `assignmentDueDate`, `assignmentMaxAttempts`, `assignmentAllowLateSubmissions`
- `quizModuleSchema`: Removed `quizDueDate`, `quizMaxAttempts`

**Form Value Types**:
- `AssignmentModuleFormValues`: Removed `assignmentDueDate`, `assignmentMaxAttempts`, `assignmentAllowLateSubmissions`
- `QuizModuleFormValues`: Removed `quizDueDate`, `quizMaxAttempts`

**Transform Functions**:
- `transformFormValues`: Removed field transformations for removed fields
- `transformToActivityData`: Removed field mappings for removed fields
- `getInitialFormValuesForType`: Removed default values for removed fields

**File**: `app/routes/user/module/edit-setting.tsx`

**Updated Actions**:
- `updateQuizAction`: Removed `dueDate` and `maxAttempts` from `tryUpdateQuizModule` call
- Form initialization: Removed fields when loading existing module data

## Data Migration Strategy

### Automatic Migration

**v1 to v2 Migration**:
- Existing v1 settings are automatically migrated to v2 when accessed via `tryResolveCourseModuleSettingsToLatest`
- Migration preserves all existing v1 fields
- Adds `maxAttempts: undefined` for assignments and quizzes
- No data loss occurs during migration

### Database Migration

**Required Steps**:
1. Run Payload migration to remove columns: `bun run payload migrate`
2. Regenerate Payload types: `bun run payload generate:types`
3. Existing course module settings will be automatically migrated from v1 to v2 on access

**Migration Considerations**:
- Columns are removed from `assignments` and `quizzes` tables
- Existing data in these columns will be lost (should be migrated to course module settings first if needed)
- Indexes are removed
- Migration is non-breaking for course module settings (v1 → v2 migration is automatic)

## Validation Updates

**Assignment Settings Validation** (`tryUpdateCourseModuleSettings`):
- `allowSubmissionsFrom` < `dueDate` (if both provided)
- `dueDate` < `cutoffDate` (if both provided)
- `allowSubmissionsFrom` < `cutoffDate` (if both provided)
- `maxAttempts` >= 1 (if provided)

**Quiz Settings Validation**:
- `openingTime` < `closingTime` (if both provided)
- `maxAttempts` >= 1 (if provided)

## Type Safety

### Standalone v2 Types

**Design Decision**: v2 types are completely separate from v1 (following pattern from `raw-quiz-config.types.v2.ts`)

**Benefits**:
- No circular dependencies
- Clear version boundaries
- Easy to understand version differences
- Follows established pattern in codebase

**Type Structure**:
- `server/json/course-module-settings/types.ts` - v1 types only
- `server/json/course-module-settings/types.v2.ts` - v2 types only (standalone)
- `server/json/course-module-settings/version-resolver.ts` - Imports from both, exports `LatestCourseModuleSettings`

### Type Aliases

**Version Resolver Exports**:
- `LatestCourseModuleSettings` - Points to `CourseModuleSettingsV2`
- Used throughout codebase for current version

**Backward Compatibility**:
- v1 types remain available for migration and legacy code
- Type aliases maintain compatibility where needed

## Breaking Changes

### API Changes

**Activity Module Management**:
- `tryCreateAssignmentModule`: No longer accepts `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `tryCreateQuizModule`: No longer accepts `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `tryUpdateAssignmentModule`: No longer accepts `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `tryUpdateQuizModule`: No longer accepts `dueDate`, `maxAttempts`, `allowLateSubmissions`

**Result Types**:
- `AssignmentModuleResult`: No longer includes `dueDate`, `maxAttempts`, `allowLateSubmissions`
- `QuizModuleResult`: No longer includes `dueDate`, `maxAttempts`, `allowLateSubmissions`

### Frontend Changes

**Form Schemas**:
- Assignment forms no longer include `assignmentDueDate`, `assignmentMaxAttempts`, `assignmentAllowLateSubmissions`
- Quiz forms no longer include `quizDueDate`, `quizMaxAttempts`

**Migration Path**:
- These fields should now be configured via course module settings (course-specific)
- User module edit forms no longer show these fields
- Course module edit forms should be used for timing configuration

## Usage Examples

### Creating Assignment Module (No Timing Fields)

```typescript
const result = await tryCreateAssignmentModule({
  payload,
  title: "Weekly Reflection",
  description: "Reflect on this week's learning",
  userId: 1,
  instructions: "Write a 500-word reflection",
  requireTextSubmission: true,
  requireFileSubmission: false,
  // dueDate, maxAttempts, allowLateSubmissions removed
});
```

### Setting Course-Specific Timing (v2)

```typescript
const settingsResult = await tryUpdateCourseModuleSettings({
  payload,
  linkId: 123,
  settings: {
    version: "v2",
    settings: {
      type: "assignment",
      name: "Weekly Reflection - Week 1",
      allowSubmissionsFrom: "2025-11-01T00:00:00Z",
      dueDate: "2025-11-07T23:59:59Z",
      cutoffDate: "2025-11-10T23:59:59Z",
      maxAttempts: 3, // NEW in v2
    },
  },
  req: request,
});
```

### Setting Quiz Attempt Limits (v2)

```typescript
const settingsResult = await tryUpdateCourseModuleSettings({
  payload,
  linkId: 456,
  settings: {
    version: "v2",
    settings: {
      type: "quiz",
      name: "Mid-term Quiz",
      openingTime: "2025-11-15T09:00:00Z",
      closingTime: "2025-11-15T17:00:00Z",
      maxAttempts: 2, // NEW in v2
    },
  },
  req: request,
});
```

## Design Decisions

### Why Remove `allowLateSubmissions`?

**Assignment Settings**:
- `cutoffDate > dueDate` inherently allows late submissions
- No need for separate boolean flag
- Simpler data model with fewer fields to maintain

**Quiz Settings**:
- Quiz closing times are strict deadlines
- If `closingTime` is set, no late submissions allowed
- Consistent behavior across all quiz instances

### Why Move Fields to Course Settings?

**Separation of Concerns**:
- Activity modules are reusable templates
- Course-specific timing belongs in course module settings
- Enables same module with different timing per course

**Data Model Alignment**:
- Course module settings already existed for this purpose
- v1 already had `dueDate` for assignments/quizzes
- Moving all timing fields creates consistency

### Why Add `maxAttempts` to v2?

**Feature Request**:
- Instructors need to control attempt limits per course
- Same quiz might allow 1 attempt in Course A, 3 attempts in Course B
- Course-specific configuration is the correct place for this

## Related Files

### Schema & Types
- `server/json/course-module-settings/types.ts` - v1 types
- `server/json/course-module-settings/types.v2.ts` - v2 types (standalone)
- `server/json/course-module-settings/version-resolver.ts` - Version migration

### Collections
- `server/collections/assignments.ts` - Removed timing fields
- `server/collections/quizzes.ts` - Removed timing fields
- `server/collections/course-activity-module-links.ts` - Settings storage

### Internal Functions
- `server/internal/activity-module-management.ts` - Updated create/update functions
- `server/internal/course-activity-module-link-management.ts` - Updated settings functions

### Frontend
- `app/utils/activity-module-schema.ts` - Updated schemas and form types
- `app/routes/user/module/edit-setting.tsx` - Updated form actions

## Testing Recommendations

### Backend Testing

**Activity Module Management**:
1. Test creating assignment module without timing fields
2. Test creating quiz module without timing fields
3. Test updating assignment module (verify removed fields are ignored)
4. Test updating quiz module (verify removed fields are ignored)
5. Verify result types don't include removed fields

**Course Module Settings**:
1. Test creating link with v2 settings including `maxAttempts`
2. Test updating settings with `maxAttempts` validation (must be >= 1)
3. Test v1 to v2 automatic migration
4. Test date validation with `maxAttempts` present
5. Test FileSettings creation and retrieval

**Version Migration**:
1. Test v1 settings automatically migrate to v2
2. Test v2 settings pass through unchanged
3. Test invalid version formats throw errors
4. Test null/undefined settings handling

### Frontend Testing

**Form Schemas**:
1. Test assignment form no longer shows timing fields
2. Test quiz form no longer shows timing/attempt fields
3. Test form submission without removed fields
4. Test form initialization with existing modules

**Course Module Settings Forms**:
1. Test course module edit form includes `maxAttempts` for assignments/quizzes
2. Test validation for `maxAttempts` (must be >= 1)
3. Test date validation with `maxAttempts` present

## Migration Checklist

### Required Steps

1. **Database Migration**:
   - [ ] Run `bun run payload migrate` to remove columns
   - [ ] Verify columns removed from `assignments` and `quizzes` tables
   - [ ] Verify indexes removed

2. **Type Generation**:
   - [ ] Run `bun run payload generate:types`
   - [ ] Verify Payload types updated

3. **Data Migration** (if needed):
   - [ ] Migrate existing `dueDate`, `maxAttempts`, `allowLateSubmissions` from assignments/quizzes to course module settings
   - [ ] Create migration script if historical data needs preservation

4. **Testing**:
   - [ ] Test creating new assignment/quiz modules
   - [ ] Test updating existing modules
   - [ ] Test course module settings with v2 format
   - [ ] Test v1 to v2 automatic migration

## Future Enhancements

This architecture supports:
- Adding more timing-related fields per module type
- Implementing time-based access control based on settings
- Adding attempt tracking and enforcement
- Course-level default settings for timing fields
- Bulk settings update for multiple module instances

## Summary

The migration of timing and attempt fields to course module settings v2 provides:

- ✅ **Better Data Model**: Course-specific fields belong in course settings
- ✅ **Flexibility**: Same module with different timing per course
- ✅ **Consistency**: All course-specific settings in one place
- ✅ **Backward Compatibility**: Automatic v1 to v2 migration
- ✅ **Type Safety**: Standalone v2 types with clear version boundaries
- ✅ **Validation**: Enhanced validation including `maxAttempts` checks

The feature is **production-ready** after running the required database migration and type generation commands.

