# Quiz Submission View Feature

**Date:** 2026-01-10  
**Type:** Feature Enhancement  
**Impact:** Medium - Adds ability for students to view their completed quiz submissions in readonly mode

## Overview

This update adds the ability for students to view their completed quiz submissions after they have been submitted. Students can now click an eye icon button on completed quiz attempts to view their submitted answers in a readonly mode, allowing them to review their work without the ability to make changes.

## Preparation

This feature required a prior refactoring of the submission history components. The generic `SubmissionHistory` and `SubmissionHistoryItem` components were split into specialized components:

- **Assignment components**: `AssignmentSubmissionItem`, `AssignmentSubmissionItemInTable`, `AssignmentSubmissionHistory`
- **Quiz components**: `QuizSubmissionItem`, `QuizSubmissionItemInTable`, `QuizSubmissionHistory`

This refactoring was necessary to:
- Provide type-safe interfaces specific to assignment and quiz submissions
- Enable clear separation between table view (instructor) and instruction view (student) components
- Eliminate status mapping between quiz and assignment submission types
- Improve maintainability and extensibility for features like this one

The quiz submission view feature leverages the new `QuizSubmissionItem` component structure, which properly handles quiz-specific fields (timeSpent, totalScore, percentage) and statuses (in_progress, completed, graded, returned) without requiring conversion to assignment submission types.

## Key Changes

### 1. Quiz Submission View Action

**New Action Type: `VIEW_SUBMISSION`**
- Added `VIEW_SUBMISSION: "viewsubmission"` to `QuizActions` constant in `app/routes/course/module.$id/route.tsx`
- Provides type-safe action handling for viewing quiz submissions

**New Search Parameter: `viewSubmission`**
- Added `viewSubmission: parseAsInteger` to `loaderSearchParams`
- Accepts submission ID as integer to identify which submission to view
- Integrated with existing search param system using `nuqs` parsers

### 2. Loader Enhancement for Submission Viewing

**Submission Validation and Retrieval**
- Enhanced loader in `app/routes/course/module.$id/route.tsx` to handle `viewSubmission` parameter
- When `viewSubmission` is provided:
  - Fetches submission using `tryGetQuizSubmissionById` from `server/internal/quiz-submission-management`
  - Validates submission belongs to the current module
  - Verifies submission ownership (students can only view their own submissions)
  - Enforces status restrictions: only "completed", "graded", or "returned" submissions can be viewed (not "in_progress")
  - Throws `ForbiddenResponse` with appropriate error messages for invalid access attempts

**Answer Conversion**
- Converts submission answers from database format to `QuizAnswers` format using `convertDatabaseAnswersToQuizAnswers`
- Handles conversion errors gracefully, continuing without answers if conversion fails
- Returns `viewedSubmission` and `viewedSubmissionAnswers` in loader data for component consumption

### 3. Quiz Submission Item UI Enhancement

**View Button Component**
- Added eye icon button (`IconEye` from `@tabler/icons-react`) to `QuizSubmissionItem` component
- Button only renders for completed, graded, or returned submissions (not in-progress)
- Uses `ActionIcon` from Mantine with light variant and blue color
- Includes tooltip with "View submission" label for accessibility
- Positioned in the right-side `Group` alongside timestamp information

**Navigation Implementation**
- Button uses `getRouteUrl` utility to generate navigation URL with `viewSubmission` search param
- Clears other search params (`showQuiz`, `view`, `threadId`, `replyTo`) when navigating to view
- Maintains proper URL structure and type safety

**Component Props Update**
- Updated `QuizSubmissionItem` to accept `moduleLinkId` prop (number or string)
- Updated `QuizSubmissionHistory` to accept and pass through `moduleLinkId` prop
- Updated route component to pass `moduleLinkId` when rendering `QuizSubmissionHistory`

### 4. Readonly Quiz Viewing

**QuizModuleView Enhancement**
- Added logic to detect when `viewSubmission` search param is set
- When viewing a submission:
  - Renders `QuizAttemptComponent` in readonly mode
  - Passes converted submission answers as `initialAnswers`
  - Extracts and passes flagged questions from the viewed submission
  - Displays `ModuleDatesInfo` component for context
  - Prevents editing or submission of viewed quiz

