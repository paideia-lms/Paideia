# 0011 - Quiz Builder: Fixed Page Break Conversion Logic

**Date**: 2025-10-22  
**Type**: Bug Fix

## Summary

Fixed the `listToPages` conversion logic to properly handle page breaks and allow empty pages. Page breaks now correctly split items into pages, regardless of whether those pages contain questions.

## Problem

The quiz builder uses two different representations:

1. **UI Model**: Flat list of items `[Question, PageBreak, Question]`
2. **Data Model**: Nested pages structure `[{questions: [Q1]}, {questions: [Q2]}]`

The conversion logic (`itemsToList` ↔ `listToPages`) had a flaw:

- Adding a page break without any questions: `items = [PageBreak]`
- Converting to pages: `pages = []` (no questions → no pages)
- Converting back to items: `items = []` (0 pages → 0 items)
- **Result**: Page break was lost!

### Console Log Evidence

```
[QuestionsList] addPageBreak - new items: [{pageBreak}]
[RegularQuizBuilder] handleItemsChange called with items: [{pageBreak}]
[RegularQuizBuilder] converted to pages: []  ← Problem!
```

On the next render, `itemsToList()` would convert 0 pages back to 0 items, losing the page break entirely.

## Root Cause

The `listToPages` function was only creating pages when there were questions:

```typescript
// OLD LOGIC (BUGGY)
items.forEach((item) => {
  if (item.type === "question") {
    currentPage.push(item.data);
  } else if (item.type === "pageBreak") {
    // Only create page if we have questions
    if (currentPage.length > 0) {
      pages.push({ questions: currentPage });
      currentPage = [];
    }
    // Otherwise, page break is IGNORED!
  }
});
```

This meant that:
- `[PageBreak]` → `pages: []` → next render: `items: []` → **Page break lost!**
- `[Question1, PageBreak, PageBreak, Question2]` → Only 2 pages created, middle page break ignored

## Solution

**Change the conversion logic to always create pages at page break boundaries, even if those pages are empty.**

The key insight: `pages = items.splitBy(pageBreak)` - page breaks are boundaries that split the list, regardless of content.

### Implementation

```typescript
// NEW LOGIC (CORRECT)
const listToPages = (items: QuestionOrPageBreak[]) => {
  if (items.length === 0) {
    return [];
  }

  const pages: QuizConfig["pages"] = [];
  let currentPage: Question[] = [];

  items.forEach((item) => {
    if (item.type === "question") {
      currentPage.push(item.data);
    } else if (item.type === "pageBreak") {
      // Always create a page at page break boundary (even if empty)
      pages.push({
        id: `page-${Date.now()}-${pages.length}`,
        title: `Page ${pages.length + 1}`,
        questions: currentPage,  // Can be empty!
      });
      currentPage = [];
    }
  });

  // Always add the last page (even if empty)
  pages.push({
    id: `page-${Date.now()}-${pages.length}`,
    title: `Page ${pages.length + 1}`,
    questions: currentPage,
  });

  return pages;
};
```

### Examples

**Example 1**: Page break only
```
items: [PageBreak]
→ pages: [
    { questions: [] },  // Page 1 (empty)
    { questions: [] }   // Page 2 (empty)
  ]
→ next render: items: [PageBreak] ✅
```

**Example 2**: Multiple page breaks
```
items: [Question1, PageBreak, PageBreak, Question2]
→ pages: [
    { questions: [Question1] },  // Page 1
    { questions: [] },           // Page 2 (empty)
    { questions: [Question2] }   // Page 3
  ]
→ next render: items: [Question1, PageBreak, PageBreak, Question2] ✅
```

**Example 3**: No page breaks
```
items: [Question1, Question2]
→ pages: [
    { questions: [Question1, Question2] }  // Single page
  ]
→ next render: items: [Question1, Question2] ✅
```

## Benefits

1. ✅ **No data loss** - Page breaks are always preserved through render cycles
2. ✅ **Consistent behavior** - `items.splitBy(pageBreak)` works as expected
3. ✅ **Supports empty pages** - Quiz designers can structure quizzes with intentional empty pages
4. ✅ **Correct round-trip conversion** - `items → pages → items` preserves structure
5. ✅ **Flexible quiz design** - No artificial restrictions on page break placement

## Files Changed

- `app/components/activity-module-forms/quiz-builder-v2.tsx`
  - Updated `listToPages` in `RegularQuizBuilder` to always create pages at page break boundaries
  - Updated `listToPages` in `NestedQuizTab` to always create pages at page break boundaries
  - Removed `disabled` prop from "Add Page Break" button (page breaks now work without questions)
  - Removed unused import statements
- `changelogs/0011-2025-10-22-quiz-builder-page-break-fix.md` (this file)

## Testing

To test:
1. Create a new quiz
2. Click "Add Page Break" without any questions - should work and be preserved
3. Add a question before or after the page break - should work correctly
4. Add multiple consecutive page breaks - all should be preserved
5. Save and reload - all page breaks should persist
6. Drag and drop questions and page breaks - should reorder correctly
7. For nested quizzes, verify the same behavior in each nested quiz tab

