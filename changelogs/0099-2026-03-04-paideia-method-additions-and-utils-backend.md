# Paideia Method Additions and Utils Backend Migration

**Date:** March 4, 2026  
**Type:** Infrastructure & Code Quality  
**Impact:** Medium - Completes Paideia class coverage for routes, moves gradebook util to backend

## Overview

This changelog documents additions to the Paideia class to expose internal `try*` functions used by app routes, and the migration of `flattenGradebookCategories` from course-context to the backend package. Routes were calling `paideia.tryX` methods that did not exist; the fix is to add wrapper methods on Paideia that delegate to internal modules via `withPayload`.

## Changes

### 1. Activity Module Update Methods on Paideia

**Problem:** `edit-setting/route.tsx` called `paideia.tryUpdateAssignmentModule`, `paideia.tryUpdatePageModule`, etc., but these methods did not exist on Paideia.

**Solution:** Added the following methods to `packages/paideia-backend/src/paideia.ts`:

- `tryUpdatePageModule`
- `tryUpdateWhiteboardModule`
- `tryUpdateFileModule`
- `tryUpdateAssignmentModule`
- `tryUpdateQuizModule`
- `tryUpdateDiscussionModule`

Each delegates to `activityModuleManagement.tryUpdate*` with `this.withPayload(args)` so callers omit `payload`.

### 2. Quiz Module Management Methods on Paideia

**Problem:** Edit-setting route called `paideia.tryAddQuizResource`, `paideia.tryToggleQuizType`, etc., but Paideia did not import or expose quiz-module-management.

**Solution:**

- Added `import * as quizModuleManagement from "./internal/quiz-module-management"` to paideia.ts
- Added ~30 quiz-related methods:
  - `tryToggleQuizType`, `tryUpdateGlobalTimer`, `tryUpdateNestedQuizTimer`, `tryUpdateGradingConfig`
  - `tryAddQuizResource`, `tryRemoveQuizResource`, `tryUpdateQuizResource`
  - `tryAddQuestion`, `tryRemoveQuestion`, `tryUpdateQuestion`
  - `tryAddPage`, `tryRemovePage`, `tryUpdatePageInfo`, `tryReorderPages`, `tryMoveQuestionToPage`
  - `tryAddNestedQuiz`, `tryRemoveNestedQuiz`, `tryUpdateNestedQuizInfo`, `tryReorderNestedQuizzes`, `tryUpdateContainerSettings`
  - `tryUpdateQuestionScoring`, `tryUpdateQuizInfo`
  - Question-type helpers: `tryUpdateMultipleChoiceQuestion`, `tryUpdateChoiceQuestion`, `tryUpdateShortAnswerQuestion`, `tryUpdateLongAnswerQuestion`, `tryUpdateFillInTheBlankQuestion`, `tryUpdateRankingQuestion`, `tryUpdateSingleSelectionMatrixQuestion`, `tryUpdateMultipleSelectionMatrixQuestion`

### 3. User Registration Methods on Paideia

**Problem:** `registration.tsx` called `paideia.tryRegisterFirstUser` and `paideia.tryRegisterUser`, which did not exist.

**Solution:** Added both methods to Paideia, delegating to `userManagement.tryRegisterFirstUser` and `userManagement.tryRegisterUser` with `this.withPayload(args)`.

### 4. Edit-Setting Route Cleanup

- Removed broken imports of `tryUpdate*` and quiz `try*` from `@paideia/paideia-backend` (these were never exported from the package index)
- Updated all module update actions to use `paideia.tryUpdate*` instead of direct `try*` calls with `payload`
- Updated all quiz actions to use `paideia.try*`; removed unused `payload` variables

### 5. flattenGradebookCategories Moved to Backend

**Problem:** `flattenGradebookCategories` lived in `server/contexts/course-context.ts`; it is a pure util and belongs in the backend.

**Solution:**

- Created `packages/paideia-backend/src/utils/flatten-gradebook-categories.ts`
- Exported `flattenGradebookCategories` and `FlattenedCategory` from package index
- Updated `course-context.ts` to import from `@paideia/paideia-backend` and re-export `FlattenedCategory` for consumers
- Added `flatten-gradebook-categories.test.ts` with tests for single category, nested hierarchy, and skipping non-category items

## Pattern: Adding Paideia Methods

When a route calls `paideia.tryX` and receives "Property 'tryX' does not exist on type 'Paideia'":

1. Locate the internal function (e.g. `internal/user-management.ts`, `internal/activity-module-management.ts`, `internal/quiz-module-management.ts`)
2. Add a method to Paideia that:
   - Takes `args: Omit<Parameters<typeof internalModule.tryX>[0], "payload">`
   - Returns `internalModule.tryX(this.withPayload(args))`
3. Import the internal module if not already imported

## Files Changed

### Modified

- `packages/paideia-backend/src/paideia.ts` - Added quiz-module-management import and ~40 new methods
- `packages/paideia-backend/src/index.ts` - Exported `flattenGradebookCategories`, `FlattenedCategory`
- `apps/paideia/app/routes/user/module/edit-setting/route.tsx` - Switched to paideia methods, removed broken imports
- `apps/paideia/server/contexts/course-context.ts` - Import from backend, re-export type, removed local function

### New

- `packages/paideia-backend/src/utils/flatten-gradebook-categories.ts`
- `packages/paideia-backend/src/utils/flatten-gradebook-categories.test.ts`

## References

- Skill: `.cursor/skills/paideia-expose-internal-functions/SKILL.md` (created)
- Internal function pattern: `changelogs/0073-2025-11-27-internal-function-pattern-standardization.md`
