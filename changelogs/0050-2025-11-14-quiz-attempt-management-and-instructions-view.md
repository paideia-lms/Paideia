# Quiz Attempt Management and Instructions View

**Date:** 2025-11-14  
**Type:** Feature Enhancement  
**Impact:** High - Improves quiz workflow for students with structured attempt management, prevents premature timer starts, and enforces time limits

## Overview

This changelog documents the implementation of a comprehensive quiz attempt management system that provides students with a structured workflow for starting and continuing quiz attempts. The changes include a new quiz instructions view, improved attempt tracking, time limit enforcement, and centralized permission management.

## Key Changes

### Quiz Instructions View Component

- **New Component**: Created `QuizInstructionsView` component that displays quiz instructions, attempt limits, time limits, and a "Start Quiz" button
- **Attempt Display**: Shows attempt count (e.g., "1 of 1 attempt used") with clear messaging about remaining attempts
- **Dynamic Button Text**: 
  - Shows "Start Quiz" for first attempt
  - Shows "Start New Attempt" when previous attempts exist
  - Shows "Continue Quiz (Attempt X)" when there's an in-progress attempt
- **Time Limit Formatting**: Uses `pretty-ms` library for human-readable time limit display (e.g., "1 hour 30 minutes")

### Quiz Attempt Workflow

- **Instructions First**: Students now always see the quiz instructions view first, preventing premature timer start
- **Start Quiz Action**: Added `QuizActions.START_ATTEMPT` action type for type-safe quiz attempt initiation
- **Attempt Reuse**: When clicking "Start Quiz" with an existing in-progress attempt, the system reuses that attempt instead of creating a duplicate
- **URL Parameter**: Uses `showQuiz=true` query parameter to control when the quiz preview is displayed

### Backend Quiz Submission Management

- **Start Quiz Attempt**: New `tryStartQuizAttempt` function creates an `in_progress` submission with `startedAt` timestamp
- **Duplicate Prevention**: Prevents starting a new attempt if there's already an `in_progress` submission for the same student and quiz
- **Next Attempt Number**: `tryGetNextAttemptNumber` calculates the correct attempt number based on existing submissions
- **In-Progress Check**: `tryCheckInProgressSubmission` checks for existing in-progress attempts
- **Time Limit Enforcement**: `trySubmitQuiz` now validates that submissions occur within the quiz's time limit, throwing `QuizTimeLimitExceededError` if exceeded
- **Standardized Parameters**: All quiz submission management functions now accept `payload`, `user`, `req`, and `overrideAccess` parameters for consistent access control

### Submission History Enhancements

- **Start Time Display**: Added `startedAt` field to `SubmissionData` interface and displays it in submission history
- **Time Display Format**: Shows both start time and submission time when available:
  - "Started: [date/time]" for in-progress attempts
  - "Started: [date/time] • Submitted: [date/time]" for completed attempts
- **Compact Variant**: Updated compact variant to show start times alongside submission times

### Permission Management

- **Centralized Logic**: Moved quiz attempt permission logic to `canStartQuizAttempt` function in `server/utils/permissions.ts`
- **Permission Result**: Returns `PermissionResult` with `allowed` boolean and descriptive `reason` string
- **Permission Rules**:
  - Can start if no max attempts are set (unlimited)
  - Can start if attempt count is less than max attempts
  - Can start if there's an in-progress attempt (to continue/resume it)
- **UI Integration**: Quiz instructions view uses permission result to show appropriate messaging

### Access Control Improvements

- **Student-Specific Submissions**: Modified `module.$id.tsx` loader to fetch quiz submissions separately for students, as they don't have permission to see all submissions from course module context
- **Explicit Queries**: Uses `tryListQuizSubmissions` with `studentId` filter and `overrideAccess: false` to respect student permissions
- **Proper User Context**: Passes properly formatted user object with `collection: "users"` and mapped avatar field

### Error Handling

- **New Error Type**: Added `QuizTimeLimitExceededError` class for time limit violations
- **Error Transformation**: Included in `transformError` function for consistent error handling
- **Descriptive Messages**: Error messages include time limit and elapsed time information

### Testing

- **Comprehensive Test Coverage**: Added test cases for:
  - Starting quiz attempt and retrieving it
  - Preventing duplicate in-progress attempts
  - Time limit enforcement on submission
