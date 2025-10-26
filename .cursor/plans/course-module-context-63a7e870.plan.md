<!-- 63a7e870-e611-4502-8104-f67d15708089 fb19f3fd-e45e-463b-a151-82321bff0937 -->
# Course Module Context Implementation

## 1. Create utility to flatten course structure

**File**: `server/utils/course-structure-utils.ts`

Create a new utility function that performs depth-first traversal of the CourseStructure to produce a flat, ordered list of module link IDs:

```typescript
export function flattenCourseStructure(courseStructure: CourseStructure): number[]
```

This will recursively walk through sections and collect all `CourseStructureItem` module link IDs in order.

## 2. Create course module context

**File**: `server/contexts/course-module-context.ts`

Define types and context similar to user-module-context.ts:

- `CourseModuleContext` type containing:
  - Full activity module data (id, title, description, type, status, requirePassword, createdBy, owner, page/whiteboard/assignment/quiz/discussion data based on type)
  - Module link metadata (id, createdAt, updatedAt)
  - `previousModuleLinkId: number | null`
  - `nextModuleLinkId: number | null`

- `tryGetCourseModuleContext` function that:
  - Takes payload, moduleLinkId, courseId, and current user
  - Fetches the module link using `tryFindCourseActivityModuleLinkById`
  - Fetches full activity module with depth 2
  - Gets course structure using `tryGetCourseStructure`
  - Flattens the structure to find next/prev modules
  - Transforms and returns the context

## 3. Add middleware in root.tsx

**File**: `app/root.tsx`

Add a new middleware function after the course context middleware (around line 334):

- Check if user is authenticated and `pageInfo.isCourseModule` is true
- Extract moduleLinkId from params
- Call `tryGetCourseModuleContext` with the course ID from course context
- Set the context using `courseModuleContextKey`

Export the context and key:

```typescript
export const courseModuleContext = createContext<CourseModuleContext | null>(null);
export const courseModuleContextKey = "courseModuleContext" as unknown as typeof courseModuleContext;
```

## 4. Update course module page

**File**: `app/routes/course/module.$id.tsx`

- Import and use `courseModuleContextKey` in the loader
- Remove the manual payload.findByID call (use context instead)
- For quiz type, extract `rawQuizConfig` from the context module data
- Pass actual quiz config to `QuizPreview` instead of `sampleNestedQuizConfig`
- Handle null quiz config gracefully

## Key Implementation Details

- The flatten utility should use depth-first traversal to maintain the order users see in the UI
- Handle both depth 0 and depth 1 cases for related entities (user, avatar, etc.)
- Next/prev are determined by position in the flattened list (null if first/last)
- No type casting with `as` - use proper type guards
- Use `Result.wrap` for error handling in tryGetCourseModuleContext

### To-dos

- [ ] Create flattenCourseStructure utility function in server/utils/course-structure-utils.ts
- [ ] Create server/contexts/course-module-context.ts with types and tryGetCourseModuleContext
- [ ] Add course module context middleware in app/root.tsx
- [ ] Update app/routes/course/module.$id.tsx to use context and actual quiz config