# Action and Loader RPC V2 and Centralized Route URLs

**Date:** 2026-01-04  
**Type:** Refactoring, Developer Experience

## Summary

This changelog documents the introduction of V2 versions of `typeCreateActionRpc` and `typeCreateLoaderRpc`, along with the centralization of route URL generation. These changes improve developer experience by providing a cleaner API, automatic URL derivation, and eliminating the need for manual `getRouteUrl` functions in route files.

## Changes

### 1. Action RPC V2 (`typeCreateActionRpcV2`)

A new V2 version of the action RPC creator was introduced in `app/utils/action-utils.ts`:

**New API Structure:**
```typescript
const createActionRpc = typeCreateActionRpcV2<Route.ActionArgs>({
  route: "/admin/course/new",
});

const createCourseRpc = createActionRpc({
  formDataSchema: z.object({ ... }),
  method: "POST",
});

const createCourseAction = createCourseRpc.createAction(async ({ context, formData }) => {
  // Action implementation
});

const useCreateCourse = createCourseRpc.createHook<typeof createCourseAction>();
```

**Key Improvements:**
- Returns an object with `createAction` and `createHook` methods instead of an array
- `createHook` automatically derives the URL from the `route` parameter using `getRouteUrl` from `app/utils/search-params-utils.ts`
- No need to manually provide `getRouteUrl` in route files
- `serverOnly$` is automatically applied internally, removing the need for manual wrapping

**Backward Compatibility:**
- The original `typeCreateActionRpc` function remains available and is marked as `@deprecated`
- Existing code using V1 continues to work without changes

### 2. Loader RPC V2 (`typeCreateLoaderRpcV2`)

A new V2 version of the loader RPC creator was introduced in `app/utils/loader-utils.ts`:

**New API Structure:**
```typescript
const createLoaderRpc = typeCreateLoaderRpcV2<Route.LoaderArgs>({
  route: "/api/media-usage",
});

const mediaUsageLoaderRpc = createLoaderRpc({
  searchParams: mediaUsageSearchParams,
});

const loader = mediaUsageLoaderRpc.createLoader(async ({ context, searchParams }) => {
  // Loader implementation
});

const useMediaUsage = mediaUsageLoaderRpc.createHook<typeof loader>();
```

**Key Improvements:**
- Returns an object with `createLoader` and `createHook` methods
- `createHook` automatically derives the URL from the `route` parameter
- `serverOnly$` is automatically applied internally
- No need for manual `getRouteUrl` functions