- **Test Isolation**: Organized tests into separate `describe` blocks with individual `beforeAll` and `afterAll` hooks for complete isolation
- **Clean Database State**: Each test suite performs `migrate:fresh` and `clean-s3` to ensure clean state

## Technical Details

### Files Modified

- `app/components/activity-modules-preview/quiz-instructions-view.tsx` (new)
- `app/components/submission-history.tsx`
- `app/routes/course/module.$id.tsx`
- `server/internal/quiz-submission-management.ts`
- `server/internal/quiz-submission-management.test.ts`
- `server/utils/permissions.ts`
- `server/utils/error.ts`
- `app/utils/module-actions.ts`
- `server/contexts/course-module-context.ts`

### Dependencies Added

- `pretty-ms@^9.3.0`: For human-readable time formatting

### Database Changes

- No schema changes required - uses existing `quiz-submissions` collection fields:
  - `status`: "in_progress" | "completed" | "graded" | "returned"
  - `startedAt`: Timestamp when attempt was started
  - `attemptNumber`: Sequential attempt number

## User Impact

### For Students

- **Clear Instructions**: Always see quiz instructions before starting, preventing accidental timer start
- **Attempt Tracking**: Clear visibility of attempt usage and remaining attempts
- **Resume Capability**: Can continue in-progress attempts even after navigating away
- **Time Awareness**: See start time for each attempt in submission history
- **Better Feedback**: Clear messaging about attempt limits and why they can or cannot start new attempts

### For Instructors

- **Accurate Tracking**: Better visibility into student attempt patterns with start times
- **Time Limit Enforcement**: Automatic rejection of submissions that exceed time limits
- **Prevented Duplicates**: System prevents multiple concurrent attempts automatically

## Migration Notes

- No database migrations required
- Existing quiz submissions will continue to work
- New `startedAt` field will be populated for new attempts automatically
- Existing submissions without `startedAt` will display correctly (field is optional)

## Future Considerations

- Consider adding ability to pause/resume quiz attempts (currently timer cannot be paused)
- Consider adding attempt review mode for completed attempts
- Consider adding time remaining display during active quiz attempts
- Consider adding bulk attempt management for instructors

## Incomplete Features

### Quiz Reports (In Progress - Not Complete)

**Status:** Partially Implemented - Backend functions created, tests pending

**Overview:**
Started implementation of quiz reports functionality to provide instructors with comprehensive analytics on student quiz performance. The backend internal functions have been created but the feature is not yet complete.

**What's Been Implemented:**

- **Backend Functions**: Created two internal functions in `server/internal/quiz-submission-management.ts`:
  - `tryGetQuizGradesReport`: Generates a detailed grades report showing all student attempts with per-question scores and overall averages
  - `tryGetQuizStatisticsReport`: Generates question-level statistics including difficulty metrics and response distributions for multiple choice questions

- **Type Definitions**: Added TypeScript interfaces:
  - `GetQuizGradesReportArgs` and `QuizGradesReport` for grades report
  - `GetQuizStatisticsReportArgs` and `QuizStatisticsReport` for statistics report

- **Report Features**:
  - Student attempt details (status, start/completion times, time spent, scores)
  - Per-question score breakdown for each attempt
  - Overall averages across completed/graded attempts
  - Per-question averages
  - Question-level statistics (answered count, correct/incorrect counts, difficulty percentage)
  - Response distribution for multiple choice questions
  - Overall quiz statistics (total attempts, completed attempts, average scores)

**What's Missing:**

- Test cases for both report functions (test structure created but not yet added to test file)
- Frontend UI components to display the reports
- API endpoints to expose the report functions
- Integration with the course module submissions page
- Export functionality (CSV/PDF export of reports)

**Next Steps (When Resuming):**

1. Complete test cases in `server/internal/quiz-submission-management.test.ts`:
   - Test `tryGetQuizGradesReport` with various scenarios
   - Test `tryGetQuizStatisticsReport` with question statistics
   - Test edge cases (empty submissions, invalid course module links)
   - Test averages calculations and response distributions

2. Create API endpoints to expose the report functions

3. Build frontend components to display:
   - Quiz grades report table (similar to Moodle's quiz grades report)
   - Quiz statistics report with question-level breakdown
   - Charts/visualizations for statistics

4. Integrate reports into the course module submissions page

5. Add export functionality for reports

**Files Modified:**
- `server/internal/quiz-submission-management.ts` (interfaces and functions added)
- `server/internal/quiz-submission-management.test.ts` (imports added, tests pending)

