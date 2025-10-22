# 0012 - Quiz Builder: Fixed Drag-and-Drop Height Distortion

**Date**: 2025-10-22  
**Type**: Bug Fix

## Summary

Fixed a visual bug where dragging a question card would cause its height to distort and match the height of the question it was being dragged over, creating a jarring UI experience.

## Problem

When using the drag-and-drop functionality to reorder questions in the quiz builder, the dragged element's height would change to match the height of the element it was hovering over. This caused:

1. **Visual distortion** - The card would suddenly expand or shrink during drag
2. **Poor UX** - Made it difficult to see what was being dragged
3. **Inconsistent behavior** - Different questions had different heights, causing constant resizing

### Root Cause

The issue was caused by:
1. Missing `isDragging` state detection from `useSortable`
2. No opacity or z-index changes to distinguish the dragged element
3. The dragged element inheriting layout constraints from its new position in the DOM
4. Using plain `<div>` wrappers that didn't prevent layout shifts

## Solution

Implemented `DragOverlay` from `@dnd-kit/core` to render a separate overlay during drag operations. This prevents the original element from being affected by layout changes while dragging.

### Key Changes

1. **Added DragOverlay** - Renders a clone of the dragged item that floats above the page
2. **Track active drag item** - State to track which item is being dragged
3. **Handle drag lifecycle** - `onDragStart`, `onDragEnd`, and `onDragCancel` events
4. **Fade original item** - Set `opacity: 0.3` on the original item during drag
5. **Replaced `<div>` with `<Box>`** - Better Mantine component consistency

### Implementation

**Track drag state:**
```typescript
const [activeId, setActiveId] = useState<string | null>(null);

const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
};

const handleDragEnd = (event: DragEndEvent) => {
    // ... handle reordering ...
    setActiveId(null);
};

const activeItem = activeId
    ? items.find((item) => /* find by id */)
    : null;
```

**Render DragOverlay:**
```typescript
<DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
    onDragCancel={handleDragCancel}
>
    <SortableContext>{/* ...items... */}</SortableContext>
    
    <DragOverlay>
        {activeItem ? (
            <Card withBorder radius="md" p="md" style={{ cursor: 'grabbing' }}>
                {/* Simplified preview of the dragged item */}
            </Card>
        ) : null}
    </DragOverlay>
</DndContext>
```

**Original item styling:**
```typescript
const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,  // Fade out original during drag
};
```

## Benefits

1. ✅ **Perfect dimensions** - DragOverlay maintains exact dimensions, no distortion
2. ✅ **Smooth dragging** - Overlay follows cursor independently of layout
3. ✅ **Clear visual feedback** - Original item fades to 30% opacity, overlay shows what's being dragged
4. ✅ **No layout shifts** - Original element stays in place, preventing jarring jumps
5. ✅ **Better performance** - Overlay is optimized for dragging by `@dnd-kit`
6. ✅ **Proper cursor** - `grabbing` cursor on overlay
7. ✅ **Mantine consistency** - Using `<Box>` components throughout

## Files Changed

- `app/components/activity-module-forms/quiz-builder-v2.tsx`
  - Added `DragOverlay`, `DragStartEvent` imports from `@dnd-kit/core`
  - Added `activeId` state to track the currently dragged item
  - Implemented `handleDragStart` and `handleDragCancel` functions
  - Added `activeItem` computed value to find the dragged item
  - Updated `DndContext` with `onDragStart` and `onDragCancel` handlers
  - Added `DragOverlay` component with simplified preview of dragged items
  - Updated `SortableQuestionItem` to use `isDragging` for opacity fade
  - Replaced `<div>` with `<Box>` for better Mantine consistency
  - Removed unnecessary height constraints from Card
- `changelogs/0012-2025-10-22-quiz-builder-drag-drop-ui-fix.md` (this file)

## Testing

To test:
1. Create a quiz with multiple questions of varying heights (some expanded, some collapsed, some with many options)
2. Try dragging a short question over a tall question - height should remain consistent
3. Try dragging a tall question over a short question - height should remain consistent
4. Verify the dragged element has 50% opacity during drag
5. Verify cursor changes from grab (hand) to grabbing (closed fist) during drag
6. Verify smooth transitions between positions

