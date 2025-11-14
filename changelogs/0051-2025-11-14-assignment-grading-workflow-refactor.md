# Assignment Grading Workflow Refactor and Release Grade Feature

**Date:** 2025-11-14  
**Type:** Feature Enhancement & Refactoring  
**Impact:** High - Separates grading from grade release, improves grade management workflow, and enhances UI for submission actions

## Overview

This changelog documents a major refactoring of the assignment grading workflow that separates the act of grading submissions from releasing grades to the gradebook. The changes introduce a two-step process where instructors first grade submissions, then explicitly release those grades to update student gradebook entries. Additionally, the submissions page UI has been enhanced with a menu-based action system and proper maxGrade display.

## Key Changes

### Grading Workflow Separation

#### Two-Step Grading Process
- **Step 1 - Grade Submission**: Instructors grade submissions directly, storing grade and feedback on the submission record
- **Step 2 - Release Grade**: Instructors explicitly release grades from submissions to update the student's gradebook entry
- **Benefits**: 
  - Allows instructors to review grades before making them visible to students
  - Prevents accidental grade updates when grading multiple attempts
  - Provides better control over when grades appear in the gradebook

#### Assignment Submission Schema Changes
- **New Fields Added** to `assignment-submissions` collection:
  - `grade`: Number field storing the numeric grade (min: 0)
  - `feedback`: Textarea field storing instructor feedback
  - `gradedBy`: Relationship to `users` collection (the instructor who graded)
  - `gradedAt`: Date field storing when the submission was graded
- **Existing Field Reused**: `status` field now tracks submission state including "graded"

### Backend Function Changes

#### `tryGradeAssignmentSubmission` Refactoring
- **Location**: `server/internal/assignment-submission-management.ts`
- **Previous Behavior**: Updated both submission and user-grade records
- **New Behavior**: Only updates the submission record with grade, feedback, gradedBy, and gradedAt
- **Grade Validation**: Validates grade against gradebook item min/max limits if gradebook item exists
- **Transaction Management**: Uses transactions to ensure atomicity
- **Return Value**: Returns updated submission with depth 1 for relationships

#### New `tryReleaseGrade` Function
- **Location**: `server/internal/user-grade-management.ts`
- **Purpose**: Transfers grade from latest graded submission to user-grade record
- **Parameters**:
  - `courseActivityModuleLinkId`: The assignment module link ID
  - `enrollmentId`: The student's enrollment ID
- **Behavior**:
  - Finds the latest graded submission for the student + assignment combination
  - Extracts grade, feedback, gradedBy from the submission
  - Finds or creates the corresponding gradebook item
  - Creates or updates the user-grade record with submission data
  - Uses transactions to ensure atomicity
- **Error Handling**: Returns appropriate errors if enrollment or submission not found

#### Access Control Improvements
- **Consistent Parameter Passing**: All Payload function calls now accept `user`, `req`, and `overrideAccess` parameters
- **Removed Dynamic Imports**: Replaced `await import` statements with top-level imports for better performance
- **Type Safety**: Proper user type formatting with `collection: "users"` and avatar field mapping

### Submissions Page UI Enhancements

#### Menu-Based Actions
- **Previous UI**: Single "Grade" button in Actions column
- **New UI**: Menu button (three dots icon) with dropdown containing:
  - **Grade**: Opens grading view (same as before)
  - **Release Grade**: Releases the latest graded submission's grade to the gradebook
    - Only visible when submission is graded (`grade.baseGrade` is not null)
    - Shows "Releasing..." state while action is in progress
    - Disabled during release operation

#### MaxGrade Display
- **Previous Behavior**: `maxGrade` was set to `null` in submission grade data
- **New Behavior**: Fetches `maxGrade` from gradebook item using `tryFindGradebookItemByCourseModuleLink`
- **Implementation**: 
  - Loader fetches gradebook item once for all submissions
  - Maps `maxGrade` to all graded submissions
  - Also fetches `maxGrade` for grading view when in grading mode
- **Display**: Submission history and grade displays now show `baseGrade/maxGrade` format (e.g., "85/100")

#### Release Grade Integration
- **Hook**: `useReleaseGrade` hook manages release grade action
- **Action Handler**: PUT method handler in route action processes release requests
- **Success Notification**: Shows green success notification when grade is released
- **Error Handling**: Errors are displayed via notifications system

### Submission History Enhancements

