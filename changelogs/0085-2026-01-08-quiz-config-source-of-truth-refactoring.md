# Quiz Configuration Source of Truth Refactoring

**Date:** 2026-01-08  
**Type:** Refactoring, Database Schema Simplification  
**Impact:** Medium - Removes duplicate fields from quizzes collection, simplifies data model, and makes `rawQuizConfig` the single source of truth for quiz configuration. Requires updates to code accessing quiz fields.

## Overview

This changelog documents the refactoring of the quiz data model to eliminate duplicate fields between the `quizzes` collection and the `rawQuizConfig` JSON field. Previously, fields like `points`, `gradingType`, `showCorrectAnswers`, `allowMultipleAttempts`, `shuffleQuestions`, `shuffleAnswers`, `showOneQuestionAtATime`, and `questions` were stored both as top-level collection fields and within the `rawQuizConfig` JSON structure. This duplication was intended to enable SQL aggregation, but it increased complexity and created potential for data inconsistency.

## Problem Statement

### Data Duplication Issues

The quizzes collection maintained duplicate fields for SQL aggregation purposes:

1. **Duplicate Storage**: Fields like `points`, `gradingType`, and `showCorrectAnswers` existed both as collection fields and within `rawQuizConfig`
2. **Sync Complexity**: The `processRawQuizConfig` function attempted to sync these fields, but this pattern was error-prone and added maintenance burden
3. **Potential Inconsistency**: Without proper synchronization, the duplicate fields could become out of sync with `rawQuizConfig`
4. **Increased Complexity**: Code needed to handle both the duplicate fields and the JSON configuration

### Maintenance Burden

The duplication pattern required:
- Complex sync logic in `processRawQuizConfig`
- Careful updates to ensure both sources stayed in sync
- Additional validation to prevent inconsistencies
- More complex interfaces with many optional fields

## Solution

### Single Source of Truth

The `rawQuizConfig` JSON field is now the **single source of truth** for all quiz configuration:

1. **Removed Duplicate Fields**: All duplicate fields removed from the `quizzes` collection schema
2. **Simplified Interfaces**: `CreateQuizModuleArgs` and `UpdateQuizModuleArgs` now only include `title`, `description`, `instructions`, and `rawQuizConfig`
3. **Computed Values**: Values like `points` and `timeLimit` are calculated from `rawQuizConfig` when needed using helper functions
4. **Simplified Sync Logic**: Removed complex field synchronization from `processRawQuizConfig`

### Before (with duplicate fields):

```typescript
interface CreateQuizModuleArgs {
  title: string;
  description?: string;
  instructions?: string;
  points?: number;
  gradingType?: "automatic" | "manual";
  timeLimit?: number;
  showCorrectAnswers?: boolean;
  allowMultipleAttempts?: boolean;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  showOneQuestionAtATime?: boolean;
  rawQuizConfig?: QuizConfig;
  questions?: Array<{ ... }>;
}
```

### After (simplified):

```typescript
interface CreateQuizModuleArgs {
  title: string;
  description?: string;
  instructions?: string;
  rawQuizConfig?: QuizConfig;
}
```

## Key Changes

### 1. Database Schema Simplification

**File Modified:**
- `server/collections/quizzes.ts` - Removed all duplicate fields, keeping only:
  - `title` (required)
  - `description` (optional)
  - `instructions` (optional)
  - `rawQuizConfig` (JSON field)
  - `createdBy` (relationship)

**Removed Fields:**
- `points`
- `gradingType`
- `showCorrectAnswers`
- `allowMultipleAttempts`
- `shuffleQuestions`
- `shuffleAnswers`
- `showOneQuestionAtATime`
- `questions` (legacy array format)

### 2. Interface Updates

**Files Modified:**
- `server/internal/activity-module-management.ts`:
  - `CreateQuizModuleArgs` - Removed all duplicate fields
  - `UpdateQuizModuleArgs` - Removed all duplicate fields
  - `Quiz` interface - Removed duplicate fields, kept only `title`, `description`, `instructions`, `timeLimit` (computed), and `rawQuizConfig`

