# Quiz Components Context Refactoring

**Date:** 2026-01-14  
**Type:** Refactoring, Architecture Improvement, Bug Fix  
**Impact:** High - Eliminates prop drilling, fixes TypeScript errors, and improves quiz component architecture

## Overview

This update refactors quiz components to use `constate` contexts instead of excessive prop drilling. The refactoring eliminates numerous TypeScript errors, simplifies component interfaces, and makes the data flow more explicit and maintainable. Two new contexts are introduced: `QuestionContext` for individual question data and `NestedQuizContext` for container quiz nested quiz management.

## Problem Statement

The quiz component architecture suffered from excessive prop drilling, causing:
- **TypeScript Errors**: Missing or incorrect types due to complex prop passing through multiple layers
- **Maintenance Burden**: Components receiving many props that needed to be threaded through multiple levels
- **Undefined Variables**: References to `flaggedQuestions`, `initialAnswers`, and `submissionId` that weren't properly passed
- **Complex Data Flow**: Route → QuizAttemptComponent → RegularQuizAttemptComponent/ContainerQuizAttemptComponent → QuestionCard → nested components

## Key Changes

### 1. New Contexts

#### QuestionContext
**File:** `app/routes/course/module.$id/components/quiz/question-context.tsx` (new)

Wraps each individual `QuestionCard` with all necessary data (question, answer, flags, submissionId, moduleLinkId, etc.). Benefits: no prop drilling, type-safe access, easy to test.

#### NestedQuizContext
**File:** `app/routes/course/module.$id/components/quiz/nested-quiz-context.tsx` (new)

Centralizes nested quiz state management for container quizzes. Provides: active nested quiz, completion status, timer info, and quiz config. Eliminates prop drilling to `NestedQuizSelector` and nested quiz components.

### 2. Enhanced Existing Contexts

**RegularQuizAttemptContext** - Added `moduleLinkId` and `quizPageIndex` for route params.

**ContainerQuizAttemptContext** - Added `moduleLinkId`, `quizPageIndex`, and `nestedQuizId` for nested quiz navigation.

### 3. Nested Quiz Completion Handling

**Completed in follow-up commits (7e73adf, c94dfb1, 750d145, 85eacad)**

- **QuizSubmissionModal**: Now differentiates between regular and nested quiz submissions, automatically using the correct action based on context (`nestedQuizId` from context).
- **NestedQuizSelector**: Integrated "Mark as Complete" button with warning dialog for incomplete nested quizzes. Removed separate `MarkNestedQuizCompleteButton` component.
- **Navigation**: Enhanced to support exiting nested quizzes and returning to selector.
- **Server**: Enhanced `tryMarkNestedQuizAsComplete` to return `isLastNestedQuiz` flag and auto-complete container quiz when all nested quizzes are done.

### 4. Refactored Components

All components now use contexts instead of props:

- **QuestionCard**: Removed all props, uses `useQuestionContext()` hook
- **NestedQuizSelector**: Removed all props, uses `useNestedQuizContext()` and `useContainerQuizAttemptContext()`
- **RegularQuizAttemptComponent**: Accesses data from `useRegularQuizAttemptContext()`, wraps questions with `QuestionContextProvider`
- **ContainerQuizAttemptComponent**: Uses `useContainerQuizAttemptContext()` and `NestedQuizContextProvider`, fixed syntax error

### 5. Bug Fixes

- Fixed syntax error in `ContainerQuizAttemptComponent` (incomplete ternary operator)
- Fixed type error in `route.tsx` for `completedNestedQuizzes` (was `CompletedNestedQuiz[][]`, now `CompletedNestedQuiz[]`)
- Fixed undefined variable references: `flaggedQuestions`, `initialAnswers`, `submissionId`, `moduleLinkId` - now all accessed from context

### 6. Code Quality Improvements

- Removed unused imports and variables
- Fixed linter warnings
- Improved type safety (no `any`, proper TypeScript interfaces, `Jsonify` types for React Router)

## Technical Details

### Modified Files

#### New Files
1. `app/routes/course/module.$id/components/quiz/question-context.tsx` - QuestionContext using constate
2. `app/routes/course/module.$id/components/quiz/nested-quiz-context.tsx` - NestedQuizContext using constate