#### Grade Display
- **Location**: `app/components/submission-history.tsx`
- **Previous Behavior**: Only showed grade if `maxGrade` was available
- **New Behavior**: Shows `baseGrade` even if `maxGrade` is null
- **Display Format**: 
  - Shows `baseGrade/maxGrade` if both are available
  - Shows just `baseGrade` if `maxGrade` is null
- **Visual**: Green badge displaying grade information

### Gradebook Integration

#### Grade Display Fixes
- **Issue Fixed**: Grades were not showing in gradebook report view after grading
- **Solution**: 
  - Loader now fetches user grades using `tryGetUserGradesJsonRepresentation`
  - Grade data is properly mapped to enrollment and item IDs
  - Table cells display actual grades instead of hardcoded dashes
- **Final Grade Display**: Total column now shows calculated final grade formatted to two decimal places

#### Single View Page
- **Location**: `app/routes/course.$id.grades.singleview.tsx`
- **Feature**: Displays individual student grade breakdown
- **Data Source**: Uses `tryGetAdjustedSingleUserGradesJsonRepresentation` for accurate weights
- **UI**: Mantine table showing grade items, weights, and adjustments
- **User Selection**: Dropdown to select student using `nuqs` for URL state management

## Technical Details

### Files Modified

#### Backend Files
- `server/collections/assignment-submissions.ts`
  - Added `grade`, `feedback`, `gradedBy`, `gradedAt` fields
- `server/internal/assignment-submission-management.ts`
  - Refactored `tryGradeAssignmentSubmission` to only update submission
  - Removed user-grade update logic
  - Added grade validation against gradebook item limits
  - Updated all Payload calls to pass `user` and `overrideAccess`
  - Replaced dynamic imports with static imports
- `server/internal/user-grade-management.ts`
  - Added `tryReleaseGrade` function
  - Updated `UpdateUserGradeArgs` interface to include `submission` and `submissionType`
  - Updated `tryUpdateUserGrade` to handle submission fields
- `server/internal/gradebook-item-management.ts`
  - Updated `tryUpdateGradebookItem` to accept `categoryId` parameter
  - Fixed mapping of `categoryId` to `category` field for Payload

#### Frontend Files
- `app/routes/course/module.$id.submissions.tsx`
  - Added menu button with "Grade" and "Release Grade" options
  - Added `useReleaseGrade` hook
  - Added PUT action handler for release grade
  - Fetches `maxGrade` from gradebook items
  - Added success notification for grade release
  - Updated `StudentSubmissionRow` component to accept release props
- `app/components/submission-history.tsx`
  - Updated grade display to show `baseGrade` even without `maxGrade`
  - Improved grade badge formatting
- `app/components/grading-view.tsx`
  - Added `onReleaseGrade`, `isReleasing`, `enrollment`, `courseModuleLink` props
  - Added "Release Grade" button in grading view
  - Button appears when submission is graded and release handler is provided
- `app/routes/course.$id.grades.tsx`
  - Fetches user grades in loader using internal functions
  - Passes `categoryId` when updating grade items
- `app/components/gradebook/report-view.tsx`
  - Displays actual grades from user grades data
  - Shows final grades in total column
  - Fixed grade mapping logic
- `app/components/gradebook/modals.tsx`
  - Fixed bug where `categoryId` was not passed from form to API
- `app/components/gradebook/hooks.ts`
  - Updated `useUpdateGradeItem` to accept `categoryId` parameter
- `app/components/gradebook/schemas.ts`
  - Added `categoryId` to `updateItemSchema`

#### Test Files
- `server/internal/assignment-submission-management.test.ts`
  - Updated test cases to reflect new grading workflow
  - Tests verify that grading only updates submission
  - Tests verify release grade workflow
  - Updated function call signatures to match new object-based arguments
- `server/internal/user-grade-management.test.ts`
  - Added test case for full grading flow (submit → grade → release)
  - Added test case for `tryReleaseGrade` function
  - Replaced dynamic imports with static imports
  - Updated function call signatures

### Database Changes

#### Schema Updates
- **New Fields** in `assignment-submissions` collection:
  ```typescript
  grade: number (optional, min: 0)
  feedback: textarea (optional)
  gradedBy: relationship to users (optional)
  gradedAt: date (optional)
  ```
- **No Migration Required**: Fields are optional, existing records remain valid
- **Backward Compatible**: Existing submissions without grades continue to work

### API Changes

