# Discussion Grading and Grade Release

**Date:** 2025-11-19  
**Type:** Feature Enhancement  
**Impact:** High - Adds comprehensive discussion grading functionality with per-post grading and grade release to gradebook

## Overview

This changelog documents the implementation of comprehensive discussion grading functionality, including per-post grading, grade release to the gradebook, and enhanced grading UI with context display. This feature enables instructors to grade individual discussion posts and release averaged grades to the gradebook, providing a flexible grading workflow for discussion-based activities.

## Key Changes

### Discussion Submission Grading

#### Per-Post Grading System
- **Individual Post Grading**: Discussion submissions can now be graded individually at the post level (threads, replies, and comments)
- **Direct Grade Storage**: Grades are stored directly on discussion submissions, not in user-grades
- **Grade Fields**: Added `grade`, `feedback`, `gradedBy`, and `gradedAt` fields to the `discussion-submissions` collection
- **Validation**: Grade values are validated against gradebook item min/max limits when available

#### Grading Workflow
- Grades are stored on submissions during grading phase
- User-grade entries are only created when grades are released
- Allows instructors to grade multiple posts per student before releasing

### Discussion Grade Release

#### Grade Release Function
- **New Function**: Created `tryReleaseDiscussionGrade` to release discussion grades to the gradebook
- **Average Calculation**: Calculates average grade from all graded posts (ignores ungraded posts)
- **User-Grade Creation**: Creates or updates user-grade entries when grades are released
- **Feedback Combination**: Combines feedback from all graded submissions

#### Module-Specific Release Functions
- Separated grade release functions by module type:
  - `tryReleaseAssignmentGrade` (renamed from `tryReleaseGrade`)
  - `tryReleaseDiscussionGrade` (new)
  - `tryReleaseQuizGrade` (throws `NotImplementedError`)

### Enhanced Grading View

#### Per-Post Grading Forms
- Each post (thread/reply/comment) has its own grading form
- Forms appear inline with each post display
- Allows granular grading of individual contributions

#### Context Display
- **Context Collapse**: Replies and comments show a collapse button to view ancestor posts
- **Ancestor Chain**: Displays full conversation chain from thread to direct parent
- **Author Information**: Shows author avatar, name, and link to profile page for each ancestor
- **Timestamps**: Displays both published and created timestamps for context

### Submission Table Improvements

#### Status and Score Display
- **Status Column**: Shows "Graded", "Partially Graded", or "Not Graded" status
- **Score Display**: Shows average score (from graded posts only) / max score
- **Simplified UI**: Removed expandable post history row for cleaner interface

## Technical Details

### Files Modified

1. **`server/collections/discussion-submissions.ts`**
   - Added `grade`, `feedback`, `gradedBy`, and `gradedAt` fields
   - Field configuration: grade (numeric), feedback (text), gradedBy (relationship), gradedAt (date)

2. **`server/internal/discussion-management.ts`**
   - Refactored `tryGradeDiscussionSubmission` to store grades on submissions
   - Removed user-grade creation from grading function
   - Added grade validation against gradebook item limits

3. **`server/internal/user-grade-management.ts`**
   - Created `tryReleaseDiscussionGrade` function
   - Renamed `tryReleaseGrade` to `tryReleaseAssignmentGrade`
   - Added `tryReleaseQuizGrade` placeholder function
   - Implemented average calculation logic for discussion grades

4. **`app/routes/course/module.$id.submissions.tsx`**
   - Updated action handler to support discussion grade release
   - Added `release-discussion-grade` intent handler

5. **`app/components/discussion-grading-view.tsx`**
   - Removed single grading form from right column
   - Added per-post grading forms within each post display
   - Added context collapse component showing ancestor posts
   - Displays author information and timestamps for context

6. **`app/components/discussion-submission-table.tsx`**
   - Removed expandable row and post history section
   - Added status column with three states
   - Added score column showing average of graded posts / max score
   - Simplified UI by removing chevron icons

