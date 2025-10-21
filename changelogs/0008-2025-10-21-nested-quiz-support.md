# Changelog 0008 - Nested Quiz Support with Sequential/Free-Order Completion

**Date:** 2025-10-21  
**Type:** Major Feature  
**Status:** Completed

## Summary

Implemented support for nested quizzes within a container quiz, enabling multi-section exams with isolated state management. Each nested quiz can have its own timer, and both parent and nested timers run simultaneously. Quizzes can be configured to require sequential completion or allow free-order access. Completed quizzes become read-only and can be reviewed at any time.

## Changes Made

### Type System Updates

#### 1. Enhanced Quiz Configuration Types (`app/components/activity-modules-preview/quiz-config.types.ts`)

**New Interface: NestedQuizConfig**
```typescript
interface NestedQuizConfig {
  id: string;
  title: string;
  description?: string;
  pages: QuizPage[];
  showImmediateFeedback: boolean;
  globalTimer?: number;
}
```

**Modified Interface: QuizConfig**
- Now supports EITHER `pages` (regular quiz) OR `nestedQuizzes` (container quiz)
- Added `nestedQuizzes?: NestedQuizConfig[]` - Array of nested quizzes
- Added `sequentialOrder?: boolean` - Controls access order (default: false)

**New Type Guards**
- `isContainerQuiz(config: QuizConfig): boolean` - Check if quiz contains nested quizzes
- `isRegularQuiz(config: QuizConfig): boolean` - Check if quiz has pages directly

### State Management

#### 2. New Hook: `use-nested-quiz-state.ts`

Manages nested quiz completion and navigation:

**State Tracked:**
- Current active nested quiz ID
- Set of completed quiz IDs
- Submitted answers for each nested quiz

**Key Functions:**
- `startNestedQuiz(quizId)` - Enter a nested quiz
- `completeNestedQuiz(quizId, answers)` - Submit and mark quiz complete
- `exitToContainer()` - Return to quiz selector
- `isQuizCompleted(quizId)` - Check completion status
- `isQuizAccessible(quizId)` - Check if quiz can be started
- `canAccessQuiz(quiz)` - Full access validation

**Access Control Logic:**
- **Sequential Mode:** Quizzes must be completed in order; next quiz unlocks after previous completion
- **Free Order Mode:** All uncompleted quizzes are accessible
- **Always Accessible:** Completed quizzes can be reviewed anytime

**Progress Tracking:**
- `allQuizzesCompleted` - Boolean flag for full completion
- `completionProgress` - Percentage (0-100) of completed quizzes

#### 3. Enhanced Hook: `use-quiz-form.ts`

**New Options:**
- `readonly?: boolean` - Disables all interactions for viewing submitted answers
- `initialAnswers?: QuizAnswers` - Pre-populate form with previous submission

**Updated Signature:**
```typescript
function useQuizForm({
  quizConfig: QuizConfig | NestedQuizConfig,
  readonly?: boolean,
  initialAnswers?: QuizAnswers,
}): UseQuizFormReturn
```

**Readonly Behavior:**
- All form inputs disabled
- Navigation still works (view-only)
- No answer modifications allowed
- Flag buttons hidden

### UI Components

#### 4. New Component: `nested-quiz-selector.tsx`

Displays list of nested quizzes in container view:

**Visual Features:**
- Card-based layout for each quiz
- Quiz numbering (Quiz 1, Quiz 2, etc.)
- Status badges: "Available" (blue), "Completed" (green), "Locked" (gray)
- Lock icons for inaccessible quizzes
- Overall progress bar showing X/Y completed
- Quiz metadata: title, description, timer duration, page count

**Interactive Elements:**
- "Start Quiz" button for available quizzes
- "View Submission" button for completed quizzes
- "Complete Previous Quizzes" disabled button for locked quizzes
- "Time Expired" disabled button when parent timer expires

**Sequential Order Notice:**
- Shows informational text when `sequentialOrder: true`

#### 5. New Component: `nested-quiz-wrapper.tsx`