**QuizAttemptComponent Readonly Support**
- Added `readonly?: boolean` prop to `QuizAttemptComponentProps` interface
- Passes `readonly` prop through to `SingleQuizPreview` component
- For regular quizzes: directly passes `readonly` to `SingleQuizPreview`
- For nested quizzes: combines `readonly` with existing `isViewingCompletedQuiz` logic
- Ensures consistent readonly behavior across all quiz types

**Readonly Mode Features**
- Quiz displays in readonly mode with "Read-only Mode" alert banner
- All question interactions are disabled
- Navigation buttons show "Previous" and "Next" instead of submit button
- Timer display is hidden in readonly mode
- Answers are displayed but cannot be modified
- Flagged questions are preserved and displayed correctly

### 5. Access Control and Security

**Ownership Verification**
- Loader verifies that the submission belongs to the current authenticated user
- Compares `submission.student.id` with `currentUser.id`
- Throws `ForbiddenResponse` if user attempts to view another student's submission

**Status Validation**
- Only allows viewing of completed submissions (status: "completed", "graded", or "returned")
- Prevents viewing of in-progress submissions with clear error message
- Ensures students cannot view submissions that haven't been submitted yet

**Module Validation**
- Verifies submission belongs to the current module
- Prevents cross-module submission viewing
- Maintains data integrity and access control

### 6. URL Parameter Management

**Search Param Cleanup**
- Updated all `getRouteUrl` calls in quiz-related actions to include `viewSubmission: null`
- Ensures proper cleanup of view submission parameter when navigating away
- Maintains consistent URL state management across quiz workflow

## Technical Details

### Files Modified

1. **`app/routes/course/module.$id/route.tsx`**
   - Added `VIEW_SUBMISSION` to `QuizActions`
   - Added `viewSubmission` to `loaderSearchParams`
   - Enhanced loader with submission viewing logic
   - Updated `QuizModuleView` to handle readonly viewing
   - Updated `getRouteUrl` calls to include `viewSubmission: null`

2. **`app/routes/course/module.$id/components/quiz/quiz-submission-item.tsx`**
   - Added view button with eye icon
   - Added `moduleLinkId` prop
   - Implemented navigation to view submission
   - Component structure enabled by prior submission history refactoring

3. **`app/routes/course/module.$id/components/quiz/quiz-submission-history.tsx`**
   - Added `moduleLinkId` prop
   - Passes `moduleLinkId` to `QuizSubmissionItem` components
   - Component structure enabled by prior submission history refactoring

4. **`app/routes/course/module.$id/components/quiz/quiz-attempt-component.tsx`**
   - Added `readonly` prop support
   - Passes `readonly` to `SingleQuizPreview` for both regular and nested quizzes

### Dependencies

- Uses existing `tryGetQuizSubmissionById` from `server/internal/quiz-submission-management`
- Uses existing `convertDatabaseAnswersToQuizAnswers` from `server/internal/utils/quiz-answer-converter`
- Leverages existing `QuizAttemptComponent` and `SingleQuizPreview` readonly capabilities
- Integrates with existing search param system using `nuqs`

## User Experience

### Student Workflow

1. **Viewing Submission History**
   - Student navigates to quiz module page
   - Sees submission history with all their attempts
   - Completed, graded, and returned submissions display an eye icon button

2. **Viewing a Submission**
   - Student clicks the eye icon button on a completed submission
   - Page navigates to readonly quiz view
   - Quiz displays with all submitted answers visible
   - Read-only mode banner appears at top
   - Student can navigate through questions to review answers
   - No editing or submission capabilities available

3. **Returning to Instructions**
   - Student can navigate back using browser back button
   - Or click "Exit" button in readonly mode (if implemented)
   - Returns to quiz instructions view

### Visual Indicators

- Eye icon button appears only on viewable submissions (completed/graded/returned)
- Read-only mode alert banner clearly indicates viewing mode
- All interactive elements are disabled in readonly mode
- Navigation buttons are available for reviewing questions

## Benefits

1. **Student Self-Review**: Students can review their submitted answers to understand their performance
2. **Learning Tool**: Helps students identify areas for improvement by reviewing past attempts
3. **Transparency**: Provides clear visibility into what was submitted
4. **Security**: Maintains proper access control ensuring students only view their own submissions
5. **Consistency**: Uses existing readonly mode infrastructure for consistent user experience

## Future Enhancements

Potential future improvements could include:
- Comparison view between multiple attempts
- Display of correct answers alongside student answers (if quiz settings allow)
- Export functionality for submission review
- Print-friendly view for submission review
- Side-by-side comparison with grading feedback
