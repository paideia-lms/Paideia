# Internal Function Pattern Standardization

**Date:** 2025-11-27  
**Type:** Code Quality & Infrastructure Enhancement  
**Impact:** High - Standardizes patterns across all internal functions, improves type safety, reduces code duplication, and establishes consistent transaction handling

## Overview

This changelog documents a comprehensive standardization of internal function patterns across the codebase. The changes establish consistent patterns for transaction management, function argument structures, type definitions, and user context handling. These improvements significantly reduce code duplication, improve type safety, and make the codebase more maintainable.

## Key Changes

### 1. Transaction Management Standardization

#### Pattern: `transactionInfo.tx` Instead of Manual Try-Catch

**Before:**
```typescript
const transactionInfo = await handleTransactionId(payload, req);

try {
  // ... operations ...
  await commitTransactionIfCreated(payload, transactionInfo);
  return result;
} catch (error) {
  await rollbackTransactionIfCreated(payload, transactionInfo);
  throw error;
}
```

**After:**
```typescript
const transactionInfo = await handleTransactionId(payload, req);

return await transactionInfo.tx(async (txInfo) => {
  // ... operations using txInfo.reqWithTransaction ...
  return result;
});
```

**Benefits:**
- **Automatic Transaction Handling**: The `tx` function automatically handles commit/rollback, eliminating manual error handling
- **Reduced Boilerplate**: Removes repetitive try-catch blocks across 19+ files
- **Consistent Pattern**: All transaction-using functions follow the same pattern
- **Error Safety**: Ensures transactions are always properly rolled back on errors

**Files Refactored:**
- `server/internal/course-management.ts` - `tryDeleteCourse`, `tryCreateGroup`, `tryUpdateGroup`, `tryDeleteGroup`
- `server/internal/enrollment-management.ts` - All transaction-using functions (`tryCreateEnrollment`, `tryUpdateEnrollment`, `tryDeleteEnrollment`, `tryAddGroupsToEnrollment`, `tryRemoveGroupsFromEnrollment`)
- `server/internal/note-management.ts` - `tryCreateNote`, `tryUpdateNote`
- `server/internal/gradebook-management.ts` - `tryCreateGradebook`
- `server/internal/gradebook-category-management.ts` - `tryCreateGradebookCategory`, `tryUpdateGradebookCategory`, `tryDeleteGradebookCategory`, `tryReorderCategories`
- `app/utils/upload-handler.ts` - `tryParseFormDataWithMediaUpload`
- `app/routes/admin/appearance/logo.tsx` - `uploadAction`, `clearLogoAction`

**Removed Imports:**
- `commitTransactionIfCreated` - No longer needed as `tx` handles commits
- `rollbackTransactionIfCreated` - No longer needed as `tx` handles rollbacks

### 2. User Context Standardization

#### Pattern: User Context Through `req` Instead of Direct Parameter

**Before:**
```typescript
export type CreateEnrollmentArgs = BaseInternalFunctionArgs & {
  user?: TypedUser | null;
  // ... other fields
};

export const tryCreateEnrollment = Result.wrap(
  async (args: CreateEnrollmentArgs) => {
    const { payload, user, req, overrideAccess = false } = args;
    // ... operations using user directly ...
  }
);
```

**After:**
```typescript
export interface CreateEnrollmentArgs extends BaseInternalFunctionArgs {
  // user removed - now accessed via req.user
  // ... other fields
}

export const tryCreateEnrollment = Result.wrap(
  async (args: CreateEnrollmentArgs) => {
    const { payload, req, overrideAccess = false } = args;
    // User context accessed via req.user when needed
  }
);
```

**Benefits:**
- **Consistent API**: All internal functions use the same pattern for user context
- **Simplified Signatures**: Removes redundant `user` parameter from function signatures
- **Better Type Safety**: User context is always tied to the request context
- **Easier Testing**: Test code only needs to provide `req: { user: ... }` instead of both `user` and `req`

**Files Refactored:**
- `server/internal/enrollment-management.ts` - All functions
- `server/internal/user-grade-management.ts` - All functions
- `server/internal/gradebook-category-management.ts` - All functions
- `server/internal/course-activity-module-link-management.ts` - All functions
- `app/utils/upload-handler.ts` - Removed unused `user` parameter

**Test Files Updated:**
- `server/internal/enrollment-management.test.ts` - Updated all function calls to use `req: { user: ... }`
- `server/internal/user-grade-management.test.ts` - Updated all function calls to use `req: { user: ... }`
- `server/internal/gradebook-item-management.test.ts` - Updated all function calls to use args object pattern

### 3. Type Definition Standardization

#### Pattern: Interfaces Instead of Type Aliases

**Before:**
```typescript
export type CreateEnrollmentArgs = BaseInternalFunctionArgs & {
  courseId: number;
  userId: number;
};

export type UpdateEnrollmentArgs = BaseInternalFunctionArgs & {
  enrollmentId: number;
  status?: string;
};
```

**After:**
```typescript
export interface CreateEnrollmentArgs extends BaseInternalFunctionArgs {
  courseId: number;
  userId: number;
}

export interface UpdateEnrollmentArgs extends BaseInternalFunctionArgs {
  enrollmentId: number;
  status?: string;
}
```

**Benefits:**
- **Better Extensibility**: Interfaces can be extended and merged more easily
- **Consistent Pattern**: All argument types use the same definition style
- **Type Safety**: Interfaces provide better type checking and IntelliSense support
- **Declaration Merging**: Allows for future extension through declaration merging if needed

**Files Refactored:**
- `server/internal/enrollment-management.ts` - All `type` definitions converted to `interface`
- `server/internal/note-management.ts` - All `type` definitions converted to `interface`
- `server/internal/gradebook-category-management.ts` - All `type` definitions converted to `interface`
- `server/internal/course-activity-module-link-management.ts` - All `type` definitions converted to `interface` (except union types)

