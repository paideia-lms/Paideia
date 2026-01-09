# Discussion Components Refactoring and Bug Fixes

**Date:** 2026-01-09  
**Type:** Refactoring, Bug Fix, Code Quality Improvement  
**Impact:** Medium - Improves discussion component architecture, fixes upvote state inconsistency, and simplifies component interfaces

## Overview

This update refactors discussion components to be more self-contained, fixes a critical bug where thread upvote state was inconsistent between list and detail views, and improves code quality by using Mantine's form hooks instead of manual state management.

## Key Changes

### 1. Component Self-Containment

**Discussion Thread Components**
- Removed `onBack` prop from `DiscussionThreadDetailView` - component now manages navigation internally using `useNuqsSearchParams`
- Removed `onThreadClick` prop from `DiscussionThreadListView` - component handles thread selection internally
- Components now use URL search params directly instead of relying on parent callbacks

**Reply Components**
- Removed `onReply` and `onCancelReply` props from `ReplyCardWithUpvote` component
- Component now manages reply form state and navigation internally
- Consistent with `ReplyForm` component pattern

### 2. Form Management Refactoring

**Reply Card Component**
- Replaced `useState` with `useForm` from `@mantine/form` for better form state management
- Replaced `SimpleRichTextEditor` with `FormableSimpleRichTextEditor` for form integration
- Added `useFormWithSyncedInitialValues` hook for proper form initialization
- Wrapped reply form in proper `<form>` element with `form.onSubmit` handler
- Improved form validation and state management consistency

### 3. Critical Bug Fix: Thread Upvote State

**Problem**
Thread upvote state (`isUpvoted`) was inconsistent between the thread list view and thread detail view. A thread would show as "Upvoted" in the list but "Not upvoted" in the detail view.

**Root Cause**
The `tryGetDiscussionThreadWithReplies` function had incorrect logic for checking if a thread was upvoted. It was comparing `upvote.user === user?.id` directly, but `upvote.user` can be either:
- A number (when depth is 0)
- An object with an `id` property (when depth is 1)

The thread list view used correct logic that handled both cases, but the detail view function did not.

**Solution**
Updated `isUpvoted` check in `tryGetDiscussionThreadWithReplies` to match the logic used in `course-module-context.ts`:
```typescript
const isUpvoted =
  thread.upvotes?.some(
    (upvote: { user: number | { id: number }; upvotedAt: string }) => {
      const upvoteUser =
        typeof upvote.user === "object" && upvote.user !== null
          ? upvote.user
          : null;
      return upvoteUser?.id === user?.id;
    },
  ) ?? false;
```

This properly handles both cases where `upvote.user` can be a number or an object.

### 4. Code Quality Improvements

**Error Handling**
- Simplified error handling in `tryGetDiscussionThreadsWithAllReplies` and `tryGetDiscussionThreadWithReplies` by using `.getOrThrow()` pattern
- More consistent with Result type usage patterns

**Type Safety**
- Fixed `DiscussionReply` interface: changed `id` from `string` to `number` to match actual data structure
- Improved type consistency across discussion components

**Component Structure**
- Removed unused `threadId` prop from `ReplyUpvoteButton` component
- Cleaner component interfaces with fewer unnecessary props

**URL State Management**
- Moved `sortBy` state from component-level `useState` to URL search params
- Thread sorting preference now persists in URL and survives page refreshes
- Added `sortBy` to `loaderSearchParams` with default value "recent"
- Sorting options: "recent", "upvoted", "active"

## Technical Details

### Modified Files

#### `app/routes/course/module.$id/components/reply-card.tsx`
- Replaced `useState` with `useForm` and `useFormWithSyncedInitialValues`
- Replaced `SimpleRichTextEditor` with `FormableSimpleRichTextEditor`
- Removed `onReply` and `onCancelReply` props
- Added internal `useNuqsSearchParams` hook for managing `replyTo` search param
- Wrapped form in `<form>` element with proper submission handler

