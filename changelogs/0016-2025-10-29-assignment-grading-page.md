# Assignment Grading Page Implementation

**Date**: October 29, 2025  
**Type**: Feature Addition  
**Impact**: High - Enables instructors to grade student submissions directly in the LMS

## Overview

This update introduces a dedicated grading page for assignment submissions, allowing instructors and teaching assistants to view student submissions and provide grades and feedback. The page displays submission content, attachments, and includes a comprehensive grading form with score input and rich text feedback editor.

## Key Features

### 1. Dedicated Grading Interface
- **Submission Display**: Shows complete submission content rendered with rich text formatting
- **Attachment Viewing**: Lists all submitted files with download links
- **Student Information**: Displays student name, email, attempt number, and submission status
- **Submission Metadata**: Shows submission date, status badges, and attempt number

### 2. Grading Form
- **Score Input**: NumberInput component with 0-100 range validation
- **Feedback Editor**: SimpleRichTextEditor for rich text feedback (without images/mentions/YouTube)
- **Form Validation**: Uses Mantine's uncontrolled form mode
- **Console Logging**: Currently logs grading data to console (action not yet implemented)

### 3. Enhanced Submission History Component
- **Submission ID Display**: Shows submission ID for easier tracking and debugging
- **Actions Menu**: Replaced single delete button with dropdown menu containing:
  - Grade action (links to grading page)
  - Delete action (when permitted)
- **Flexible Props**: Added `showGrade` and `moduleLinkId` props for conditional rendering

### 4. Query Parameter Management
- **nuqs Integration**: Uses `createLoader` and `parseAsInteger` for type-safe query params
- **Server-Side Parsing**: Extracts `submissionId` from URL query parameters in loader
- **Type Safety**: Ensures submission ID is validated as integer before database query

### 5. Multiple Access Points
- **Submissions Table**: Grade button in the main submissions table
- **Submission History**: Grade menu item in expandable submission history dropdown
- **Direct URL**: Can be accessed directly with `?submissionId=X` query parameter

## Technical Implementation

### New Files Created

#### `app/routes/course/module.$id.grading.tsx`
```typescript
// Key components:
- gradingSearchParams: nuqs schema for submissionId
- loadSearchParams: Server-side query param loader
- loader: Fetches submission data from database
- ModuleGradingPage: Main component with submission display and grading form
```

**Loader Logic**:
1. Validates user authentication and permissions
2. Extracts `submissionId` from query parameters using nuqs
3. Fetches submission using `tryGetAssignmentSubmissionById`
4. Verifies submission belongs to the current module
5. Returns submission data or null if no ID provided

**Component Features**:
- Error state when no submission selected
- Student information extraction (handles depth 0 and 1)
- Rich text content rendering
- Attachment display with download links
- Uncontrolled form with score and feedback inputs

### Modified Files

#### `app/routes.ts`
- Added grading route within course-module-layout:
  ```typescript
  route("course/module/:id/grading", "routes/course/module.$id.grading.tsx")
  ```

#### `server/contexts/global-context.ts`
- Added `isCourseModuleGrading: boolean` to PageInfo interface

#### `server/index.ts`
- Added `isCourseModuleGrading: false` to initial pageInfo

#### `app/root.tsx`
- Added route detection for grading page in middleware
- Updates pageInfo context with grading page state

#### `app/components/submission-history.tsx`
**New Imports**:
- `Menu` component from Mantine
- `IconDots`, `IconPencil` icons
- `Link` from react-router

**Enhanced Features**:
- Shows submission ID in default variant
- Menu component with Grade and Delete actions
- Props: `showGrade`, `moduleLinkId` for conditional features
- Grade action links to grading page with submissionId query param

#### `app/routes/course/module.$id.submissions.tsx`
- Updated `StudentSubmissionRow` to accept `moduleLinkId` prop
- Grade button links to grading page with proper module ID and submission ID
- Submission history items include grade action when expanded

## Database Integration

### Submission Fetching
Uses existing `tryGetAssignmentSubmissionById` internal function:
- Fetches submission with depth 1 (includes related entities)
- Returns type-narrowed submission with validated references
- Includes student, enrollment, and course module link data

### Type Handling
Properly handles Payload CMS depth system:
- **Student field**: Can be object (depth 1) or number (depth 0)
- **File attachments**: Can be object with filename or just ID
- **Type narrowing**: Checks object type before accessing properties
- **Fallbacks**: Provides sensible defaults for missing data

## User Experience Improvements

### For Instructors
1. **Quick Access**: Multiple entry points to grade submissions
2. **Clear Context**: See student info and submission status at a glance
3. **Rich Feedback**: Use formatted text for detailed feedback
4. **File Access**: Direct download links for all attachments
5. **Visual Clarity**: Clean layout with separated sections

### For System Administration
1. **Submission Tracking**: ID visible in submission history
2. **Action Organization**: Menu-based actions prevent UI clutter
3. **Extensibility**: Easy to add more actions to the menu

## Permissions and Access Control

### Permission Checks
- Uses `canSeeModuleSubmissions` to validate grading access
- Checks in both layout and grading page loader
- Only instructors and TAs can access grading interface