Top-level coordinator managing parent/nested quiz interaction:

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Overall Time Limit (parent timer)  │  ← Always visible when set
├─────────────────────────────────────┤
│ Current Quiz Time (nested timer)   │  ← Only when inside nested quiz
├─────────────────────────────────────┤
│                                     │
│  NestedQuizSelector OR QuizPreview  │
│                                     │
└─────────────────────────────────────┘
```

**Responsibilities:**
- Detect quiz type using type guards
- Render `NestedQuizSelector` for container view
- Render `QuizPreview` when inside nested quiz
- Manage both timers simultaneously
- Handle parent timer expiration (locks all quizzes)
- Pass readonly flag and initial answers for completed quizzes
- Coordinate navigation between container and nested views

**Timer Behavior:**
- Parent timer runs continuously throughout all quizzes
- Nested timer only runs for current active quiz
- Both timers displayed with color coding (green > yellow > red)
- Parent expiration locks all quiz interactions
- Nested expiration auto-submits that specific quiz

#### 6. Enhanced Component: `quiz-preview.tsx`

**New Props:**
- `quizConfig?: QuizConfig | NestedQuizConfig` - Support both types
- `readonly?: boolean` - Enable view-only mode
- `initialAnswers?: QuizAnswers` - Pre-populate answers
- `onSubmit?: (answers) => void` - Callback for submission
- `onExit?: () => void` - Callback for exit button
- `disableInteraction?: boolean` - External disable flag

**Readonly Mode Features:**
- Blue alert banner: "You are viewing a previously submitted quiz"
- All question inputs disabled
- Flag buttons hidden
- Timer hidden
- Navigation buttons: "Exit" (left), "Previous/Next" (right)
- Submit button replaced with navigation
- Cannot modify any answers

**Updated Interaction Logic:**
- `isDisabled = readonly || isGlobalTimerExpired || disableInteraction`
- All interactive elements respect disabled state
- Question renderers receive disabled prop

### Integration & Exports

#### 7. Updated Exports (`activity-module-forms/index.ts`)

**New Component Exports:**
- `NestedQuizWrapper` - Main wrapper component
- `NestedQuizSelector` - Quiz list component

**New Hook Exports:**
- `useNestedQuizState` - State management hook

**New Type Exports:**
- `NestedQuizConfig` - Nested quiz interface

**New Function Exports:**
- `isContainerQuiz` - Type guard
- `isRegularQuiz` - Type guard

**New Sample Config:**
- `sampleNestedQuizConfig` - Example multi-section exam

### Sample Configuration

#### 8. Sample Nested Quiz (`sampleNestedQuizConfig`)

Demonstrates all features:
- **Title:** "Multi-Section Exam"
- **Parent Timer:** 30 minutes
- **Sequential Order:** Enabled
- **3 Nested Quizzes:**
  1. **Section 1:** Basic Concepts (5 min timer, 2 questions)
  2. **Section 2:** Intermediate Topics (10 min timer, 3 questions)
  3. **Section 3:** Advanced Concepts (15 min timer, 4 questions)

**Question Type Coverage:**
- Multiple choice, short answer, long answer
- Fill in the blank, choice (multi-select)
- Ranking, article, whiteboard
- Single selection matrix

## Technical Implementation Details

### Backward Compatibility

- **Breaking Changes:** None
- Existing `QuizConfig` with `pages` property works unchanged
- New optional properties don't affect old configs
- `QuizPreview` accepts both config types

### State Isolation

- Each nested quiz has independent form state
- Answers stored separately per quiz ID
- Completion tracking via Set for O(1) lookups
- No state leakage between quizzes

### Timer Coordination

- Parent timer uses top-level `useQuizTimer` hook
- Nested timer embedded in QuizPreview via props
- Both timers memoized to prevent re-renders
- Independent countdown and expiration handling

### Access Control

Sequential mode implementation:
```typescript
// Quiz is accessible if:
1. Already completed (for review)
2. First quiz (index 0)
3. All previous quizzes completed
```

Free order mode implementation:
```typescript
// Quiz is accessible if:
1. Already completed (for review)
2. Not completed (any order)
```

### Performance Considerations

- Memoized timer components prevent parent re-renders
- Uncontrolled form mode for better performance
- Set-based completion tracking (O(1))
- Minimal state updates on timer ticks

### Type Safety

- Full TypeScript coverage with strict null checks
- Discriminated unions for quiz types
- Type guards prevent invalid configurations
- No type casting in component logic

## Usage Examples

### Container Quiz with Sequential Order

```typescript
import { 
  NestedQuizWrapper, 
  sampleNestedQuizConfig,
  type QuizConfig 
} from "~/components/activity-module-forms";

// Use sample config
<NestedQuizWrapper quizConfig={sampleNestedQuizConfig} />

// Custom config
const myExam: QuizConfig = {
  id: "midterm-exam",
  title: "Midterm Examination",
  showImmediateFeedback: false,
  globalTimer: 3600, // 1 hour total
  sequentialOrder: true,
  nestedQuizzes: [
    {
      id: "part-1",
      title: "Part 1: Theory",
      description: "Fundamental concepts",
      showImmediateFeedback: false,
      globalTimer: 1200, // 20 minutes
      pages: [/* ... */],
    },
    {
      id: "part-2",
      title: "Part 2: Practice",
      description: "Applied problems",
      showImmediateFeedback: false,
      globalTimer: 2400, // 40 minutes
      pages: [/* ... */],
    },
  ],
};
```

### Free-Order Quiz

```typescript
const assessmentQuiz: QuizConfig = {
  id: "skills-assessment",
  title: "Skills Assessment",
  showImmediateFeedback: true,
  globalTimer: 1800, // 30 minutes
  sequentialOrder: false, // Any order
  nestedQuizzes: [
    // 3 independent skill areas
    // Student can choose order
  ],
};
```

### Regular Quiz (Unchanged)

```typescript
const regularQuiz: QuizConfig = {
  id: "simple-quiz",
  title: "Simple Quiz",
  showImmediateFeedback: true,
  pages: [/* ... */],
};

