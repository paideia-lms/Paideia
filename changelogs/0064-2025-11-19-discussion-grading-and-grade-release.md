# Discussion Grading and Grade Release

**Date:** November 19, 2025

## Overview

This changelog documents the implementation of comprehensive discussion grading functionality, including per-post grading, grade release to the gradebook, and enhanced grading UI with context display.

## Key Features

### 1. Discussion Submission Grading

- **Per-Post Grading**: Discussion submissions can now be graded individually at the post level (threads, replies, and comments)
- **Direct Grade Storage**: Grades are stored directly on discussion submissions, not in user-grades
- **Grade Fields**: Added `grade`, `feedback`, `gradedBy`, and `gradedAt` fields to the `discussion-submissions` collection
- **Validation**: Grade values are validated against gradebook item min/max limits when available

### 2. Discussion Grade Release

- **Grade Release Function**: Created `tryReleaseDiscussionGrade` to release discussion grades to the gradebook
- **Average Calculation**: Calculates average grade from all graded posts (ignores ungraded posts)
- **User-Grade Creation**: Creates or updates user-grade entries when grades are released
- **Module-Specific Release**: Separated grade release functions by module type:
  - `tryReleaseAssignmentGrade` (renamed from `tryReleaseGrade`)
  - `tryReleaseDiscussionGrade` (new)
  - `tryReleaseQuizGrade` (throws `NotImplementedError`)

### 3. Enhanced Grading View

- **Per-Post Grading Forms**: Each post (thread/reply/comment) has its own grading form
- **Context Collapse**: Replies and comments show a collapse button to view ancestor posts
- **Ancestor Chain**: Displays full conversation chain from thread to direct parent
- **Author Information**: Shows author avatar, name, and link to profile page for each ancestor
- **Timestamps**: Displays both published and created timestamps for context

### 4. Submission Table Improvements

- **Status Display**: Shows "Graded", "Partially Graded", or "Not Graded" status
- **Score Display**: Shows average score (from graded posts only) / max score
- **Simplified UI**: Removed expandable post history row for cleaner interface

## Technical Changes

### Database Schema

**Migration:** `20251119_222057`

Added fields to `discussion_submissions` table:
- `grade` (numeric): The grade assigned to the submission
- `feedback` (varchar): Feedback provided by the grader
- `graded_by_id` (integer): Foreign key to users table
- `graded_at` (timestamp): When the submission was graded

### API Changes

#### `tryGradeDiscussionSubmission`

**Before:**
- Required `enrollmentId`, `gradebookItemId`, `maxGrade`
- Created user-grade entries immediately
- Returned submission with user-grade

**After:**
- Only requires `id`, `grade`, `gradedBy`, `feedback`
- Updates submission directly with grade information
- Does NOT create user-grade entries (done via release)
- Validates grade against gradebook item if available

#### `tryReleaseDiscussionGrade`

**New Function:**
- Takes `courseActivityModuleLinkId` and `enrollmentId`
- Fetches all published discussion submissions for the student
- Filters to only graded submissions
- Calculates average grade (ignoring ungraded posts)
- Creates or updates user-grade entry with average
- Combines feedback from all graded submissions

#### `tryReleaseAssignmentGrade`

**Renamed from:** `tryReleaseGrade`
- Now explicitly handles assignment-specific logic
- Updated all references throughout codebase

#### `tryReleaseQuizGrade`

**New Function:**
- Throws `NotImplementedError` for now
- Placeholder for future quiz grade release functionality

### Component Changes

#### `DiscussionGradingView`

- Removed single grading form from right column
- Added per-post grading forms within each post display
- Added context collapse component showing ancestor posts
- Displays author information (avatar, name, profile link) for ancestors
- Shows timestamps (published/created) for context

#### `DiscussionSubmissionTable`

- Removed expandable row and post history section
- Added status column with three states: "Graded", "Partially Graded", "Not Graded"
- Added score column showing average of graded posts / max score
- Simplified UI by removing chevron icons and collapse functionality

### Error Handling

- Added `NotImplementedError` class for unimplemented features
- Updated error transformation to handle new error type

## Workflow Changes

### Grading Workflow

1. **Grade Posts**: Instructor grades individual discussion posts using per-post forms
2. **Grades Stored**: Grades are stored directly on `discussion-submissions` collection
3. **Release Grades**: When ready, instructor clicks "Release Grade" button
4. **Average Calculated**: System calculates average from all graded posts
5. **User-Grade Created**: Average grade is stored in user-grades for gradebook

### Key Differences from Assignment Grading

- **Per-Post vs Per-Submission**: Discussions allow grading multiple posts per student
- **Average Calculation**: Discussion grades are averaged from all graded posts
- **Ungraded Posts**: Ungraded posts are ignored in average calculation
- **Context Display**: Discussion grading shows full conversation context

## Testing

- Updated `discussion-management.test.ts` to reflect new grading workflow
- Added test for `tryReleaseDiscussionGrade` in `user-grade-management.test.ts`
- Tests verify grades are stored on submissions, not in user-grades
- Tests verify average calculation excludes ungraded posts

## Migration Notes

- Run migration `20251119_222057` to add grading fields to discussion submissions
- Existing discussion submissions will have `null` values for new grading fields
- No data migration needed - new fields are optional

## Breaking Changes

None. This is a new feature addition.

## Future Enhancements

- Quiz grade release implementation (currently throws `NotImplementedError`)
- Bulk grading operations for multiple posts
- Grade templates or rubrics for discussion posts
- Automated grading based on participation metrics