### Validation
- Verifies submission belongs to the current module
- Validates user has appropriate role in course
- Returns 403 Forbidden for unauthorized access

### Module Type Support
- Currently supports assignment submissions only
- Returns error for quiz/discussion submissions
- Structure allows easy extension to other module types

## Route Structure

The grading page sits within the course module layout hierarchy:
```
layouts/course-layout
  └── layouts/course-content-layout
      └── layouts/course-module-layout
          ├── course/module/:id (preview)
          ├── course/module/:id/edit (settings)
          ├── course/module/:id/submissions (list)
          └── course/module/:id/grading (NEW - grade individual submission)
```

This placement provides:
- Shared course and module context
- Consistent header with tabs
- Access to course permissions and enrollment data

## UI Components and Styling

### Layout Structure
1. **Header Section**: Student info, badges, submission date
2. **Content Section**: Rendered submission text and attachments
3. **Grading Form**: Score input and feedback editor

### Mantine Components Used
- `Container`, `Stack`, `Paper`, `Group` for layout
- `Alert` for error states
- `Badge` for status indicators
- `NumberInput` for score entry
- `SimpleRichTextEditor` for feedback
- `Button` for form submission

### Visual Consistency
- Follows existing design patterns from submissions page
- Uses same badge colors for status indicators
- Consistent spacing and border styles
- Responsive container sizing

## Error Handling

### Missing Submission ID
- Shows alert with instruction to return to submissions page
- Clear error message in red Alert component
- No crash or blank page

### Invalid Submission
- Database query errors caught and returned as BadRequest
- Type validation ensures data integrity
- Falls back to "Unknown Student" if data missing

### Permission Denied
- Throws ForbiddenResponse for unauthorized users
- Caught by error boundary and displayed appropriately
- Clear feedback about permission requirements

## Integration with Existing Features

### Course Module Context
- Leverages existing `courseModuleContext` from middleware
- Uses module settings for display name
- Accesses submissions data already loaded in context

### Submission History Component
- Enhanced to work in multiple contexts (student and instructor views)
- Backward compatible with existing usage
- Optional props don't break existing implementations

### Permissions System
- Uses existing `canSeeModuleSubmissions` function
- Consistent with other permission checks in the app
- No new permission types needed

## Future Enhancements

### Immediate Next Steps
1. **Implement Grading Action**: Connect form submission to database update
2. **Grade History**: Show previous grades and feedback
3. **Navigation**: Add next/previous submission buttons
4. **Auto-save**: Save draft feedback automatically

### Planned Features
1. **Rubric Support**: Integrate grading rubrics
2. **Inline Comments**: Allow commenting on specific parts of submission
3. **Batch Grading**: Grade multiple submissions in sequence
4. **Quiz Grading**: Extend to quiz and discussion submissions
5. **Grade Analytics**: Show grade distribution and statistics
6. **Return Submission**: Allow returning graded work to students
7. **Grade Notifications**: Notify students when grades are posted

### UI Enhancements
1. **Attachment Preview**: Show PDF/image previews inline
2. **Side-by-side View**: Show rubric alongside submission
3. **Keyboard Shortcuts**: Quick navigation and actions
4. **Grade Templates**: Save common feedback messages
5. **Plagiarism Check**: Integration with plagiarism detection

## Testing Considerations

### Manual Testing Checklist
- [ ] Access grading page from submissions table
- [ ] Access grading page from submission history dropdown
- [ ] Verify submission content renders correctly
- [ ] Check attachment download links work
- [ ] Test form submission logs to console
- [ ] Verify error state when no submission ID
- [ ] Test permission checks for different roles
- [ ] Verify submission belongs to correct module
- [ ] Check responsive layout on different screen sizes

### Edge Cases to Test
- Student with no name (only email)
- Submission with no content
- Submission with no attachments
- Large number of attachments
- Very long submission text
- Special characters in student names
- Expired or invalid submission IDs

## Migration Notes

### No Database Changes
- No new tables or columns required
- Uses existing submission data structure
- No migration scripts needed

### No Breaking Changes
- All changes are additive
- Existing routes and components unchanged (except enhancements)
- Backward compatible with previous versions

## Documentation Updates Needed

1. **User Guide**: How to grade submissions
2. **Instructor Manual**: Grading workflow and best practices
3. **API Documentation**: Query parameter format
4. **Component Library**: SubmissionHistory component updates
5. **Permission Matrix**: Grading access requirements

## Performance Considerations

### Database Queries
- Single query to fetch submission (depth 1)
- No N+1 query problems
- Efficient for typical submission sizes

### Page Load
- Minimal data fetching (only one submission)
- Rich text editor loads on demand
- Attachments not preloaded (download on click)

### Optimizations
- Could add submission caching in context
- Could prefetch next submission
- Could lazy load rich text editor

## Conclusion

This implementation provides a solid foundation for assignment grading in the LMS. The page follows established patterns in the codebase, uses type-safe query parameters, and integrates seamlessly with existing course and module contexts. The enhanced submission history component adds flexibility for future features while maintaining backward compatibility.

The modular design allows for easy extension to support quiz and discussion grading, as well as more advanced features like rubrics, inline comments, and batch grading workflows.