7. **`app/utils/error.ts`**
   - Added `NotImplementedError` class for unimplemented features
   - Updated error transformation to handle new error type

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

## User Impact

### For Instructors

#### Grading Workflow
- Can grade individual discussion posts with separate grades and feedback
- Can view full conversation context when grading replies and comments
- Can see author information and timestamps for better grading context
- Can release grades to gradebook when ready (averaged from all graded posts)

#### Submission Management
- Clear status indicators show which submissions are graded, partially graded, or not graded
- Score display shows average of graded posts for quick assessment
- Simplified interface without expandable rows for cleaner view

### For Students

#### Grade Visibility
- Grades are visible on individual posts after instructor grades them
- Final grade appears in gradebook after instructor releases grades
- Feedback is combined from all graded posts when grades are released

## Migration Notes

### Database Migration Required

- **Migration Command**: `bun run payload migrate`
- **Migration File**: `20251119_222057.ts`
- Migration will:
  - Add `grade` column (numeric) to `discussion_submissions` table
  - Add `feedback` column (varchar) to `discussion_submissions` table
  - Add `graded_by_id` column (integer, foreign key to users) to `discussion_submissions` table
  - Add `graded_at` column (timestamp) to `discussion_submissions` table

### Backward Compatibility

- ✅ Existing discussion submissions will have `null` values for new grading fields
- ✅ No data loss or breaking changes
- ✅ All existing functionality preserved
- ✅ Migration is non-breaking and safe to apply

### Post-Migration Steps

1. Run database migration: `bun run payload migrate`
2. Regenerate Payload types: `bun run payload generate:types`
3. Existing discussion submissions will have null values for new grading fields
4. Instructors can begin grading discussion posts immediately
5. Grades can be released to gradebook after grading is complete

## Testing Considerations

### Functional Testing

- ✅ Verify per-post grading forms appear for each discussion post
- ✅ Test grading individual posts (threads, replies, comments)
- ✅ Verify grades are stored on submissions, not in user-grades
- ✅ Test grade release functionality creates user-grade entries
- ✅ Verify average calculation excludes ungraded posts
- ✅ Test status display shows correct state (Graded, Partially Graded, Not Graded)
- ✅ Verify score display shows correct average / max score
- ✅ Test context collapse shows ancestor posts correctly
- ✅ Verify author information and timestamps display correctly

### UI/UX Testing

- ✅ Verify per-post grading forms are intuitive and easy to use
- ✅ Test context collapse functionality for replies and comments
- ✅ Verify submission table status and score columns display correctly
- ✅ Test responsive layout for grading view
- ✅ Verify feedback combination when releasing grades
- ✅ Test error handling for invalid grade values

### Edge Cases

- ✅ No graded posts: Average calculation handles empty graded list
- ✅ All posts graded: Average includes all posts
- ✅ Partial grading: Only graded posts included in average
- ✅ Invalid grade values: Validation prevents invalid grades
- ✅ Missing gradebook item: Validation handles missing gradebook item gracefully

## Related Features

### Assignment Grading
- Discussion grading follows similar pattern to assignment grading
- Both use grade release workflow (grade first, release later)
- Key difference: Discussions allow multiple posts per student

### Gradebook Integration
- Discussion grades integrate seamlessly with gradebook
- Average grades are stored in user-grades collection
- Grades appear in gradebook after release

## Conclusion

The addition of comprehensive discussion grading functionality significantly enhances the grading capabilities for discussion-based activities. The per-post grading system allows instructors to provide detailed feedback on individual contributions, while the grade release workflow ensures grades are properly integrated into the gradebook. The enhanced grading view with context display improves the grading experience by providing full conversation context. This feature maintains consistency with assignment grading patterns while accommodating the unique multi-post nature of discussions.

---

**Summary**: Implemented comprehensive discussion grading functionality with per-post grading, grade release to gradebook, and enhanced grading UI. Instructors can now grade individual discussion posts and release averaged grades to the gradebook, with full conversation context displayed during grading.