#### Modified Files
1. `app/routes/course/module.$id/components/quiz/quiz-attempt-component.tsx` - Updated contexts, removed prop drilling
2. `app/routes/course/module.$id/components/quiz/container-quiz-attempt-component.tsx` - Uses contexts, fixed syntax error
3. `app/routes/course/module.$id/components/quiz/question-card.tsx` - No props, uses `useQuestionContext()`
4. `app/routes/course/module.$id/components/quiz/nested-quiz-selector.tsx` - No props, integrated completion button
5. `app/routes/course/module.$id/route.tsx` - Updated component calls, fixed types
6. `app/routes/course/module.$id/components/quiz/quiz-navigation.tsx` - Enhanced for nested quiz exit
7. `app/routes/course/module.$id/components/quiz/quiz-submission-modal.tsx` - Dual submission support (regular/nested)
8. `app/routes/course/module.$id/components/quiz/mark-nested-quiz-complete-button.tsx` - **Deleted** (functionality integrated)
9. `server/internal/quiz-submission-management.ts` - Enhanced nested quiz completion handling

### Context Provider Hierarchy

```
QuizAttemptComponent
  ├─ RegularQuizAttemptContext (regular quizzes)
  │   └─ QuestionContextProvider (per question)
  │       └─ QuestionCard
  └─ ContainerQuizAttemptContext (container quizzes)
      └─ NestedQuizContextProvider
          ├─ NestedQuizSelector
          └─ RegularQuizAttemptComponent (for nested quiz)
              └─ QuestionContextProvider (per question)
                  └─ QuestionCard
```

## User Experience Impact

- **No Visual Changes**: All refactoring is internal - UI remains identical
- **Better Performance**: Reduced re-renders due to granular context usage
- **Improved Reliability**: Fixed TypeScript errors prevent runtime bugs
- **Faster Development**: Easier to add new features without prop drilling

### No Breaking Changes
- All changes are internal refactorings
- Component APIs remain compatible
- No database migrations required

## Testing Considerations

### Key Test Scenarios
- Regular quiz: Start, answer questions, navigate, submit, flag/unflag
- Container quiz: View selector, start nested quiz, complete nested quiz, verify auto-completion
- Nested quiz completion: Manual completion with warning for incomplete quizzes
- Navigation: Exit nested quiz, return to selector
- Submission modal: Verify correct action (regular vs nested) based on context
- Readonly mode: View completed submissions for both quiz types

### Edge Cases
- Quiz with no questions, single page, multiple pages
- Container quiz with 0, 1, or multiple nested quizzes
- Timer expiration (parent and nested)
- Sequential order enforcement
- All question types (multiple-choice, short-answer, essay, whiteboard, etc.)

## Migration Notes

### No Database Changes
- No schema changes required
- All changes are in application logic and component structure

### Code Updates Required
None - all changes are internal to quiz components.

### Backward Compatibility
Fully backward compatible - no API changes for external consumers.

## Performance Considerations

- Each `QuestionCard` has its own context provider for isolation (prevents unnecessary re-renders)
- Parent contexts rarely change, minimizing re-renders
- Minimal memory overhead from lightweight context providers
- No significant impact on bundle size

## Related Issues

This changelog addresses:
- TypeScript errors in quiz components due to prop drilling
- Syntax and type errors in various components
- Undefined variable references
- Excessive prop drilling making components hard to maintain
- Inconsistent nested quiz completion handling
- Component duplication with separate `MarkNestedQuizCompleteButton`

## Design Decisions

### Individual QuestionContext vs Shared Context
Each `QuestionCard` has its own context provider for:
1. **Isolation**: Updates to one question don't trigger re-renders of others
2. **Simplicity**: No need to manage question IDs for lookups
3. **Type Safety**: Each context is strongly typed with exact data
4. **React Best Practice**: Granular updates pattern

### Route Params in Contexts
Route params are included in contexts rather than accessed via `loaderData` for:
1. **Centralization**: All data access through contexts
2. **Consistency**: Same pattern for all data
3. **Testing**: Easier to mock contexts
4. **Flexibility**: Can be used outside route components

## Conclusion

This refactoring significantly improves the quiz component architecture by eliminating prop drilling and introducing well-structured contexts. The changes fix all TypeScript errors, improve code maintainability, and make the data flow more explicit. The two-level context hierarchy (Attempt Context → Question/Nested Context) strikes the right balance between eliminating prop drilling and avoiding over-engineering.

The follow-up improvements to nested quiz completion handling complete the feature with proper warnings, integrated UI components, and context-aware submission logic. The removal of the separate `MarkNestedQuizCompleteButton` component demonstrates the benefits of the context-based architecture.

**Note**: This changelog was initially written on 2026-01-14 when the context refactoring was completed. Additional improvements to nested quiz completion handling were completed in follow-up commits (7e73adf, c94dfb1, 750d145, 85eacad) and have been documented in this updated version.