#### `app/routes/course/module.$id/components/discussion-thread-detail-view.tsx`
- Removed `onBack` prop from interface
- Component now uses `setQueryParams` directly to clear `threadId` and `replyTo` when navigating back

#### `app/routes/course/module.$id/components/discussion-thread-list-view.tsx`
- Removed `onThreadClick` prop from interface
- Component now uses `setQueryParams` directly to set `threadId` when clicking a thread
- Removed `useState` for `sortBy` - now receives `sortBy` as prop from loader
- Updated `Select` component to use `setQueryParams` for sorting changes
- Sorting state now managed through URL search params

#### `app/routes/course/module.$id/components/discussion-thread-view.tsx`
- Removed `onBack` and `onThreadClick` props from child component calls
- Removed unused `setQueryParams` and related imports
- Added `sortBy` prop to interface and passes it to `DiscussionThreadListView`

#### `app/routes/course/module.$id/components/reply-upvote-button.tsx`
- Removed unused `threadId` prop from interface

#### `server/internal/discussion-management.ts`
- Fixed `isUpvoted` check in `tryGetDiscussionThreadWithReplies` to handle both number and object user types
- Simplified error handling using `.getOrThrow()` pattern
- Fixed `DiscussionReply` interface: `id` type changed from `string` to `number`

#### `server/contexts/course-module-context.ts`
- No changes, but the fix ensures consistency with existing logic

#### `app/routes/course/module.$id/route.tsx`
- Added `sortBy` to `loaderSearchParams` using `parseAsStringEnum` with values `["recent", "upvoted", "active"]`
- Default value set to `"recent"`
- Passes `sortBy` from loader data to `DiscussionThreadView` component

## User Experience Impact

### Positive Changes
1. **Consistent Upvote State**: Threads now show correct upvote state in both list and detail views
2. **Simpler Component Usage**: Parent components no longer need to manage navigation callbacks
3. **Better Form Handling**: Reply forms now use proper form management with validation
4. **Persistent Sorting**: Thread sorting preference is now stored in URL and persists across page refreshes

### No Breaking Changes
- All changes are internal refactorings
- Component APIs remain compatible (just removed optional props)
- No database migrations required
- No user-facing behavior changes (except bug fix)

## Testing Considerations

### Manual Testing Checklist
- [ ] Verify thread upvote state is consistent between list and detail views
- [ ] Test replying to threads and replies
- [ ] Verify navigation between thread list and detail views
- [ ] Test canceling reply forms
- [ ] Verify upvote buttons work correctly in both views
- [ ] Test nested replies functionality
- [ ] Test thread sorting (recent, upvoted, active) and verify it persists in URL
- [ ] Verify sorting preference survives page refresh

### Edge Cases to Test
- Threads with no upvotes
- Threads with many upvotes
- Replying to deeply nested replies
- Canceling reply form after typing
- Navigation with active reply form
- Changing sort order and navigating to thread detail, then back
- Direct URL access with sortBy parameter

## Migration Notes

### No Database Changes
- No schema changes required
- All fixes are in application logic

### Code Updates Required
- If any code directly uses `DiscussionThreadDetailView`, `DiscussionThreadListView`, or `ReplyCardWithUpvote` with the removed props, those props should be removed
- The components now handle their own state management internally

## Related Issues

This changelog addresses:
- Inconsistent upvote state display between thread list and detail views
- Component prop drilling and unnecessary callback management
- Form state management inconsistencies

## Future Enhancements

Potential improvements based on this refactoring:
1. Consider extracting shared upvote button logic into reusable components
2. Add optimistic UI updates for upvote actions
3. Consider caching thread data to reduce re-fetches
4. Add keyboard shortcuts for navigation

## Conclusion

This refactoring improves the discussion component architecture by making components more self-contained and easier to use. The critical bug fix ensures upvote state is consistently displayed across all views. The move to proper form management improves code quality and maintainability.
