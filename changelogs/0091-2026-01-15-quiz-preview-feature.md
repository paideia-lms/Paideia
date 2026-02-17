# Quiz Preview Feature

**Date:** 2026-01-15  
**Type:** Feature Addition, UI Enhancement  
**Impact:** Medium - Adds instructor preview capability for quizzes

## Overview

This update adds a quiz preview feature that allows instructors to preview quizzes before students take them. Preview attempts are separate from real attempts, cannot be submitted, and are excluded from normal quiz submission displays. The feature also includes UI improvements to alert instructors when quizzes have no content.

## Problem Statement

Instructors needed a way to preview quizzes to:
- Test quiz functionality and question flow
- Verify quiz settings and timing
- Check question formatting and content
- Ensure quizzes are ready for students

Previously, instructors had to create test student accounts or use their own enrollment to test quizzes, which was cumbersome and could interfere with their actual quiz attempts.

## Key Changes

### 1. Database Schema Update

**File:** `server/collections/quiz-submissions.ts`
- Added `isPreview: boolean` field with `defaultValue: false`
- Preview attempts are marked with `isPreview: true`
- Preview attempts use `attemptNumber: 999999` (internal-only, doesn't conflict with real attempts)

**Migration:** `src/migrations/20260115_135441.ts`
- Adds `is_preview` column to `quiz_submissions` table
- Defaults to `false` for existing records

### 2. Internal Functions

**File:** `server/internal/quiz-submission-management.ts`

#### New Function: `tryStartPreviewQuizAttempt`
- Creates a preview quiz attempt for instructors
- Deletes any existing preview attempts for the user/module before creating a new one
- Sets `isPreview: true`, `status: "in_progress"`, `attemptNumber: 999999`
- Does not schedule auto-submit jobs (previews don't auto-submit)
- Returns normalized submission data

#### Updated Functions:
- **`tryCheckInProgressSubmission`**: Excludes preview attempts when checking for in-progress submissions
- **`tryStartQuizAttempt`**: Excludes preview attempts when checking for existing in-progress attempts
- **`tryMarkQuizAttemptAsComplete`**: Explicitly rejects preview attempts (previews cannot be marked as complete)
- **`tryListQuizSubmissions`**: Added `includePreview?: boolean` parameter (defaults to `false`) to control whether previews are included in listings
- **Inside-quiz operations** (`tryAnswerQuizQuestion`, `tryRemoveAnswerFromQuizQuestion`, `tryFlagQuizQuestion`, `tryUnflagQuizQuestion`): Work normally with preview attempts (previews can answer questions, flag, etc.)

**File:** `server/tasks/auto-submit-quiz.ts`
- Added check to skip auto-submission for preview attempts

### 3. Context Updates

**File:** `server/contexts/course-module-context.ts`
- Updated `tryListQuizSubmissions` call to include `includePreview: true` so previews can be retrieved when needed
- Kept preview submissions in `userSubmissions` array (so they can be found via `viewSubmission` param)
- Filtered previews out of:
  - `userSubmission` (latest submission logic)
  - `quizSubmissionsForDisplay` (submission history)
  - `activeSubmission` (in-progress attempts)

### 4. Route Actions

**File:** `app/routes/course/module.$id/route.tsx`

#### New Action: `previewQuizAction`
- Checks preview permission from `courseModuleContext.permissions.quiz.canPreview`
- Calls `tryStartPreviewQuizAttempt` with proper parameters
- Redirects to quiz view with `viewSubmission` set to preview submission ID
- Exported as `usePreviewQuiz` hook for UI components

### 5. UI Components

#### Quiz Instructions View
**File:** `app/routes/course/module.$id/components/quiz/quiz-instructions-view.tsx`
- Added "Preview Quiz" button (visible when `canPreview` permission is true)
- Added yellow alert for regular quizzes with no questions
- Added yellow alert for container quizzes with no nested quizzes
- Alerts help instructors identify quizzes that need content

#### Quiz Submission Modal
**File:** `app/routes/course/module.$id/components/quiz/quiz-submission-modal.tsx`
- Disabled submit button when submission is a preview attempt
- Added tooltip explaining "Preview attempts cannot be submitted"
- Prevents accidental submission of preview attempts

#### Quiz Module View
**File:** `app/routes/course/module.$id/route.tsx`
- Added blue alert above quiz component when viewing a preview attempt
- Alert message: "You are currently previewing this quiz. This is a test attempt that will not be saved or graded. You can answer questions and explore the quiz, but you cannot submit it."

#### Nested Quiz Selector
**File:** `app/routes/course/module.$id/components/quiz/nested-quiz-selector.tsx`
- Added yellow alert for nested quizzes with no questions
- Helps instructors identify which nested quizzes need content

### 6. Testing

**File:** `server/internal/quiz-submission-management-preview.test.ts` (new)
- Comprehensive test suite for preview functionality:
  - Preview attempt creation with correct flags
  - Old preview deletion when starting new preview
  - Preview doesn't block real attempts
  - Preview can answer questions normally
  - Preview cannot be marked as complete
  - Preview excluded from listings by default
  - Preview included when `includePreview: true`

**File:** `server/internal/quiz-submission-management-prevent-duplicate-attempts.test.ts`
- Updated to verify preview attempts don't interfere with real attempt prevention

## Technical Details

### Preview Attempt Characteristics

1. **Database**: `isPreview: true`, `attemptNumber: 999999`
2. **Behavior**: Can answer questions, flag questions, navigate normally
3. **Restrictions**: Cannot be marked as complete, cannot be submitted
4. **Visibility**: Excluded from submission history and normal displays
5. **Lifecycle**: Deleted when a new preview is started (one preview per user/module at a time)

### Permission Check

Preview permission is checked via `courseModuleContext.permissions.quiz.canPreview`, which is calculated based on:
- User role (instructors/teachers can preview)
- Course enrollment role
- Module access permissions

### Preview vs Real Attempts

| Feature | Preview Attempt | Real Attempt |
|---------|----------------|--------------|
| Can answer questions | ✅ Yes | ✅ Yes |
| Can flag questions | ✅ Yes | ✅ Yes |
| Can navigate pages | ✅ Yes | ✅ Yes |
| Can be submitted | ❌ No | ✅ Yes |
| Can be marked complete | ❌ No | ✅ Yes |
| Auto-submit on timer | ❌ No | ✅ Yes |
| Visible in history | ❌ No | ✅ Yes |
| Blocks new attempts | ❌ No | ✅ Yes |
| Attempt number | 999999 | 1, 2, 3, ... |

## User Experience Impact

### For Instructors

- **Preview Button**: Easy access to preview quizzes from instructions view
- **Preview Mode Alert**: Clear indication when viewing a preview attempt
- **Disabled Submit**: Submit button is disabled with tooltip explanation
- **Content Alerts**: Warnings for quizzes with no questions/nested quizzes
- **Seamless Experience**: Preview attempts work like real attempts (answering, flagging, navigation)

### For Students

- **No Impact**: Preview attempts are completely invisible to students
- **No Interference**: Preview attempts don't affect attempt limits or in-progress checks

## Testing Considerations

### Key Test Scenarios

1. **Preview Creation**:
   - Instructor can start preview
   - Old preview is deleted when starting new preview
   - Preview has correct flags (`isPreview: true`, `attemptNumber: 999999`)

2. **Preview Functionality**:
   - Can answer questions
   - Can flag/unflag questions
   - Can navigate between pages
   - Cannot submit or mark as complete

3. **Preview Isolation**:
   - Preview doesn't block real attempts
   - Preview not visible in submission history
   - Preview not counted in attempt limits

4. **UI Behavior**:
   - Preview button visible only when permission allows
   - Preview mode alert shows when viewing preview
   - Submit button disabled for previews
   - Content alerts show for empty quizzes

### Edge Cases

- Multiple instructors previewing same quiz (each has their own preview)
- Starting real attempt while preview exists (preview doesn't interfere)
- Preview attempt with timer (timer runs but doesn't auto-submit)
- Preview attempt with all questions answered (still cannot submit)

## Migration Notes

### Database Migration Required

Run migration `20260115_135441` to add `is_preview` column:
```bash
bun run payload migrate
```

### No Breaking Changes

- All changes are additive
- Existing quiz submissions unaffected
- Preview attempts are opt-in (only created when instructor clicks preview button)

### Backward Compatibility

Fully backward compatible:
- Existing quiz functionality unchanged
- Preview feature is separate and optional
- No API changes for external consumers

## Performance Considerations

- **Minimal Impact**: Preview attempts are rare (only when instructors preview)
- **Efficient Queries**: Preview filtering uses simple boolean checks
- **No Additional Load**: Preview attempts don't affect normal quiz operations

## Related Issues

This changelog addresses:
- Need for instructors to preview quizzes before students take them
- Difficulty testing quiz functionality without creating test accounts
- Lack of visibility into quiz content completeness
- Need to identify quizzes missing questions or nested quizzes

## Design Decisions

### Boolean Flag vs Status

Chose `isPreview: boolean` flag over a new "preview" status because:
1. **Flexibility**: Preview attempts can still be "in_progress" for normal quiz operations
2. **Minimal Impact**: Doesn't require changes to status handling throughout codebase
3. **Clear Semantics**: Boolean flag is explicit and easy to understand
4. **Type Safety**: Works with existing status types

### High Attempt Number (999999)

Used `attemptNumber: 999999` for preview attempts to:
1. **Avoid Conflicts**: Doesn't interfere with unique constraint on `(courseModuleLink, student, attemptNumber)`
2. **Internal Only**: Clearly indicates it's not a real attempt number
3. **No UI Display**: Attempt number not shown in UI for previews anyway

### One Preview Per User/Module

Deletes old preview when starting new preview because:
1. **Simplicity**: One active preview is sufficient for testing
2. **Clean State**: Prevents accumulation of preview attempts
3. **Consistent Behavior**: Matches pattern of one in-progress attempt per user/module

### Preview in userSubmissions but Filtered from Display

Kept previews in `userSubmissions` but filtered from display because:
1. **Retrieval**: Need to find preview when `viewSubmission` param is set
2. **Display**: Don't want previews in submission history or normal views
3. **Selective Filtering**: Filter at display level, not at fetch level

## Conclusion

The quiz preview feature provides instructors with a convenient way to test and verify quizzes before students take them. The implementation is clean, non-intrusive, and maintains full backward compatibility. Preview attempts are clearly distinguished from real attempts through UI indicators and restrictions, while still allowing full quiz functionality for testing purposes.

The addition of content alerts (no questions/nested quizzes) helps instructors identify and fix incomplete quizzes, improving overall quiz quality and student experience.