**Backward Compatibility:**
- The original `typeCreateLoader` function remains available (no deprecation as it's still used in many places)

### 3. Centralized Route URL Generation

**Removed `getRouteUrl` Functions:**
All route-specific `getRouteUrl` functions were removed from the following route files:
- `app/routes/course.$id.bin.tsx`
- `app/routes/course.$id.grades.singleview.tsx`
- `app/routes/course.$id.tsx`
- `app/routes/course.tsx`
- `app/routes/admin/courses.tsx`
- `app/routes/index.tsx`
- `app/routes/logout.tsx`
- `app/routes/admin/dependencies.tsx`
- `app/routes/admin/index.tsx`
- `app/routes/admin/cron-jobs.tsx`
- `app/routes/admin/maintenance.tsx`
- `app/routes/admin/system.tsx`
- `app/routes/admin/registration.tsx`
- `app/routes/admin/scheduled-tasks.tsx`
- `app/routes/api/user.$id.avatar.tsx`
- `app/routes/api/media/file.$id.tsx`
- `app/routes/admin/appearance/theme.tsx`
- `app/routes/course/section.$id.tsx`
- `app/routes/user/grades.tsx`
- `app/routes/course/section-edit.tsx`
- `app/routes/catalog.tsx`
- `app/routes/course.$id.backup.tsx`

**Centralized Implementation:**
The `getRouteUrl` function in `app/utils/search-params-utils.ts` is now the canonical way to generate route URLs:

```typescript
export function getRouteUrl<T extends keyof Register["pages"]>(
  routeId: T,
  options: RouteUrlOptions<T>,
) {
  // Handles params and searchParams automatically
  // Returns properly formatted URL with query string if needed
}
```

**Usage:**
```typescript
import { getRouteUrl } from "app/utils/search-params-utils";

const url = getRouteUrl("/course/:courseId", {
  params: { courseId: "123" },
  searchParams: { userId: 456 },
});
```

### 4. Migration of Route Files to V2

The following route files were migrated to use the V2 RPC system:

**Admin Routes:**
- `app/routes/admin/analytics.tsx`
- `app/routes/admin/appearance.tsx`
- `app/routes/admin/categories.tsx`
- `app/routes/admin/course-new.tsx`
- `app/routes/admin/media.tsx`
- `app/routes/admin/category-new.tsx`
- `app/routes/admin/new.tsx`
- `app/routes/admin/migrations.tsx`
- `app/routes/admin/sitepolicies.tsx`
- `app/routes/admin/test-email.tsx`
- `app/routes/admin/appearance/logo.tsx`

**API Routes:**
- `app/routes/api/activity-module-delete.tsx`
- `app/routes/api/batch-update-courses.tsx`
- `app/routes/api/category-reorder.tsx`
- `app/routes/api/course-structure-tree.tsx`
- `app/routes/api/d2-render.tsx`
- `app/routes/api/media-usage.tsx`
- `app/routes/api/search-users.tsx`
- `app/routes/api/section-delete.tsx`
- `app/routes/api/section-update.tsx`
- `app/routes/api/stop-impersonation.tsx`

**Course Routes:**
- `app/routes/course.$id.grades.tsx`
- `app/routes/course.$id.groups.tsx`
- `app/routes/course.$id.modules.tsx`
- `app/routes/course.$id.settings.tsx`
- `app/routes/course/section-new.tsx`
- `app/routes/course/module.$id/route.tsx`
- `app/routes/course/module.$id.edit.tsx`
- `app/routes/course/module.$id.submissions/route.tsx`
- `app/routes/course.$id.participants/route.tsx`

**User Routes:**
- `app/routes/user/media.tsx`
- `app/routes/user/note-create.tsx`
- `app/routes/user/note-edit.tsx`
- `app/routes/user/notes.tsx`
- `app/routes/user/overview.tsx`
- `app/routes/user/profile.tsx`
- `app/routes/user/module/edit-access.tsx`
- `app/routes/user/module/edit-setting.tsx`
- `app/routes/user/preference.tsx`
- `app/routes/user/module/new.tsx`

**Other Routes:**
- `app/routes/login.tsx`
- `app/routes/registration.tsx`

### 5. Type Safety Improvements

**Fixed `createActionMap` Compatibility:**
- Updated `createActionMap` to work seamlessly with V2 actions
- V2 actions now properly return `ActionFunction` type for compatibility
- Removed the need for `as any` type assertions

**Search Params Optionality:**
- Fixed issue where `searchParams` was incorrectly required when no search params were needed
- `searchParams` is now properly optional when the route doesn't require any search parameters
- Improved type inference for empty search params objects

### 6. Performance Optimizations

**TypeScript Type Checking Performance:**
Based on TypeScript performance best practices, the following optimizations were applied:

1. **Extracted Intermediate Types:**
   - Created helper types like `ExtractParamsKeys`, `OptionalParamKeys`, `RequiredParamKeys` to simplify complex conditional types
   - Reduced conditional type depth for better TypeScript compiler performance

2. **Simplified Conditional Chains:**
   - Extracted intermediate types for search params inference (`InferSearchParams`, `InferMergedSearchParams`, `SearchParamsBase`)
   - Cached expensive type computations (`RequestWithMethod`, `BaseArgsWithoutFormData`)

3. **Removed Unused Imports:**
   - Cleaned up unused type imports that were affecting compilation time

## Benefits

1. **Cleaner API:** The V2 API is more intuitive with object destructuring instead of array access
2. **Less Boilerplate:** No need to manually create `getRouteUrl` functions in each route file
3. **Automatic URL Generation:** Hooks automatically derive URLs from route paths
4. **Better Type Safety:** Improved type inference and optionality handling
5. **Consistency:** Centralized URL generation ensures consistent behavior across the codebase
6. **Performance:** TypeScript type checking is faster due to optimized type definitions

## Migration Guide

### Migrating Actions to V2

**Before (V1):**
```typescript
const [createItemAction, useCreateItem] = typeCreateActionRpc<Route.ActionArgs>({
  routeId: "routes/course.$id.grades",
  getRouteUrl: (params) => href("/course/:courseId/grades", { courseId: params.courseId.toString() }),
})({
  formDataSchema: z.object({ ... }),
  method: "POST",
  action: Action.CreateItem,
})(async ({ context, formData }) => {
  // Implementation
});
```

**After (V2):**
```typescript
const createActionRpc = typeCreateActionRpcV2<Route.ActionArgs>({
  route: "/course/:courseId/grades",
});

const createItemRpc = createActionRpc({
  formDataSchema: z.object({ ... }),
  method: "POST",
  action: Action.CreateItem,
});

const createItemAction = createItemRpc.createAction(async ({ context, formData }) => {
  // Implementation
});

const useCreateItem = createItemRpc.createHook<typeof createItemAction>();
```

### Migrating Loaders to V2

**Before (V1):**
```typescript
const loader = typeCreateLoader<Route.LoaderArgs>()({
  searchParams: loaderSearchParams,
})(async ({ context, searchParams }) => {
  // Implementation
});
```

**After (V2):**
```typescript
const createLoaderRpc = typeCreateLoaderRpcV2<Route.LoaderArgs>({
  route: "/api/media-usage",
});

const loader = createLoaderRpc({
  searchParams: loaderSearchParams,
}).createLoader(async ({ context, searchParams }) => {
  // Implementation
});
```

### Using Centralized `getRouteUrl`

**Before:**
```typescript
export function getRouteUrl(courseId: number) {
  return href("/course/:courseId", {
    courseId: courseId.toString(),
  });
}
```

**After:**
```typescript
import { getRouteUrl } from "app/utils/search-params-utils";

const url = getRouteUrl("/course/:courseId", {
  params: { courseId: courseId.toString() },
});
```

## Technical Details

### Type System Changes

The V2 system introduces improved type inference:

1. **Route Page Type:** Uses `RoutePage<RouteIdFromRouteFunctionArgs<T>>` to map route IDs to page paths
2. **Automatic URL Construction:** The `createHook` method uses `href` from React Router with the provided route path
3. **Search Params Handling:** Properly handles optional search params using `OptionalIfEmpty` type utility

### Internal Implementation

- `typeCreateActionRpcV2` wraps actions with `serverOnly$` internally
- `typeCreateLoaderRpcV2` wraps loaders with `serverOnly$` internally
- Both V2 functions use `href` from React Router to construct URLs
- Search params are stringified using `qs` library's `stringify` function

## Files Modified

### Core Utilities
- `app/utils/action-utils.ts` - Added `typeCreateActionRpcV2`
- `app/utils/loader-utils.ts` - Added `typeCreateLoaderRpcV2`
- `app/utils/routes-utils.ts` - Added `RoutePage` type
- `app/utils/search-params-utils.ts` - Centralized `getRouteUrl` function

### Route Files (50+ files migrated)
- All files listed in the "Migration of Route Files to V2" section above

## Testing

- All existing tests continue to pass
- V2 actions and loaders work correctly with `createActionMap`
- Type safety is maintained throughout the migration
- No runtime errors introduced

## Future Work

- Consider deprecating V1 APIs after full migration
- Potential V3 API with further simplifications
- Additional performance optimizations for type checking

## Related Changes

- Builds upon the type-safe action RPC system introduced in changelog 0079
- Complements the search params utilities system
- Aligns with the internal function pattern standardization (changelog 0073)

