# Type-safe Module Actions

## Problem

Magic strings are used for module actions across the codebase:

- `"editsubmission"` in assignment module (`module.$id.tsx`, `assignment-preview.tsx`)
- `"createthread"` and `"reply"` in discussion module (`discussion-preview.tsx`)

These strings have compile-time known values and should be type-safe constants.

## Solution

### 1. Create Module Actions Constants

Create `app/utils/module-actions.ts` with:

- Namespaced action constants for each module type (assignment, discussion)
- TypeScript types for type safety
- Optional: nuqs parser helpers for type-safe query state

Example structure:

```typescript
export const AssignmentActions = {
  EDIT_SUBMISSION: 'editsubmission',
} as const;

export const DiscussionActions = {
  CREATE_THREAD: 'createthread',
  REPLY: 'reply',
} as const;

export type AssignmentAction = typeof AssignmentActions[keyof typeof AssignmentActions];
export type DiscussionAction = typeof DiscussionActions[keyof typeof DiscussionActions];
export type ModuleAction = AssignmentAction | DiscussionAction;
```

### 2. Update Assignment Preview Component

In `app/components/activity-modules-preview/assignment-preview.tsx`:

- Import `AssignmentActions` constants
- Replace string literals `"editsubmission"` with `AssignmentActions.EDIT_SUBMISSION`
- Lines to update: 599, 603, 619

### 3. Update Discussion Preview Component

In `app/components/activity-modules-preview/discussion-preview.tsx`:

- Import `DiscussionActions` constants
- Replace `"createthread"` with `DiscussionActions.CREATE_THREAD` (line 501, 560)
- Replace `"reply"` with `DiscussionActions.REPLY` (lines 847, 857, 898)

### 4. Update Module Route

In `app/routes/course/module.$id.tsx`:

- Import `AssignmentActions` constants
- Replace `"editsubmission"` with `AssignmentActions.EDIT_SUBMISSION` (line 115)

## Benefits

- Compile-time safety: typos caught at build time
- Better IDE support: autocomplete and find-all-references
- Easier refactoring: rename constants instead of finding string literals
- Self-documenting: clear what actions are available for each module type
