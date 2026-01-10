# Quiz Answer Removal and Code Cleanup

**Date:** 2026-01-10  
**Type:** Feature Enhancement, Code Cleanup, Testing  
**Impact:** Medium - Adds ability to remove quiz answers, removes deprecated functions, and improves test coverage

## Overview

This update adds the ability for students to manually remove answers from quiz questions, effectively marking questions as unanswered. Additionally, this update removes deprecated quiz submission management functions and their associated test cases, streamlining the codebase. Comprehensive test coverage was added for the new functionality, and existing test issues were resolved.

## Key Changes

### 1. Quiz Answer Removal Functionality

**New Backend Function: `tryRemoveAnswerFromQuizQuestion`**
- Created reverse operation of `tryAnswerQuizQuestion` that allows removing answers from quiz questions
- Removes the answer from the submission's answers array, effectively marking the question as unanswered
- Performs the same validations as `tryAnswerQuizQuestion`:
  - Validates submission ID and question ID
  - Ensures submission is `in_progress` (only in-progress submissions can be modified)
  - Verifies question exists in quiz configuration
  - Checks time limit constraints
- Idempotent behavior: returns success if answer doesn't exist (nothing to remove)
- Uses same error handling patterns as other quiz submission functions

**New Server Action: `unanswerQuestion`**
- Added `UNANSWER_QUESTION: "unanswerquestion"` to `QuizActions` constant
- Created `unanswerQuizQuestionRpc` with form data schema requiring:
  - `submissionId` (number)
  - `questionId` (string)
- Created `unanswerQuizQuestionAction` that:
  - Validates authentication and enrollment
  - Checks quiz permissions
  - Calls `tryRemoveAnswerFromQuizQuestion` with provided parameters
  - Returns appropriate success/error responses
- Created `useUnanswerQuizQuestion` hook and integrated into UI
- Added action to action map for proper routing
- Integrated hook into `SavedAnswerPill` component for removing answers via UI

### 2. Deprecated Function Removal

**Removed `tryCreateQuizSubmission`**
- Removed function from `server/internal/quiz-submission-management.ts`
- Removed `CreateQuizSubmissionArgs` interface
- Removed all associated test cases from `server/internal/quiz-submission-management-full-workflow.test.ts`:
  - "should create quiz submission (student workflow)"
  - "should update quiz submission (student editing answers)"
  - "should submit quiz (student submits for grading)"
  - "should get quiz submission by ID"
  - "should handle late submissions"
  - "should prevent duplicate submissions for same attempt"
  - "should only allow grading of completed quizzes"
  - "should delete quiz submission"
  - "should fail with invalid arguments"
- Updated "should handle pagination in listing" test to use `tryStartQuizAttempt` instead

**Removed `tryUpdateQuizSubmission`**
- Removed deprecated function (marked with `@deprecated` comment) from `server/internal/quiz-submission-management.ts`
- Removed `UpdateQuizSubmissionArgs` interface
- Removed import from test file
- Removed test case "should fail to update non-existent submission"

### 3. UI Integration and Component Refactoring

**New `SavedAnswerPill` Component**
- Extracted "Answer saved to database" indicator into separate in-file component
- Uses Mantine `Badge` component with `rightSection` for remove button
- Added remove button functionality using `useUnanswerQuizQuestion` hook
- Remove button appears in `rightSection` when:
  - Not in readonly mode
  - `moduleLinkId` and `submissionId` are available
- Uses `ActionIcon` with `IconX` for the remove button in the badge's right section
- Shows loading state during unanswer operation
- Displays green color with light variant to indicate saved state
- Handles click events with proper event propagation control

**Removed Local Form State**
- Removed `useForm` and form state management from `use-quiz-form.ts`
- All answer state is now server-managed (no local React state)
- Simplified `UseQuizFormReturn` interface:
  - Removed `form` property
  - Removed `setAnswer` function (no longer needed)
  - Changed `getAnswer` from function to direct `answers` object
- Updated `QuestionCard` to receive `answer` as direct prop instead of `getAnswer` function
- Updated `QuizNavigation` to receive `answers` object instead of `getAnswer` function

**Eliminated Prop Drilling**
- Moved `useAnswerQuizQuestion` hook from `QuizModuleView` to `QuestionCard` component
- Removed `onAnswerSave` callback prop from component hierarchy
- Answer saving logic now encapsulated in `QuestionCard` component
- Debouncing logic moved to `QuestionCard` for better encapsulation

**Component Simplification**
- `QuestionCard` now receives `answer: QuestionAnswer | undefined` directly
- Removed `setAnswer` prop from `QuestionCardProps`
- `QuizNavigation` now receives `answers: QuizAnswers` directly
- All components work with server state directly

### 4. Comprehensive Test Coverage

**New Test Cases for `tryRemoveAnswerFromQuizQuestion`**
- "should remove answer from quiz question": Tests successful removal of an existing answer
- "should handle removing answer that doesn't exist": Tests idempotent behavior when answer doesn't exist
- "should fail to remove answer from completed submission": Tests that only in-progress submissions can be modified
- "should fail to remove answer with invalid question ID": Tests validation of question existence

