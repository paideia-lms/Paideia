<!-- 492f6b3a-365e-4d84-ad34-8244196c79df 00490825-3c96-49b1-acdc-fca3d0a949ea -->
# Admin Category Management Implementation Plan

## Scope

- Create admin pages for category management at `admin/categories` and `admin/category/new`.
- Integrate with `@headless-tree` for drag-and-drop category reparenting.
- Show per-category course counts; do not list courses.
- Wire routes and pageInfo flags; update Admin nav and tabs.
- Update admin Courses table to include category column.

## Files to Add

- `app/routes/admin/categories.tsx`: DnD tree of categories using `tryGetCategoryTree`; on drop, compute and submit new parent; show counts; link to “Add Category”.
- `app/routes/admin/category-new.tsx`: Form similar to `app/routes/admin/course-new.tsx` to create a category (name, optional parent).

## Files to Edit

- `app/routes.ts`:
- Add:
- `route("admin/categories", "routes/admin/categories.tsx")`
- `route("admin/category/new", "routes/admin/category-new.tsx")`
- `app/root.tsx` middleware:
- Track new flags when matching:
- `isAdminCategories` when `route.id === "routes/admin/categories"`
- `isAdminCategoryNew` when `route.id === "routes/admin/category-new"`
- Include new flags in `pageInfo`.
- `server/index.ts` default `pageInfo`: add `isAdminCategories`, `isAdminCategoryNew` set to `false`.
- `server/contexts/global-context.ts` `PageInfo` type: add `isAdminCategories: boolean`, `isAdminCategoryNew: boolean`.
- `app/layouts/server-admin-layout.tsx`:
- `getCurrentTab` should return `Courses` tab when `isAdminCategories || isAdminCategoryNew`.
- `app/routes/admin/index.tsx` (admin dashboard links):
- Set `href` for "Manage categories" → `/admin/categories`
- Set `href` for "Add a category" → `/admin/category/new`
- `app/routes/admin/courses.tsx`:
- Loader mapping: include course category name if available (handle id or object per depth rule).
- Table: add "Category" column between Description and Status.

## Category DnD Behavior (Confirmed)

- Reparent ONLY (no sibling ordering changes)
- Drop inside a category → set `parent` to target category id
- Drop above/below an item → set `parent` to that item's parent
- Client computes `newParentId` using current tree map; submits via action to call `tryUpdateCategory(payload, request, sourceId, { parent: newParentId })`.

## Access and Conventions (Confirmed)

- Access: Admin ONLY for both pages (manage, create)
- Use Mantine components only; uncontrolled forms; include meta tags.
- Loader/action: enforce auth (admin) and pass `overrideAccess: false` behavior via internal fns.
- No Tailwind; avoid `useEffect` where not necessary.

## Notes

- Use `@headless-tree/react` similarly to `course-structure-tree.tsx` but simplified (no ordering).
- Show counts from `tryGetCategoryTree` in a badge next to name: `directCoursesCount` and optionally `totalNestedCoursesCount`.

### To-dos

- [ ] Add admin categories routes in app/routes.ts
- [ ] Add pageInfo flags and route matching in app/root.tsx
- [ ] Add new flags defaults in server/index.ts pageInfo
- [ ] Add isAdminCategories and isAdminCategoryNew to PageInfo type
- [ ] Return Courses tab for categories pages in server-admin-layout
- [ ] Add hrefs for Manage/Add categories in admin/index.tsx
- [ ] Build categories DnD page with headless-tree and actions
- [ ] Build new category form page similar to course-new
- [ ] Show category column and resolve category name