// Still works with QuizPreview or NestedQuizWrapper
<QuizPreview quizConfig={regularQuiz} />
<NestedQuizWrapper quizConfig={regularQuiz} /> // Auto-detects regular quiz
```

## Testing Considerations

### Test Scenarios

1. **Sequential Access:**
   - Cannot access quiz 3 without completing 1 and 2
   - Previous quizzes become accessible after completion
   - Locked quizzes show disabled state

2. **Free Order:**
   - All uncompleted quizzes accessible immediately
   - Order of completion doesn't matter
   - Progress updates correctly

3. **Timer Coordination:**
   - Both timers count down simultaneously
   - Parent expiration locks all nested quizzes
   - Nested expiration only affects current quiz
   - Color coding updates correctly (green → yellow → red)

4. **Readonly Mode:**
   - Displays previous answers correctly
   - All inputs disabled
   - Navigation works in view-only mode
   - Exit button returns to selector

5. **State Persistence:**
   - Answers saved on nested quiz completion
   - Can review completed quizzes anytime
   - Submitted answers read-only
   - Progress tracking accurate

6. **Edge Cases:**
   - Empty nested quizzes array
   - Single nested quiz
   - No timers configured
   - Parent timer expires during quiz
   - Rapid navigation between quizzes

## Migration Notes

### For Existing Code

No migration required. Existing quiz implementations continue to work:

```typescript
// Before: Works unchanged
<QuizPreview quizConfig={existingQuizConfig} />

// After: Still works, plus new wrapper option
<NestedQuizWrapper quizConfig={existingQuizConfig} />
```

### Upgrading to Nested Quizzes

To convert existing quiz to nested format:

```typescript
// Before: Regular quiz
const oldQuiz: QuizConfig = {
  id: "quiz-1",
  title: "My Quiz",
  showImmediateFeedback: true,
  pages: [page1, page2],
};

// After: Container quiz
const newQuiz: QuizConfig = {
  id: "quiz-1",
  title: "My Quiz",
  showImmediateFeedback: true,
  sequentialOrder: true,
  nestedQuizzes: [
    {
      id: "section-1",
      title: "Section 1",
      showImmediateFeedback: true,
      pages: [page1],
    },
    {
      id: "section-2",
      title: "Section 2",
      showImmediateFeedback: true,
      pages: [page2],
    },
  ],
};
```

## Future Enhancements

Potential improvements for future iterations:

1. **Nested Quiz Analytics:**
   - Time spent per section
   - Completion rates by section
   - Average scores per nested quiz

2. **Advanced Timer Options:**
   - Time bonuses for early completion
   - Extra time for accessibility
   - Pause/resume functionality

3. **Randomization:**
   - Random order for free-order mode
   - Random question selection per section
   - Randomized nested quiz presentation

4. **Progress Persistence:**
   - Save/resume partially completed quizzes
   - Cloud sync of quiz state
   - Offline quiz completion

5. **Conditional Logic:**
   - Skip sections based on previous answers
   - Adaptive difficulty per section
   - Branching quiz paths

6. **Enhanced Feedback:**
   - Per-section feedback
   - Cumulative score display
   - Section-by-section performance review

## Related Files

- `app/components/activity-modules-preview/quiz-config.types.ts` - Type definitions
- `app/components/activity-modules-preview/use-nested-quiz-state.ts` - State management
- `app/components/activity-modules-preview/use-quiz-form.ts` - Form hook
- `app/components/activity-modules-preview/nested-quiz-selector.tsx` - Selector UI
- `app/components/activity-modules-preview/quiz-preview.tsx` - Main quiz component (includes QuizPreview and SingleQuizPreview)
- `app/components/activity-module-forms/index.ts` - Exports

## Dependencies

No new dependencies required. All features built using existing packages:
- `@mantine/core` ^8.3.5
- `@mantine/form` ^8.3.5
- `@mantine/hooks` ^8.3.5
- `@tabler/icons-react` ^3.35.0

## Notes

- Only one level of nesting supported (no recursive nesting)
- Nested quizzes always have pages (never more nested quizzes)
- Type guards enforce valid configuration structures
- Container quizzes must have `nestedQuizzes` array
- Regular quizzes must have `pages` array
- Both timers run client-side (no server sync)
- Answer submission callbacks for backend integration

