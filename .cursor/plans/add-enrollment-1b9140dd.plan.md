<!-- 1b9140dd-d1c1-4248-9878-a96a1e662fb6 592cd7db-d456-4771-8617-8749fab5fae7 -->
# Add Enrollment Table to Course View

## Changes Required

### 1. Update Loader in `app/routes/course-view.$id.tsx`

Fetch enrollments with pagination support using `trySearchEnrollments` from `server/internal/enrollment-management.ts`:

```typescript
// Add to imports
import { trySearchEnrollments } from "server/internal/enrollment-management";
import { parseAsInteger } from "nuqs/server";

// In loader function, after existing code:
const page = new URL(request.url).searchParams.get("page");
const currentPage = page ? Number.parseInt(page, 10) : 1;

const enrollmentsResult = await trySearchEnrollments(payload, {
  course: courseId,
  limit: 10,
  page: currentPage,
});

const enrollments = enrollmentsResult.ok ? enrollmentsResult.value : {
  docs: [],
  totalDocs: 0,
  totalPages: 0,
  page: 1,
};

// Return enrollments data with user details populated
```

### 2. Update Action Handler in `app/routes/course-view.$id.tsx`

Add three new intent handlers:

- `"enroll"` - Create new enrollment using `tryCreateEnrollment`
- `"edit-enrollment"` - Update enrollment using `tryUpdateEnrollment`
- `"delete-enrollment"` - Delete enrollment using `tryDeleteEnrollment`

Each should use transactions and proper error handling similar to existing create/delete link handlers.

### 3. Update Component in `app/routes/course-view.$id.tsx`

Add after the Activity Module Links section:

**Imports needed:**

```typescript
import { Modal, Pagination, Select as MantineSelect, Avatar } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useSearchParams } from "react-router";
```

**Component additions:**

- State for modal: `const [enrollModalOpened, { open: openEnrollModal, close: closeEnrollModal }] = useDisclosure(false);`
- State for edit modal: similar pattern
- State for pagination: use `useSearchParams` hook
- Enrollment table with columns: First Name, Last Name, Username, Email, Role, Status, Last Access
- Action buttons column with Edit and Delete icons (similar to activity modules table)
- Pagination component below table (if totalPages > 1)
- "Enrol User" button visible only for admins
- Modal with form containing:
  - User select dropdown (fetch users via new endpoint or pass in loader)
  - Role select (student, teacher, ta, manager)
  - Status select (active, inactive, completed, dropped)
  - Submit/Cancel buttons

### 4. Fetch Available Users for Enrollment

Add to loader to fetch users not already enrolled:

```typescript
// Fetch all users for enrollment modal
const allUsersResult = await tryFindAllUsers(payload, {
  query: "",
  limit: 1000,
  page: 1,
});
```

Filter out already enrolled users in the modal.

### 5. Handle Depth for User Relationships

Enrollments return users as either ID or User object. Handle both cases when displaying:

```typescript
const user = typeof enrollment.user === "object" ? enrollment.user : null;
const firstName = user?.firstName || "Unknown";
```

## Key Files to Modify

- `app/routes/course-view.$id.tsx` - Main file with all changes

## Implementation Details

- Use `useState` for modal state and form data
- Use `useFetcher` for form submissions (enrollment create/edit/delete)
- Use `useSearchParams` for pagination state
- Badge colors for roles: student (blue), teacher (green), ta (yellow), manager (purple)
- Badge colors for status: active (green), inactive (gray), completed (blue), dropped (red)
- Display "Last Access" from user sessions data if available, otherwise show "Never"
- Edit modal should pre-populate with current enrollment data
- Delete should show confirmation modal similar to activity modules

### To-dos

- [ ] Update loader to fetch enrollments with pagination and available users for enrollment modal
- [ ] Add action handlers for enroll, edit-enrollment, and delete-enrollment intents
- [ ] Add enrollment table UI with columns for user details, role, status, and actions
- [ ] Add pagination component and wire up URL search params for enrollment table
- [ ] Create modal for enrolling new users with user/role/status selection
- [ ] Add edit and delete modals with confirmation for enrollment actions