**Note:** Union types (like `CourseActivityModuleLinkResult`) remain as `type` since TypeScript interfaces cannot represent unions.

### 4. Function Call Pattern Standardization

#### Pattern: Args Object Instead of Individual Parameters

**Before:**
```typescript
const result = await tryFindGradebookItemById(payload, itemId);
const items = await tryGetGradebookItemsInOrder(payload, gradebookId);
const sortOrder = await tryGetNextItemSortOrder(payload, gradebookId, categoryId);
```

**After:**
```typescript
const result = await tryFindGradebookItemById({
  payload,
  itemId,
  req: undefined,
  overrideAccess: true,
});

const items = await tryGetGradebookItemsInOrder({
  payload,
  gradebookId,
  req: undefined,
  overrideAccess: true,
});

const sortOrder = await tryGetNextItemSortOrder({
  payload,
  gradebookId,
  categoryId,
  req: undefined,
  overrideAccess: true,
});
```

**Benefits:**
- **Consistent API**: All internal functions use the same calling pattern
- **Better Type Safety**: TypeScript can validate all arguments at once
- **Easier to Extend**: Adding new optional parameters doesn't break existing calls
- **Self-Documenting**: Function calls clearly show all available options

**Functions Updated:**
- `tryFindGradebookItemById` - Now uses args object
- `tryGetGradebookItemsInOrder` - Now uses args object
- `tryGetCategoryItems` - Now uses args object
- `tryGetNextItemSortOrder` - Now uses args object
- `tryReorderItems` - Now uses args object
- `tryGetItemsWithUserGrades` - Now uses args object

## Technical Details

### Transaction Info Pattern

The `transactionInfo.tx` pattern provides a clean abstraction over transaction management:

```typescript
interface TransactionInfo {
  isTransactionCreated: boolean;
  reqWithTransaction: Partial<PayloadRequest>;
  tx: <T>(callback: (txInfo: TransactionInfo) => Promise<T>) => Promise<T>;
}
```

The `tx` method:
1. Executes the callback with transaction context
2. Automatically commits if transaction was created
3. Automatically rolls back on any error
4. Returns the result from the callback

### BaseInternalFunctionArgs Structure

All internal function arguments now extend a consistent base:

```typescript
interface BaseInternalFunctionArgs {
  payload: Payload;
  req?: Partial<PayloadRequest>;
  overrideAccess?: boolean;
}
```

User context is accessed via `req?.user` when needed, rather than as a separate parameter.

### Payload Operations Within Transactions

All Payload operations within transaction blocks use `txInfo.reqWithTransaction`:

```typescript
return await transactionInfo.tx(async (txInfo) => {
  const result = await payload.create({
    collection: "items",
    data: { ... },
    req: txInfo.reqWithTransaction, // Transaction-aware request
    overrideAccess,
  });
  return result;
});
```

This ensures all operations within the transaction are properly scoped.

## Migration Impact

### Breaking Changes

**For Internal Function Callers:**
- Functions that previously accepted `user` as a direct parameter now require `req: { user: ... }`
- Functions that used individual parameters now require an args object
- Test files need to be updated to use the new calling patterns

**For Internal Function Implementers:**
- Transaction handling must use `transactionInfo.tx` instead of manual try-catch
- User context must be accessed via `req.user` instead of a direct `user` parameter
- All argument types should be defined as `interface` extending `BaseInternalFunctionArgs`

### Non-Breaking Changes

- Existing functionality remains unchanged
- Database operations continue to work as before
- Transaction behavior is identical, just implemented differently

## Testing Updates

All test files were updated to match the new patterns:

- **Function Calls**: Updated to use args object pattern
- **User Context**: Changed from `user: someUser` to `req: { user: someUser }`
- **Transaction Tests**: No changes needed as transaction behavior is identical

## Files Modified

### Core Internal Functions (19 files)
- `server/internal/course-management.ts`
- `server/internal/enrollment-management.ts`
- `server/internal/note-management.ts`
- `server/internal/gradebook-management.ts`
- `server/internal/gradebook-category-management.ts`
- `server/internal/gradebook-item-management.ts`
- `server/internal/user-grade-management.ts`
- `server/internal/course-activity-module-link-management.ts`
- `app/utils/upload-handler.ts`
- `app/routes/admin/appearance/logo.tsx`

### Test Files (3 files)
- `server/internal/enrollment-management.test.ts`
- `server/internal/user-grade-management.test.ts`
- `server/internal/gradebook-item-management.test.ts`

## Benefits Summary

1. **Reduced Code Duplication**: Transaction handling logic is centralized in `transactionInfo.tx`
2. **Improved Type Safety**: Consistent interface definitions provide better type checking
3. **Easier Maintenance**: Standardized patterns make code easier to understand and modify
4. **Better Error Handling**: Automatic transaction rollback ensures data consistency
5. **Consistent API**: All internal functions follow the same patterns, reducing cognitive load
6. **Future-Proof**: Standardized patterns make it easier to add new features consistently

## Future Considerations

These standardized patterns should be applied to any new internal functions:

1. **New Functions**: Must use `interface` extending `BaseInternalFunctionArgs`
2. **Transaction Functions**: Must use `transactionInfo.tx` pattern
3. **User Context**: Must access via `req.user`, not as a direct parameter
4. **Function Calls**: Must use args object pattern, not individual parameters

## Related Changes

This standardization builds upon previous refactoring efforts:
- **0071-2025-11-22**: Upload handler refactoring established transaction patterns
- **0056-2025-11-17**: Permissions structure reorganization established base patterns

These changes represent a natural evolution toward more consistent and maintainable code patterns across the entire codebase.

