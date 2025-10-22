# 0010 - Quiz Builder: Fixed React Hydration Errors

**Date**: 2025-10-21  
**Type**: Bug Fix

## Summary

Fixed React hydration errors in the visual quiz builder caused by nested `<button>` elements and `@dnd-kit` dynamic ID generation.

## Problems

### Problem 1: Nested Buttons
The container quiz builder was rendering `ActionIcon` buttons (for removing quizzes) inside `Tabs.Tab` components, which are themselves buttons. This created invalid HTML with nested `<button>` elements.

### Problem 2: @dnd-kit Hydration Mismatch
The drag-and-drop library (`@dnd-kit`) generates dynamic `aria-describedby` IDs during rendering. These IDs differed between server-side rendering and client-side hydration (e.g., `DndDescribedBy-0` vs `DndDescribedBy-8`), causing hydration mismatches.

Both issues caused:
1. React hydration errors
2. Browser console warnings
3. Full page re-render on client side
4. Potential accessibility issues

## Solutions

### Solution 1: Move Remove Button to Panel Header

Moved the remove quiz button from inside the tab to the tab panel header:

**Before:**
```tsx
<Tabs.Tab>
  Quiz 1
  <ActionIcon onClick={remove}>  {/* Button inside button! */}
    <IconTrash />
  </ActionIcon>
</Tabs.Tab>
```

**After:**
```tsx
<Tabs.Tab>Quiz 1</Tabs.Tab>

<Tabs.Panel>
  <Group justify="space-between">
    <Title>Quiz 1</Title>
    <ActionIcon onClick={remove}>  {/* Button in panel header */}
      <IconTrash />
    </ActionIcon>
  </Group>
  {/* Quiz content */}
</Tabs.Panel>
```

### Solution 2: Client-Only Drag-and-Drop Rendering

Implemented a `mounted` state to conditionally render `@dnd-kit` components only on the client side:

**Implementation:**
```tsx
function QuestionsList({ items, onChange }) {
  // Prevent hydration mismatch - only enable drag-and-drop on client side
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* ... */}
      {!mounted ? (
        // Server-side: Static list without DnD
        <Stack>
          {items.map((item) => <QuestionItem {...item} />)}
        </Stack>
      ) : (
        // Client-side: Full drag-and-drop enabled
        <DndContext>
          <SortableContext>
            {items.map((item) => <SortableQuestionItem {...item} />)}
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}
```

This ensures:
1. Server renders a static list (no DnD IDs)
2. Client hydrates with the same static list (no mismatch)
3. After hydration completes, DnD is enabled client-side only

## Benefits

1. ✅ **Valid HTML structure** - No nested buttons
2. ✅ **No hydration errors** - Server and client render identically
3. ✅ **Better UX** - Delete button is more visible in panel header
4. ✅ **Cleaner tab labels** - Just the quiz name, no clutter
5. ✅ **Better accessibility** - Proper semantic HTML
6. ✅ **Progressive enhancement** - Drag-and-drop only loads client-side
7. ✅ **Better performance** - Smaller initial HTML payload

## Files Changed

- `app/components/activity-module-forms/quiz-builder-v2.tsx`
  - Added `useEffect` import from React
  - Implemented `mounted` state in `QuestionsList` component
  - Conditional rendering: static list (SSR) vs drag-and-drop (client-only)
  - Moved remove button from `Tabs.Tab` to `Tabs.Panel` header
  - Added panel header with quiz title and remove button
  - Removed debug console.log statement
- `changelogs/0010-2025-10-21-quiz-builder-nested-button-fix.md` (this file)