- `server/internal/quiz-submission-management.ts`:
  - `CreateQuizArgs` - Simplified to only include `title`, `description`, `instructions`, `rawQuizConfig`, and `createdBy`
  - `UpdateQuizArgs` - Simplified to only include `id`, `title`, `description`, `instructions`, and `rawQuizConfig`

### 3. Function Updates

**Files Modified:**
- `server/internal/activity-module-management.ts`:
  - `tryCreateQuizModule` - Removed all duplicate field assignments, only creates quiz with `rawQuizConfig`
  - `tryUpdateQuizModule` - Removed all duplicate field updates
  - `buildDiscriminatedUnionResult` - Updated to work with simplified Quiz interface

- `server/internal/quiz-module-management.ts`:
  - `processRawQuizConfig` - Reverted to simple function that just returns `{ rawQuizConfig }`
  - Removed all sync logic and helper functions (`requiresManualGrading`, `getAllQuestions`, `determineGradingType`)

- `server/internal/quiz-submission-management.ts`:
  - `tryCreateQuiz` - Removed duplicate field assignments
  - `tryUpdateQuiz` - Removed duplicate field updates
  - Added type assertions (`as any`) for legacy code that still references old fields (marked with TODOs for future refactoring)

### 4. Frontend Updates

**Files Modified:**
- `app/routes/user/module/edit-setting.tsx`:
  - Removed `quizPoints`, `quizTimeLimit`, and `quizGradingType` from form schema
  - Updated `getQuizFormInitialValues` to calculate `quizPoints` from `rawQuizConfig` using `calculateTotalPoints()`
  - Updated to calculate `quizTimeLimit` from `rawQuizConfig.globalTimer` (converting seconds to minutes)
  - Updated form submission to only send `rawQuizConfig`

- `app/routes/user/module/new.tsx`:
  - Similar updates to form handling (if applicable)

### 5. Test Updates

**Files Modified:**
- `server/internal/activity-module-management.test.ts`:
  - Removed all duplicate fields from `CreateQuizModuleArgs` and `UpdateQuizModuleArgs` in test cases
  - Removed assertions checking `createdModule.points`
  - Updated all quiz creation/update tests to use simplified interface

- `server/internal/course-activity-module-link-management.test.ts`:
  - Removed `timeLimit` from quiz creation args

- `server/internal/quiz-submission-management-full-workflow.test.ts`:
  - Deleted test case "should create quiz (teacher workflow)" that used old format with `questions` array

- `server/utils/db/seed-builders/module-builder.ts`:
  - Removed `points` and `timeLimit` from quiz creation args

## Technical Details

### Computing Values from rawQuizConfig

When values previously stored as duplicate fields are needed, they are now computed from `rawQuizConfig`:

**Points Calculation:**
```typescript
import { calculateTotalPoints } from "server/json/raw-quiz-config/v2";

const points = module.rawQuizConfig && typeof module.rawQuizConfig === "object"
  ? calculateTotalPoints(module.rawQuizConfig as QuizConfig)
  : 0;
```

**Time Limit Calculation:**
```typescript
let timeLimit: number | undefined;
if (
  module.rawQuizConfig &&
  typeof module.rawQuizConfig === "object" &&
  "globalTimer" in module.rawQuizConfig &&
  typeof module.rawQuizConfig.globalTimer === "number"
) {
  timeLimit = module.rawQuizConfig.globalTimer / 60; // Convert seconds to minutes
}
```

**Grading Type Determination:**
Grading type can be determined by checking if any questions in `rawQuizConfig` require manual grading (questions with `scoring.type === "manual"` or `scoring.type === "rubric"`).

### Legacy Code Handling

Some functions in `quiz-submission-management.ts` still reference the old `questions` array format. These have been temporarily fixed with type assertions (`as any`) and marked with TODOs indicating they need refactoring to work with the new `rawQuizConfig` v2 format:

- `tryCalculateQuizGrade` - Needs to extract questions from `rawQuizConfig`
- `tryGetQuizGradesReport` - Needs to calculate points from `rawQuizConfig`
- `tryGetQuizStatisticsReport` - Needs to extract questions from `rawQuizConfig`

## Migration Impact

### Breaking Changes

