<!-- c49a723e-c26f-4213-9bb5-f6d1ca619b42 a1a59cbd-1f1a-4f92-b34c-62e0a2912922 -->
# Merge Grading Page into Submissions Page

## 1. Update Module Actions Constants

**File:** `app/utils/module-actions.ts`

Add the new `GRADE_SUBMISSION` action to `AssignmentActions`:

```typescript
export const AssignmentActions = {
    EDIT_SUBMISSION: "editsubmission",
    GRADE_SUBMISSION: "gradesubmission",
} as const;
```

## 2. Merge Grading UI into Submissions Page

**File:** `app/routes/course/module.$id.submissions.tsx`

### 2.1 Update imports

- Import `AssignmentActions` from `~/utils/module-actions`
- Import `NumberInput` from `@mantine/core`
- Import `useForm` from `@mantine/form`
- Import `RichTextRenderer` from `~/components/rich-text-renderer`
- Import `SimpleRichTextEditor` from `~/components/simple-rich-text-editor`
- Import `tryGetAssignmentSubmissionById` from `server/internal/assignment-submission-management`
- Import `IconFile` from `@tabler/icons-react`
- Import `parseAsInteger`, `createLoader` from `nuqs/server`

### 2.2 Add search params handling

Add after imports:

```typescript
export const submissionsSearchParams = {
    action: parseAsString,
    submissionId: parseAsInteger,
};

export const loadSearchParams = createLoader(submissionsSearchParams);
```

### 2.3 Update loader

- Parse search params: `const { action, submissionId } = loadSearchParams(request);`
- If `action === AssignmentActions.GRADE_SUBMISSION && submissionId`, fetch submission using `tryGetAssignmentSubmissionById`
- Verify submission belongs to the module
- Return submission data in loader result

### 2.4 Update action handler

Add logic to handle grading form submission (similar to current action but for grading instead of deletion).

### 2.5 Add grading form component

Copy the grading UI from `module.$id.grading.tsx` (lines 120-301) as a new component `GradingView` that:

- Takes `submission`, `module`, `moduleSettings`, `course` as props
- Handles the grading form submission
- Has a "Back to Submissions" button that clears the action

### 2.6 Update main component

Replace the return statement to conditionally render either:

- The grading view when `action === AssignmentActions.GRADE_SUBMISSION && submission`
- The submissions table view otherwise

### 2.7 Update Grade button link

In `StudentSubmissionRow` component (line 312-327), change the link to use action:

```typescript
to={
    hasSubmissions && latestSubmission
        ? href("/course/module/:id/submissions", {
            id: moduleLinkId.toString(),
        }) + `?action=${AssignmentActions.GRADE_SUBMISSION}&submissionId=${latestSubmission.id}`
        : "#"
}
```

## 3. Update Submission History Component

**File:** `app/components/submission-history.tsx`

Update the "Grade" button to use the action pattern instead of navigating to the grading page.

## 4. Remove Grading Route

**File:** `app/routes.ts`

Remove line 61:

```typescript
route("course/module/:id/grading", "routes/course/module.$id.grading.tsx"),
```

## 5. Update Root Middleware

**File:** `app/root.tsx`

Remove lines related to grading page:

- Line 92: Remove `let isCourseModuleGrading = false;`
- Line 139: Remove `else if (route.id === "routes/course/module.$id.grading") isCourseModuleGrading = true;`
- Line 195: Remove `isCourseModuleGrading,` from pageInfo object

## 6. Update Server Index Context

**File:** `server/index.ts`

Remove lines related to grading page:

- Line 97: Remove `isCourseModuleGrading: false,` from pageInfo initialization

## 7. Update Global Context Type

**File:** `server/contexts/global-context.ts`

Remove from `PageInfo` type:

- Line 31: Remove `isCourseModuleGrading: boolean;`

## 8. Delete Grading Page File

**File:** `app/routes/course/module.$id.grading.tsx`

Delete this file entirely as it's now merged into submissions page.

## Implementation Notes

- The grading view will completely replace the submissions table when the action is active
- After submitting a grade, the action will be cleared, returning to the submissions table
- All existing permission checks from the grading page should be preserved
- The submission data loaded for grading will include all fields needed (content, attachments, student info)

### To-dos

- [ ] Add GRADE_SUBMISSION constant to AssignmentActions in module-actions.ts
- [ ] Merge grading page UI and logic into submissions page with action-based view switching
- [ ] Update submission-history component to use action pattern for Grade button
- [ ] Remove grading route from routes.ts
- [ ] Remove isCourseModuleGrading from root.tsx, server/index.ts, and global-context.ts
- [ ] Delete the standalone grading page file