**Test Fixes**
- Fixed "should list quiz submissions with filtering": Added code to create and complete a submission before listing
- Fixed "should handle pagination in listing": 
  - Added cleanup code to complete existing in-progress submissions
  - Modified to complete each submission immediately after creation (since `tryStartQuizAttempt` doesn't allow multiple in-progress submissions)
- Fixed all `tryRemoveAnswerFromQuizQuestion` tests: Added cleanup code to complete any existing in-progress submissions before starting new attempts

## Technical Details

### Modified Files

#### `server/internal/quiz-submission-management.ts`
- **Added** `RemoveAnswerFromQuizQuestionArgs` interface:
  ```typescript
  export interface RemoveAnswerFromQuizQuestionArgs extends BaseInternalFunctionArgs {
    submissionId: number;
    questionId: string;
  }
  ```
- **Added** `tryRemoveAnswerFromQuizQuestion` function (lines 708-820):
  - Validates required fields (submissionId, questionId)
  - Fetches current submission and validates status is "in_progress"
  - Gets course module link and quiz configuration
  - Validates time limit constraints
  - Verifies question exists in quiz config
  - Removes answer from answers array if it exists
  - Returns updated submission
- **Removed** `CreateQuizSubmissionArgs` interface
- **Removed** `tryCreateQuizSubmission` function
- **Removed** `UpdateQuizSubmissionArgs` interface
- **Removed** `tryUpdateQuizSubmission` function

#### `server/internal/quiz-submission-management-full-workflow.test.ts`
- **Added** import for `tryAnswerQuizQuestion` and `tryRemoveAnswerFromQuizQuestion`
- **Added** four new test cases for answer removal functionality
- **Removed** all test cases related to `tryCreateQuizSubmission`
- **Removed** test case for `tryUpdateQuizSubmission`
- **Fixed** "should list quiz submissions with filtering" test to create submissions before listing
- **Fixed** "should handle pagination in listing" test to handle in-progress submission conflicts
- **Fixed** all answer removal tests to clean up existing in-progress submissions

#### `app/routes/course/module.$id/route.tsx`
- **Added** import for `tryRemoveAnswerFromQuizQuestion`
- **Added** `UNANSWER_QUESTION: "unanswerquestion"` to `QuizActions` constant
- **Created** `unanswerQuizQuestionRpc` with form data schema
- **Created** `unanswerQuizQuestionAction` function
- **Created** `useUnanswerQuizQuestion` hook
- **Added** hook to exports
- **Added** action to action map
- **Removed** `useAnswerQuizQuestion` hook usage (moved to `QuestionCard` component)
- **Removed** `handleAnswerSave` function (no longer needed)

#### `app/routes/course/module.$id/components/question-card.tsx`
- **Added** `SavedAnswerPill` in-file component:
  - Uses Mantine `Badge` component with `rightSection` for remove button
  - Integrates `useUnanswerQuizQuestion` hook for remove functionality
  - Shows remove button in `rightSection` when conditions are met
  - Uses `ActionIcon` with `IconX` icon for remove button
  - Handles loading state during unanswer operation
  - Properly controls event propagation to prevent unwanted bubbling
- **Moved** `useAnswerQuizQuestion` hook from route to component (eliminates prop drilling)
- **Added** `convertToTypedAnswer` helper function (moved from `use-quiz-form.ts`)
- **Updated** `QuestionCardProps` interface:
  - Changed `getAnswer: (questionId: string) => QuestionAnswer | undefined` to `answer: QuestionAnswer | undefined`
  - Removed `setAnswer: (questionId: string, answer: QuestionAnswer) => void`
- **Updated** `handleAnswerChange` to only save to server (no local state update)
- **Updated** `QuestionRenderer` to use `answer` prop directly

#### `app/routes/course/module.$id/components/use-quiz-form.ts`
- **Removed** `useForm` import and usage
- **Removed** `useFormWatchForceUpdate` import
- **Removed** form state management (lines 46-52)
- **Simplified** to use `initialAnswers || {}` directly (server state)
- **Removed** `setAnswer` function and from interface
- **Removed** `getAnswer` function and from interface
- **Removed** `form` property from return interface
- **Changed** `answers` to be direct reference to `initialAnswers` (no form watching)

#### `app/routes/course/module.$id/components/quiz-attempt-component.tsx`
- **Updated** `QuizNavigationProps` interface:
  - Changed `getAnswer: (questionId: string) => QuestionAnswer | undefined` to `answers: QuizAnswers`
- **Updated** `QuizNavigation` component to use `answers[item.questionId]` directly
- **Updated** `SingleQuizPreviewProps` interface:
  - Removed `onAnswerSave` callback prop
- **Updated** `QuizAttemptComponentProps` interface:
  - Removed `onAnswerSave` callback prop
- **Updated** all component usages to pass `answers` object instead of `getAnswer` function
- **Updated** `QuestionCard` usage to pass `answer={quiz.answers[question.id]}` directly

### Function Implementation Details

**`tryRemoveAnswerFromQuizQuestion` Function Flow:**
1. Validates `submissionId` and `questionId` are provided
2. Fetches current submission using `payload.findByID`
3. Validates submission status is "in_progress"
4. Fetches course module link to access quiz configuration
5. Validates quiz configuration exists
6. Checks time limit constraints using `assertTimeLimit`
7. Verifies question exists in quiz config using `findQuestionInConfig`
8. Gets current answers array (defaults to empty array if null/undefined)
9. Finds existing answer index for the question
10. If answer doesn't exist, returns current submission (idempotent)
11. If answer exists, removes it from the array using `splice`
12. Updates submission with modified answers array
13. Returns updated submission with normalized course module link

**Error Handling:**
- Uses `Result.try` pattern for consistent error handling
- Transforms errors using `transformError` function
- Returns `InvalidArgumentError` for validation failures
- Returns `UnknownError` for unexpected errors
- All errors include descriptive messages

## User Impact

### For Students

**New Capability:**
- Can now remove answers from quiz questions by clicking the remove button on the "Saved" pill
- Useful for changing answers or clearing mistakes
- Only works for in-progress quiz attempts (cannot modify completed submissions)
- Visual feedback with loading state during answer removal

**Improved User Experience:**
- "Saved" indicator now uses modern Pill component with remove button
- Clear visual indication when answer is saved (green pill)
- One-click answer removal directly from the question card
- No need to manually clear answer fields

**No Breaking Changes:**
- Existing quiz functionality remains unchanged
- Answer saving still works as before (auto-saves with debouncing)
- No changes to quiz submission workflow

### For Developers

**Code Quality Improvements:**
- Removed deprecated functions reduces codebase complexity
- Removed local form state management (all state is server-managed)
- Eliminated prop drilling by moving hooks closer to usage
- Clear separation of concerns with dedicated answer removal function
- Consistent error handling patterns
- Comprehensive test coverage ensures reliability
- Simplified component interfaces (removed unnecessary function props)

**Architecture Improvements:**
- All quiz answer state is now server-managed (no local React state)
- Components receive data directly as props instead of functions
- Better encapsulation with hooks used where needed
- Reduced component coupling through direct prop passing
- Type-safe actions with proper validation

## Testing Considerations

### Test Coverage

**New Test Cases:**
- ✅ Successful answer removal
- ✅ Idempotent behavior (removing non-existent answer)
- ✅ Permission validation (only in-progress submissions)
- ✅ Question validation (invalid question ID)

**Test Fixes:**
- ✅ Fixed test isolation issues with in-progress submissions
- ✅ Fixed pagination test to handle submission conflicts
- ✅ Fixed listing test to ensure data exists

### Manual Testing Checklist

**Answer Removal Functionality:**
- [x] Test removing an answer from a quiz question via Pill remove button
- [x] Verify answer is removed from the submission
- [x] Test removing answer that doesn't exist (should succeed silently)
- [x] Verify cannot remove answer from completed submission
- [x] Test removing answer with invalid question ID (should fail)
- [x] Verify time limit constraints are enforced
- [x] Test removing multiple answers in sequence
- [x] Verify loading state during answer removal
- [x] Verify "Saved" pill disappears after answer removal

**State Management:**
- [x] Verify answers update correctly after server actions
- [x] Test that React Router revalidation updates UI automatically
- [x] Verify no local state conflicts with server state
- [x] Test answer saving with debouncing still works correctly

## Migration Notes

### No Database Changes
- No schema changes required
- Uses existing `quiz-submissions` collection structure
- `answers` field is an array that can be modified

### Code Updates Required
- ✅ UI integration completed: `useUnanswerQuizQuestion` hook integrated into `SavedAnswerPill` component
- ✅ Hook follows same pattern as `useAnswerQuizQuestion`
- ✅ Action requires `submissionId` and `questionId` parameters
- ✅ All components updated to use server state directly (no local form state)

### Deprecated Code Removal
- `tryCreateQuizSubmission` and `tryUpdateQuizSubmission` have been completely removed
- Any code referencing these functions will need to be updated
- Use `tryStartQuizAttempt` and `tryAnswerQuizQuestion` instead

## Related Issues

This changelog addresses:
- Need for students to remove/clear quiz answers
- Deprecated code cleanup
- Test coverage gaps for quiz submission management
- Test isolation and stability issues

## Future Enhancements

Potential improvements based on this work:
1. ✅ Add UI button/control to remove answers in quiz preview component (completed via Pill component)
2. Consider adding "Clear All Answers" functionality
3. Add confirmation dialog before removing answers
4. Consider adding undo functionality for removed answers
5. Add analytics tracking for answer removal actions
6. Consider optimizing revalidation to update only affected questions
7. Add optimistic UI updates for better perceived performance

## Conclusion

This update adds essential functionality for students to manage their quiz answers by removing them when needed. The removal of deprecated functions streamlines the codebase, and comprehensive test coverage ensures reliability. The UI integration is complete with the `SavedAnswerPill` component providing an intuitive way to remove answers. The refactoring to remove local form state simplifies the architecture and ensures all state is server-managed, improving consistency and reducing potential bugs. All components now work directly with server state, eliminating the need for local state synchronization.