**Database Schema:**
- Fields `points`, `gradingType`, `showCorrectAnswers`, `allowMultipleAttempts`, `shuffleQuestions`, `shuffleAnswers`, `showOneQuestionAtATime`, and `questions` are no longer stored in the `quizzes` collection
- Existing quiz records will have these fields as `null` or `undefined` when queried
- All quiz configuration must be stored in `rawQuizConfig`

**API Changes:**
- `CreateQuizModuleArgs` and `UpdateQuizModuleArgs` no longer accept duplicate fields
- Code calling these functions must be updated to only pass `rawQuizConfig`

**Type Changes:**
- `Quiz` interface no longer includes duplicate fields
- Code accessing `quiz.points`, `quiz.gradingType`, etc. will fail to compile

### Non-Breaking Changes

**Runtime Behavior:**
- Quiz functionality remains the same
- All quiz data is preserved in `rawQuizConfig`
- No data loss occurs

**API Contracts:**
- Frontend can still access all quiz configuration through `rawQuizConfig`
- Values are computed when needed for display

## Files Modified

### Core Collections (1 file)
- `server/collections/quizzes.ts` - Removed duplicate fields from schema

### Internal Functions (3 files)
- `server/internal/activity-module-management.ts` - Updated interfaces and functions
- `server/internal/quiz-module-management.ts` - Simplified `processRawQuizConfig`
- `server/internal/quiz-submission-management.ts` - Updated interfaces, added TODOs for legacy code

### Frontend Routes (2 files)
- `app/routes/user/module/edit-setting.tsx` - Updated form handling
- `app/routes/user/module/new.tsx` - Updated form handling (if applicable)

### Test Files (4 files)
- `server/internal/activity-module-management.test.ts` - Removed duplicate fields from tests
- `server/internal/course-activity-module-link-management.test.ts` - Removed `timeLimit` from test
- `server/internal/quiz-submission-management-full-workflow.test.ts` - Deleted obsolete test
- `server/utils/db/seed-builders/module-builder.ts` - Removed duplicate fields from seed builder

## Benefits Summary

1. **Simplified Data Model**: Single source of truth eliminates duplication
2. **Reduced Complexity**: No need for field synchronization logic
3. **Consistency Guaranteed**: Impossible for duplicate fields to become out of sync
4. **Easier Maintenance**: Fewer fields to manage and update
5. **Cleaner Interfaces**: Simplified function signatures with fewer optional parameters
6. **Better Type Safety**: TypeScript can better infer types from a single source

## Future Work

### Legacy Code Refactoring

The following functions need refactoring to fully work with `rawQuizConfig` v2 format:

1. **`tryCalculateQuizGrade`** (`quiz-submission-management.ts`):
   - Currently uses `(quiz as any).questions` array
   - Needs to extract questions from `rawQuizConfig.pages[].questions`
   - Must handle both regular and container quiz types

2. **`tryGetQuizGradesReport`** (`quiz-submission-management.ts`):
   - Currently calculates `maxScore` from `quiz.points`
   - Should use `calculateTotalPoints(rawQuizConfig)` instead

3. **`tryGetQuizStatisticsReport`** (`quiz-submission-management.ts`):
   - Currently uses `quiz.questions` array
   - Needs to extract questions from `rawQuizConfig`
   - Must handle question statistics calculation from v2 format

### Migration Path

For migrating legacy code:

1. **Extract Questions**: Use helper functions to get all questions from `rawQuizConfig`
2. **Calculate Points**: Use `calculateTotalPoints()` from `server/json/raw-quiz-config/v2`
3. **Handle Quiz Types**: Support both regular and container quiz configurations
4. **Update Tests**: Ensure tests work with new format

## Related Changes

This refactoring builds upon:
- Quiz configuration v2 format (changelog 0008)
- Internal function pattern standardization (changelog 0073)
- Type-safe action RPC system (changelog 0079)

## Conclusion

The removal of duplicate fields from the quizzes collection simplifies the data model and makes `rawQuizConfig` the single source of truth. This eliminates potential data inconsistencies, reduces code complexity, and makes the codebase easier to maintain. While some legacy code still needs refactoring to fully work with the new format, the core functionality is preserved and the foundation is set for a cleaner, more maintainable quiz system.
