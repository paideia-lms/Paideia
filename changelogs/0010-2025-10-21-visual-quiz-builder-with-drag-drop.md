# Visual Quiz Builder with Drag-and-Drop

**Date:** October 21, 2025  
**Type:** Feature Enhancement  
**Status:** Completed

## Summary

Implemented a visual quiz builder that allows instructors to create and manage quizzes through an intuitive drag-and-drop interface. The builder supports both regular quizzes and container quizzes with multiple nested quizzes, using Mantine Tabs for navigation and @dnd-kit for reordering questions and page breaks.

## Features

### 1. Visual Quiz Builder Interface

- **Drag-and-Drop Questions**: Questions can be reordered by dragging a grip handle
- **Page Breaks**: Visual separators that can be added and dragged to create page boundaries
- **Question Cards**: Each question displayed in a card with inline editing
- **Three Question Types**: Multiple-choice, short-answer, and long-answer
- **Scoring Configuration**: Simple scoring (points) and manual scoring (max points)

### 2. Regular Quiz Structure

- **Single Scrollable List**: All questions in one continuous, sortable list
- **Page Break System**: Insert page breaks to divide questions into pages
- **Visual Hierarchy**: Clear visual distinction between questions and page breaks
- **Grading Configuration**: Pass/fail settings, score visibility options
- **Global Timer**: Optional timer for the entire quiz

### 3. Container Quiz with Tabs

- **Tab Navigation**: Each nested quiz appears as a separate tab
- **Multiple Quizzes**: Create complex quiz structures with multiple sub-quizzes
- **Sequential Order Option**: Force students to complete quizzes in order
- **Per-Quiz Settings**: Each nested quiz has its own timer and grading config
- **Tab Management**: Add, remove, and switch between quiz tabs

### 4. Question Management

- **Inline Editing**: Edit question prompts, options, and settings directly
- **Type Switching**: Change question types on the fly
- **Correct Answer Marking**: Mark correct answers for auto-grading
- **Feedback**: Add feedback shown to students after answering
- **Scoring Per Question**: Configure points for each question individually

## Technical Implementation

### New Files

- `app/components/activity-module-forms/quiz-builder-v2.tsx`: Complete rewrite with drag-and-drop
  - `QuestionsList`: Sortable list component with @dnd-kit integration
  - `SortableQuestionItem`: Individual draggable question/page break items
  - `RegularQuizBuilder`: Builder for single quizzes
  - `ContainerQuizBuilder`: Builder with Tabs for nested quizzes
  - `NestedQuizTab`: Tab panel for each nested quiz

### Updated Files

- `app/components/activity-module-forms/quiz-form.tsx`: Updated to use v2 components
- `app/utils/activity-module-schema.ts`: Added rawQuizConfig field
- `server/internal/quiz-submission-management.ts`: Handle rawQuizConfig storage
- `server/contexts/user-module-context.ts`: Include rawQuizConfig in context
- `server/internal/activity-module-management.ts`: Support rawQuizConfig in module management
- `app/routes/user/module/edit-setting.tsx`: Handle rawQuizConfig in form submission

### Data Structure

#### QuizConfig (from quiz-config.types.ts)
```typescript
interface QuizConfig {
  id: string;
  title: string;
  pages?: QuizPage[];  // For regular quizzes
  nestedQuizzes?: NestedQuizConfig[];  // For container quizzes
  sequentialOrder?: boolean;
  resources?: QuizResource[];
  globalTimer?: number;
  grading?: GradingConfig;
}
```

#### Internal Representation
```typescript
type QuestionOrPageBreak =
  | { type: "question"; data: Question }
  | { type: "pageBreak"; id: string };
```

Questions and page breaks are stored in a flat array for drag-and-drop, then converted to pages structure on save.

### Drag-and-Drop Implementation

Using **@dnd-kit** library:
- `DndContext`: Handles drag events
- `SortableContext`: Manages sortable items
- `useSortable`: Hook for individual draggable items
- `arrayMove`: Reorders items after drag

### Benefits Over Previous Implementation

1. **Better Navigation**: Tabs provide clearer separation for nested quizzes
2. **Intuitive Reordering**: Drag-and-drop is more natural than accordion nesting
3. **Visual Clarity**: Cards and page breaks make structure obvious
4. **Reduced Nesting**: Flat list instead of deeply nested accordions
5. **Better Performance**: Fewer nested components to render
6. **Easier Management**: Page breaks are explicit rather than implicit in structure

## Usage

### Creating a Regular Quiz

1. Select "Regular Quiz" type
2. Click "Add Question" to add questions
3. Click "Add Page Break" to create page separators
4. Drag questions and page breaks to reorder
5. Configure grading settings and timer

### Creating a Container Quiz

1. Select "Container Quiz" type
2. Click "Add Quiz" to create nested quizzes
3. Each quiz appears as a tab
4. Within each tab, add questions and page breaks
5. Enable "Sequential Order" if needed

### Managing Questions

- **Drag Handle**: Click and drag the grip icon to reorder
- **Question Type**: Select from dropdown to change type
- **Options**: Add/remove options for multiple-choice questions
- **Scoring**: Set points or mark as manual grading
- **Delete**: Click trash icon to remove question

### Managing Page Breaks

- **Add**: Click "Add Page Break" to insert separator
- **Drag**: Reposition page breaks to reorganize pages
- **Delete**: Click trash icon to remove page break

## Storage

The quiz configuration is stored in the `rawQuizConfig` JSON field in the `quizzes` collection. The field stores the complete `QuizConfig` object including:
- Quiz structure (pages or nested quizzes)
- All questions with their configuration
- Grading settings
- Timers and other metadata

Legacy quiz fields (instructions, dueDate, etc.) remain separate and unchanged.

## Future Enhancements

- [ ] Add more question types (fill-in-the-blank, ranking, matrix, etc.)
- [ ] Implement weighted and rubric-based scoring
- [ ] Add rich text editor for question prompts
- [ ] Support for question banks and random selection
- [ ] Bulk import questions from CSV/JSON
- [ ] Question templates and duplication
- [ ] Drag-and-drop between tabs (for nested quizzes)
- [ ] Preview mode before publishing

## Testing

Added test case in `server/internal/quiz-submission-management.test.ts`:
- `should store and retrieve rawQuizConfig`: Verifies QuizConfig objects are properly stored and retrieved from the database

## Migration Notes

- Existing quizzes continue to work with the old `questions` array
- New quizzes use `rawQuizConfig` for enhanced features
- Both structures can coexist in the database
- No migration required for existing quizzes

## Dependencies

- `@dnd-kit/core`: ^6.3.1
- `@dnd-kit/sortable`: ^10.0.0
- `@mantine/core`: (existing)
- `@mantine/form`: (existing)

## Related Changes

- Changelog 0007: Quiz Preview Component
- Changelog 0008: Nested Quiz Support
- Changelog 0009: Quiz Scoring Type Refinements

