# Unified Grading Views for All Module Types

**Date:** 2025-11-18  
**Type:** Feature Addition & Component Refactoring  
**Impact:** Medium - Extends grading functionality to support quiz and discussion submissions, with some limitations

## Overview

This changelog documents the extension of the grading system to support quiz and discussion submissions in addition to assignments. Previously, the grading view was limited to assignments only. The implementation includes component refactoring, new grading view components, and updates to the submissions route to handle multiple module types. However, some features remain incomplete and are noted as future work.

## Key Changes

### 1. Component Refactoring

#### Renamed Assignment Grading View
- **Location**: `app/components/grading-view.tsx`
- **Change**: `GradingView` component renamed to `AssignmentGradingView`
- **Reason**: Better reflects the component's specific purpose and allows for module-type-specific grading views
- **Impact**: All imports and usages updated throughout the codebase

### 2. New Grading View Components

#### Quiz Grading View
- **Location**: `app/components/quiz-grading-view.tsx`
- **Purpose**: Dedicated grading interface for quiz submissions
- **Features**:
  - Displays quiz submission metadata (attempt number, status, time spent, auto score)
  - Shows student information
  - Grading form with score input and feedback textarea
  - Release grade functionality (when applicable)
  - **Quiz Answers Display**: Currently shows answers as formatted JSON in a code block (mock UI)
- **Status**: Partially implemented
  - ✅ UI structure complete
  - ✅ Grading form functional
  - ⚠️ Answers displayed as JSON (needs proper UI implementation)
  - ⚠️ Server-side grading uses auto-grading only (manual grading not yet implemented)

#### Discussion Grading View
- **Location**: `app/components/discussion-grading-view.tsx`
- **Purpose**: Dedicated grading interface for discussion submissions
- **Features**:
  - Displays discussion participation metadata
  - Shows student information
  - Grading form with score input and feedback textarea
  - Release grade functionality (when applicable)
  - **Discussion Content Display**: Currently shows placeholder text (mock UI)
- **Status**: Mock implementation
  - ✅ UI structure complete
  - ✅ Grading form functional
  - ⚠️ Discussion content display not implemented
  - ⚠️ Server-side grading not implemented

### 3. Submissions Route Updates

#### Loader Enhancements
- **Location**: `app/routes/course/module.$id.submissions.tsx`
- **Changes**:
  - Added support for fetching quiz submissions when `action=gradesubmission&submissionId=X` for quiz modules
  - Added support for fetching discussion submissions (using existing submissions from context)
  - Introduced `gradingModuleType` to track which type of submission is being graded
  - Module type detection based on `courseModuleContext.module.type`

**Implementation Details**:
```typescript
// Determines module type and fetches appropriate submission
if (moduleType === "assignment") {
  // Fetch assignment submission
} else if (moduleType === "quiz") {
  // Fetch quiz submission using tryGetQuizSubmissionById
} else if (moduleType === "discussion") {
  // Use submission from moduleSpecificData (temporary solution)
}
```

#### Action Handler Updates
- **Location**: `app/routes/course/module.$id.submissions.tsx`
- **Changes**:
  - Extended POST action to handle grading for quiz and discussion submissions
  - Assignment grading: Uses `tryGradeAssignmentSubmission` (manual grading)
  - Quiz grading: Uses `tryGradeQuizSubmission` (auto-grading only)
  - Discussion grading: Returns error (not yet implemented)

**Grading Flow by Module Type**:
- **Assignment**: Manual grading with score and feedback input
- **Quiz**: Currently uses auto-grading (`tryGradeQuizSubmission` calculates grade automatically)
  - ⚠️ **Limitation**: Manual grading override not yet implemented
  - The form allows score input, but the server-side function uses auto-grading
- **Discussion**: Returns error message "Discussion grading not yet implemented"

#### Component Rendering Updates
- **Location**: `app/routes/course/module.$id.submissions.tsx`
- **Changes**:
  - Conditional rendering based on `gradingModuleType`
  - Shows appropriate grading view component:
    - `AssignmentGradingView` for assignments
    - `QuizGradingView` for quizzes
    - `DiscussionGradingView` for discussions
  - Supports both `AssignmentActions.GRADE_SUBMISSION` and `QuizActions.GRADE_SUBMISSION` action types

### 4. Quiz Answers Display

#### Current Implementation
- **Location**: `app/components/quiz-grading-view.tsx`
- **Display Method**: JSON code block using Mantine's `Code` component
- **Format**: Pretty-printed JSON with 2-space indentation
- **Status**: Mock UI - functional but needs proper UI implementation

**Example Display**:
```json
[
  {
    "questionId": "q1",
    "questionText": "What is 2+2?",
    "questionType": "multiple_choice",
    "selectedAnswer": "4",
    "multipleChoiceAnswers": [
      { "option": "3", "isSelected": false },
      { "option": "4", "isSelected": true }
    ],
    "isCorrect": true,
    "pointsEarned": 10,
    "maxPoints": 10
  }
]
```

**Future Enhancement Needed**:
- Replace JSON display with proper UI showing:
  - Question text and type
  - Student's selected answers
  - Correct/incorrect indicators
  - Points earned per question
  - Visual feedback for each answer

