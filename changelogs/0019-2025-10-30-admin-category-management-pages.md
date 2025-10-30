# Admin Category Management Pages, Batch APIs, and Course Table Enhancements

**Date**: October 30, 2025  
**Type**: Feature Addition  
**Impact**: High – Enables full in-app category management and bulk course updates

## Overview
This update introduces a complete category management experience for administrators, including a drag-and-drop category tree, a details pane with edit/delete actions, and batch updates for courses (category and status). It also enriches the seed data with realistic categories and enrollments.

## Key Features

### 1. Admin Category Management (Tree + Details)
- Drag-and-drop (reparent-only) hierarchy management using headless-tree
- Compact “View” button next to each category’s counts to select a category
- Details pane (when selected via `?categoryId=`) showing:
  - Category name
  - Direct courses count
  - Direct subcategories count
  - Total nested courses count
  - Ancestors path
- Two-column layout: tree on the left and details on the right (tree is full-width when nothing is selected)

### 2. Category Edit/Delete
- Edit category – change name and/or parent using an uncontrolled Mantine form
- Delete category – uncategorizes all courses under it (courses are NOT deleted), then deletes the category (transactional behavior)
- Query-state driven modals for edit/delete for better deep-linking and state preservation

### 3. Batch Update Courses
- Row selection in Courses table with a selected count header
- Action menu (three dots) with:
  - Change category (modal) – uses batch API, no title/slug/description required
  - Change status (modal) – uses batch API
- Preserves existing search and pagination flows

### 4. Seed Data Improvements
- Creates base categories (STEM, Humanities) and subcategories (Computer Science, Mathematics)
- Increases the number of seeded courses, randomly assigns categories
- Enrolls the admin as manager in a course

## Technical Implementation

### New/Updated Routes
- `app/routes/admin/categories.tsx` (NEW)
  - Loader:
    - Requires admin auth
    - `tryGetCategoryTree` to build tree
    - Parses `?categoryId` and returns a `selectedCategory` detail object via:
      - `tryFindCategoryById`
      - `payload.count` for direct courses
      - `tryFindSubcategories` for direct subcategories count
      - `tryGetTotalNestedCoursesCount` for total nested course count
      - `tryGetCategoryAncestors` for path
      - Extracts `parentId` (handles depth 0/1)
  - Action:
    - `intent=edit` – uses `tryUpdateCategory`
    - `intent=delete` – sets `category=null` for all courses, then `tryDeleteCategory`
    - All edit/delete operations are wrapped in a DB transaction
  - Client side:
    - `clientAction` for consistent notifications
    - Hooks: `useEditCategory`, `useDeleteCategory`, `useReorderCategories`
    - Query state: `categoryId`, `edit`, `delete` using `nuqs` with `shallow: false`
    - Uncontrolled Mantine forms in modals; reinitialize with `form.setInitialValues` on open

- `app/routes/admin/category-new.tsx` (NEW)
  - Create category (uncontrolled Mantine form) with optional parent
  - Admin-only access; success notification and redirect back to listing

- `app/routes/admin/courses.tsx` (UPDATED)
  - Row selection (checkbox per row + header)
  - Selected count header with three-dot action menu
  - Modals for change category and change status, both backed by batch API
  - Loader fetches flat categories (name with simple indentation) for selects
  - Category column added to the table

- `app/routes/api/category-reorder.tsx` (NEW)
  - Action and hook to reparent categories only (no sibling ordering)

- `app/routes/api/batch-update-courses.tsx` (NEW)
  - JSON input `{ courseIds: number[], status?: 'draft'|'published'|'archived', category?: number|null }`
  - Updates only provided fields; no title/slug/description required
  - Admin-only; server-side validation using zod

- `app/routes/course.$id.settings.tsx` (UPDATED)
  - `useEditCourse` supports optional `redirectTo` for flexible post-action navigation
  - Loader uses internal category functions to produce a flattened list
  - Uncontrolled Mantine form using `Input.Wrapper` for description

- `app/routes.ts` (UPDATED)
  - Added `admin/categories`, `admin/category/new`
  - Added `api/category-reorder`, `api/batch-update-courses`

### Backend/Internal Functions
- Category (existing in `server/internal/course-category-management.ts`):
  - `tryGetCategoryTree`, `tryFindCategoryById`, `tryFindSubcategories`, `tryGetCategoryAncestors`, `tryGetTotalNestedCoursesCount`, `tryUpdateCategory`, `tryDeleteCategory`

- Course (UPDATED in `server/internal/course-management.ts`):
  - `tryUpdateCourse` now accepts `category?: number | null` in `UpdateCourseArgs.data`

### Transactions
- Category delete flow:
  1. Begin transaction
  2. Set `category=null` for all courses currently in the category
  3. Delete category via `tryDeleteCategory`
  4. Commit transaction (rollback on any error)

## UI Components and Styling
- Mantine components used throughout (no Tailwind)
- Uncontrolled Mantine forms for category edit/new and course settings
- Consistent action feedback with Mantine notifications
- Headless-tree features: `syncDataLoader`, `selection`, `hotkeysCore`, `dragAndDrop`, `expandAll`
- Tooltips for count badges in the tree

## Permissions & Access Control
- Admin-only access for category management and batch update routes
- Loader checks enforce admin role; actions return Forbidden/BadRequest when violated

## Testing Considerations
- Manual tests recommended:
  - DnD reparent operations (inside/above/below) and re-render of tree
  - Edit category (name, parent) and ensure details reflect changes
  - Delete category and verify courses are uncategorized (not deleted)
  - Batch update category and status for selected courses
  - Query-state behavior for `categoryId`, `edit`, `delete` modals
  - Access control: non-admin users should be forbidden

## Migration Notes
- No DB migrations required; relies on existing collections
- `tryUpdateCourse` signature change is backward compatible (optional field)

## Performance Considerations
- Category detail loader performs a few targeted calls (count, subcategories, total, ancestors) only when `?categoryId` is provided
- Batch updates submit one update per course; acceptable for admin workflows; can be optimized later with server-side batching if needed

## Future Enhancements
1. Sibling ordering (currently reparent-only) with safe index updates
2. Category search and filter for large taxonomies
3. Bulk category operations (merge, rename across subtrees)
4. Course counts caching for large datasets
5. Category role-based visibility and permissions

## Conclusion
This release provides a comprehensive, admin-first category management solution along with efficient bulk operations for courses. It adheres to the project’s conventions (Mantine UI, uncontrolled forms, nuqs query-state, internal access patterns) and sets a solid foundation for future taxonomy and course management features.