#### New Action Endpoint
- **Route**: `PUT /course/module/:moduleLinkId/submissions`
- **Purpose**: Release grade from submission to gradebook
- **Form Data**:
  - `courseModuleLinkId`: The course activity module link ID
  - `enrollmentId`: The student's enrollment ID
- **Response**: `{ success: true, released: true }` on success

#### Updated Action Endpoint
- **Route**: `POST /course/module/:moduleLinkId/submissions`
- **Previous Behavior**: Updated both submission and user-grade
- **New Behavior**: Only updates submission with grade and feedback
- **Form Data**: Same as before (`submissionId`, `score`, `feedback`)

## User Impact

### For Instructors

#### Improved Workflow
- **Review Before Release**: Can grade multiple submissions and review grades before releasing them
- **Better Control**: Explicit release action prevents accidental grade updates
- **Multiple Attempts**: Can grade multiple attempts without affecting gradebook until release
- **Clear Actions**: Menu-based UI makes actions more discoverable

#### Enhanced Visibility
- **MaxGrade Display**: See maximum possible grade alongside actual grade
- **Grade Status**: Clear indication of which submissions are graded vs released
- **Release Feedback**: Success notification confirms when grade is released

### For Students

#### Grade Visibility
- **Accurate Display**: Grades now show with proper maxGrade (e.g., "85/100")
- **Submission History**: Can see grades for all graded submissions in history
- **Grade Release**: Grades only appear in gradebook after instructor releases them

### For System Administrators

#### Better Data Integrity
- **Separation of Concerns**: Grading and grade release are separate operations
- **Transaction Safety**: Both operations use transactions for atomicity
- **Audit Trail**: `gradedBy` and `gradedAt` fields track who graded and when
- **Error Recovery**: Failed releases don't affect submission grades

## Migration Notes

### No Breaking Changes
- All changes are backward compatible
- Existing submissions continue to work without new fields
- Grade release is optional - grades can remain on submissions only

### Data Migration
- **No Migration Required**: New fields are optional
- **Existing Grades**: Existing user-grade records remain unchanged
- **Gradual Adoption**: Instructors can adopt new workflow at their own pace

### Upgrade Path
1. Deploy code changes
2. Instructors can start using new grading workflow immediately
3. Existing graded submissions can be released using new release action
4. No data migration scripts needed

## Testing Considerations

### Manual Testing Checklist
- [ ] Grade a submission and verify it updates submission record only
- [ ] Verify user-grade is not created immediately after grading
- [ ] Release grade and verify user-grade is created/updated
- [ ] Verify maxGrade displays correctly in submission history
- [ ] Test menu button actions (Grade and Release Grade)
- [ ] Verify success notification appears after release
- [ ] Test with multiple submission attempts
- [ ] Verify grade validation against gradebook item limits
- [ ] Test error handling for missing enrollment or submission

### Edge Cases Tested
- Grading submission without gradebook item (should work)
- Releasing grade when no graded submission exists (should error)
- Releasing grade when enrollment doesn't exist (should error)
- Multiple attempts with different grades (should release latest)
- Grade outside min/max range (should validate and error)

## Future Enhancements

### Planned Features
1. **Bulk Release**: Release grades for multiple students at once
2. **Auto-Release**: Option to automatically release grades when grading
3. **Release History**: Track when grades were released
4. **Grade Override**: Allow overriding released grades
5. **Notification System**: Notify students when grades are released

### UI Improvements
1. **Release Status Indicator**: Visual indicator showing which submissions have released grades
2. **Batch Actions**: Select multiple submissions and release grades in bulk
3. **Grade Comparison**: Show previous grades when releasing new attempt
4. **Release Confirmation**: Confirmation dialog before releasing grade

## Performance Considerations

### Database Queries
- **Gradebook Item Lookup**: Single query per module for maxGrade (cached in loader)
- **Release Grade**: Single transaction with multiple queries (optimized)
- **No N+1 Problems**: Efficient query patterns maintained

### UI Performance
- **Menu Rendering**: Menu only renders when submissions exist
- **Conditional Rendering**: Release option only shows for graded submissions
- **Notification System**: Non-blocking success notifications

## Conclusion

This refactoring significantly improves the assignment grading workflow by separating grading from grade release. The two-step process gives instructors better control over when grades appear in the gradebook, while the enhanced UI makes actions more discoverable and intuitive. The changes maintain backward compatibility and provide a clear upgrade path for existing installations.

The separation of concerns also improves code maintainability and makes it easier to add features like bulk release, auto-release, and grade history tracking in the future.