## Technical Details

### Type Definitions

#### QuizGradingViewProps
```typescript
export interface QuizGradingViewProps {
  submission: {
    id: number;
    attemptNumber: number;
    status: "in_progress" | "completed" | "graded" | "returned";
    answers?: Array<{
      questionId: string;
      questionText?: string | null;
      questionType: "multiple_choice" | "true_false" | "short_answer" | "essay" | "fill_blank";
      selectedAnswer?: string | null;
      multipleChoiceAnswers?: Array<{
        option: string;
        isSelected?: boolean | null;
      }> | null;
      isCorrect?: boolean | null;
      pointsEarned?: number | null;
      maxPoints?: number | null;
      feedback?: string | null;
    }> | null;
    // ... other fields
  };
  // ... other props
}
```

### Module Action Support

#### Updated Action Constants
- **Location**: `app/utils/module-actions.ts`
- **Change**: `QuizActions.GRADE_SUBMISSION` already existed, now properly utilized
- **Usage**: Both assignment and quiz grading use the same action parameter format

### Server-Side Integration

#### Quiz Grading Function
- **Location**: `server/internal/quiz-submission-management.ts`
- **Function**: `tryGradeQuizSubmission`
- **Current Behavior**: 
  - Automatically calculates grade based on answers
  - Updates submission status to "graded"
  - Creates gradebook entry
  - **Limitation**: Does not accept manual score override

#### Discussion Grading
- **Status**: Not implemented
- **Current Behavior**: Returns error in action handler
- **Future**: Needs implementation similar to assignment grading

## Files Changed

### New Files
- `app/components/quiz-grading-view.tsx` - Quiz grading interface
- `app/components/discussion-grading-view.tsx` - Discussion grading interface (mock)

### Modified Files
- `app/components/grading-view.tsx` - Renamed component to `AssignmentGradingView`
- `app/routes/course/module.$id.submissions.tsx` - Extended loader, action, and component to support quiz and discussion grading
- `app/utils/module-actions.ts` - Already had `QuizActions.GRADE_SUBMISSION`, now properly utilized

## User Impact

### Positive Changes
1. **Unified Grading Experience**: All module types now have dedicated grading views
2. **Consistent UI**: Similar layout and functionality across all grading views
3. **Better Organization**: Module-specific components improve code maintainability
4. **Quiz Grading Access**: Teachers can now access quiz submissions for grading (via auto-grading)

### Limitations & Known Issues
1. **Quiz Manual Grading**: 
   - Form allows score input, but server-side uses auto-grading only
   - Manual score override not yet implemented
   - Feedback can be added, but score is calculated automatically

2. **Quiz Answers Display**:
   - Currently shown as JSON code block (mock UI)
   - Needs proper UI implementation showing questions and answers in a user-friendly format

3. **Discussion Grading**:
   - UI structure exists but is mock implementation
   - Server-side grading not implemented
   - Discussion content display not implemented

## Migration Notes

### For Developers
- Update any imports of `GradingView` to `AssignmentGradingView`
- When implementing quiz answer UI, replace the JSON code block in `QuizGradingView`
- When implementing discussion grading, complete the server-side action handler

### For Users
- Quiz submissions can now be accessed for grading via the submissions table
- Quiz grading currently uses automatic scoring (manual override coming soon)
- Discussion grading is not yet available

## Future Enhancements

### High Priority
1. **Quiz Manual Grading Override**:
   - Implement server-side function to accept manual score
   - Update `tryGradeQuizSubmission` or create new function for manual grading
   - Allow teachers to override auto-calculated scores

2. **Quiz Answers UI**:
   - Replace JSON display with proper question/answer UI
   - Show question text, type, and student answers
   - Display correct/incorrect indicators
   - Show points earned per question
   - Visual feedback for grading decisions

3. **Discussion Grading Implementation**:
   - Implement server-side grading function
   - Add discussion content display
   - Complete the grading workflow

### Medium Priority
1. **Enhanced Quiz Grading**:
   - Per-question feedback
   - Partial credit assignment
   - Question-level score adjustment

2. **Discussion Participation Metrics**:
   - Thread count
   - Reply count
   - Upvote contributions
   - Quality indicators

## Testing Considerations

### Manual Testing Required
1. **Quiz Grading Flow**:
   - Access quiz submission via submissions table
   - Verify JSON answers display correctly
   - Submit grade and verify auto-grading behavior
   - Check gradebook entry creation

2. **Discussion Grading Flow**:
   - Access discussion submission (when implemented)
   - Verify mock UI displays correctly
   - Test error handling for unimplemented grading

3. **Assignment Grading**:
   - Verify existing functionality still works after refactoring
   - Check that `AssignmentGradingView` renders correctly

### Test Coverage
- Component rendering tests for new grading views
- Action handler tests for quiz and discussion grading
- Integration tests for complete grading workflows

## Related Changelogs
- `0059-2025-11-18-submission-tables-component-refactoring.md` - Submission table components
- `0050-2025-11-14-quiz-attempt-management-and-instructions-view.md` - Quiz submission management
- `0051-2025-11-14-assignment-grading-workflow-refactor.md` - Assignment grading system

