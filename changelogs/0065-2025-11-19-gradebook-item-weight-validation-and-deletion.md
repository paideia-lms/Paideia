# Gradebook Item and Category Weight Validation and Deletion

**Date:** November 19, 2025

## Overview

This changelog documents the implementation of comprehensive weight validation for gradebook items and categories, along with the addition of deletion functionality for manual items and categories. The changes ensure that non-extra-credit items always sum to exactly 100% and provide a consistent pattern for all gradebook operations.

## Key Features

### 1. Weight Validation System

- **Unified Validation Function**: Created `tryValidateOverallWeightTotal` to centralize weight validation logic
- **Extra Credit Exclusion**: Validation correctly excludes extra credit items from the 100% requirement
- **Transaction Support**: Validation works within database transactions for atomic operations
- **Consistent Error Messages**: Customizable error message prefixes for different operations

### 2. Gradebook Item Deletion

- **Manual Item Deletion**: Added ability to delete manual gradebook items (items not linked to activity modules)
- **UI Integration**: Delete button (trash icon) appears in gradebook setup view for manual items only
- **Confirmation Dialog**: User confirmation required before deletion
- **Automatic Revalidation**: React Router automatically revalidates data after successful deletion

### 3. Gradebook Category Management

- **Category Deletion**: Added ability to delete gradebook categories
- **Pre-Deletion Validation**: Validates that category has no subcategories or items before deletion
- **Weight Validation**: Validates overall weight total after category creation, update, and deletion
- **UI Integration**: Delete button (trash icon) appears in gradebook setup view for all categories
- **Consistent Pattern**: Category management functions follow the same args pattern as item management

### 4. Comprehensive Weight Validation

- **Item Create Validation**: Added weight validation to `tryCreateGradebookItem`
- **Item Update Validation**: Enhanced `tryUpdateGradebookItem` with weight validation
- **Item Delete Validation**: Added weight validation to `tryDeleteGradebookItem`
- **Category Create Validation**: Added weight validation to `tryCreateGradebookCategory`
- **Category Update Validation**: Enhanced `tryUpdateGradebookCategory` with weight validation
- **Category Delete Validation**: Added weight validation to `tryDeleteGradebookCategory`
- **Transaction Rollback**: All operations roll back if validation fails

### 5. Weight Display Formatting

- **Consistent Decimal Places**: All weight values now display with 2 decimal places
- **Weight Column**: Updated `WeightDisplay` component to show weights with `.toFixed(2)`
- **Overall Weight Column**: Already using 2 decimal places, now consistent across all displays

## Technical Changes

### API Changes

#### `tryValidateOverallWeightTotal`

**New Function:**
- Centralized validation logic for overall weight totals
- Accepts `payload`, `gradebookId`, `user`, `req`, `overrideAccess`, and optional `errorMessagePrefix`
- Validates that `baseTotal` (non-extra-credit items) equals exactly 100%
- Returns `Result` with `baseTotal` value on success
- Throws `WeightExceedsLimitError` if validation fails

**Key Behavior:**
- Only validates non-extra-credit items (extra credit items are excluded from `baseTotal`)
- Uses 0.01 tolerance for floating-point comparison
- Works within database transactions

#### `tryDeleteGradebookItem`

**Before:**
- Accepted `payload`, `request`, `itemId`, and optional `transactionID`
- No weight validation after deletion
- No transaction management

**After:**
- Accepts `DeleteGradebookItemArgs` object with `payload`, `itemId`, `user`, `req`, `overrideAccess`
- Uses transaction management (creates if not provided, uses existing if provided)
- Validates overall weight total after deletion
- Rolls back transaction if validation fails
- Only commits/rollbacks if transaction was created by the function

#### `tryCreateGradebookItem`

**Enhanced:**
- Added weight validation after item creation
- Only validates if `weight > 0` and item is not extra credit
- Validates within the same transaction as item creation
- Rolls back if validation fails

#### `tryUpdateGradebookItem`

**Enhanced:**
- Refactored to use `tryValidateOverallWeightTotal` instead of inline validation
- Consistent error handling and transaction management

#### `tryCreateGradebookCategory`

**Enhanced:**
- Added weight validation after category creation
- Only validates if `weight > 0`
- Validates within the same transaction as category creation
- Rolls back if validation fails

#### `tryUpdateGradebookCategory`

**Before:**
- Accepted `payload`, `request`, `categoryId`, and `args` object
- No weight validation after update
- No transaction management

**After:**
- Accepts `UpdateGradebookCategoryArgs` object with `payload`, `categoryId`, `user`, `req`, `overrideAccess`
- Uses transaction management (creates if not provided, uses existing if provided)
- Validates overall weight total after weight update
- Rolls back transaction if validation fails
- Only commits/rollbacks if transaction was created by the function

#### `tryDeleteGradebookCategory`

**Before:**
- Accepted `payload`, `request`, and `categoryId`
- No validation for subcategories or items
- No weight validation after deletion
- No transaction management

**After:**
- Accepts `DeleteGradebookCategoryArgs` object with `payload`, `categoryId`, `user`, `req`, `overrideAccess`
- Validates category has no subcategories before deletion
- Validates category has no items before deletion
- Uses transaction management (creates if not provided, uses existing if provided)
- Validates overall weight total after deletion
- Rolls back transaction if any validation fails
- Only commits/rollbacks if transaction was created by the function

#### `tryValidateNoSubItemAndCategory`

**New Function:**
- Extracted validation logic for checking if category has subcategories or items
- Accepts `ValidateNoSubItemAndCategoryArgs` with `payload`, `categoryId`, `user`, `req`, `overrideAccess`
- Returns `Result` with `categoryId` on success
- Throws `InvalidArgumentError` if category has subcategories or items
- Reusable validation function for category deletion checks

### Component Changes

#### `GradebookSetupView`

- Added `useDeleteManualItem` hook integration
- Removed unnecessary `useRevalidator` (React Router handles revalidation automatically)
- Added `handleDeleteItem` function with confirmation dialog
- Delete button only appears for manual items (items without `activityModuleLinkId`)

#### `GradebookItemRow`

- Added `onDeleteItem` prop for delete callback
- Added `onDeleteCategory` prop for category delete callback
- Added delete button (trash icon) in Actions column for categories
- Added delete button (trash icon) in Actions column for manual items
- Delete button for items only visible for leaf items without `activityModuleLinkId`
- Delete button for categories visible for all categories
- Delete buttons styled with red color variant

### Hook Changes

#### `useDeleteManualItem`

**New Hook:**
- Submits delete request with `delete-item` intent
- Returns `deleteManualItem` function, `isLoading` state, and `data`
- Follows same pattern as other gradebook item hooks

#### `useDeleteCategory`

**New Hook:**
- Submits delete request with `delete-category` intent
- Returns `deleteCategory` function, `isLoading` state, and `data`
- Follows same pattern as other gradebook hooks

### Schema Changes

#### `inputSchema`

**Added:**
- `deleteItemSchema` with `intent: "delete-item"` and `itemId` field
- `deleteCategorySchema` with `intent: "delete-category"` and `categoryId` field
- Added to discriminated union for type safety

#### `WeightDisplay`

**Enhanced:**
- All weight values now display with 2 decimal places using `.toFixed(2)`
- Updated display text for specified weights, adjusted weights, and combined displays
- Tooltip content also uses 2 decimal places for consistency

### Route Changes

#### `course.$id.grades.tsx`

**Added:**
- `delete-item` intent handler in action function
- `delete-category` intent handler in action function
- Calls `tryDeleteGradebookItem` with proper args object
- Calls `tryDeleteGradebookCategory` with proper args object
- Updated `tryUpdateGradebookCategory` call to use new args pattern
- Returns success/error responses

## Workflow Changes

### Item Deletion Workflow

1. **Identify Manual Item**: User identifies a manual gradebook item (not linked to activity module)
2. **Click Delete**: User clicks trash icon next to the item
3. **Confirm Deletion**: User confirms deletion in dialog
4. **Server Validation**: Server validates item exists and checks weight total after deletion
5. **Transaction Rollback**: If weight total is not 100%, transaction is rolled back
6. **Success Response**: If validation passes, item is deleted and success message shown
7. **Automatic Refresh**: React Router automatically revalidates and refreshes the page

### Category Deletion Workflow

1. **Identify Category**: User identifies a gradebook category to delete
2. **Click Delete**: User clicks trash icon next to the category
3. **Confirm Deletion**: User confirms deletion in dialog (warns that category must be empty)
4. **Server Validation**: Server validates:
   - Category exists
   - Category has no subcategories
   - Category has no items
   - Weight total equals 100% after deletion
5. **Transaction Rollback**: If any validation fails, transaction is rolled back
6. **Success Response**: If all validations pass, category is deleted and success message shown
7. **Automatic Refresh**: React Router automatically revalidates and refreshes the page

### Weight Validation Workflow

1. **Operation Performed**: Create, update, or delete gradebook item or category
2. **Transaction Started**: Operation occurs within database transaction
3. **Weight Calculated**: System calculates overall weights for all non-extra-credit items
4. **Validation Check**: Checks if `baseTotal` equals exactly 100% (within 0.01 tolerance)
5. **Success Path**: If valid, transaction commits and operation completes
6. **Failure Path**: If invalid, transaction rolls back and error is thrown

### Category Validation Workflow

1. **Pre-Deletion Check**: Before deleting a category, system checks:
   - Category has no subcategories (throws error if found)
   - Category has no items (throws error if found)
2. **Weight Validation**: After deletion, validates overall weight total equals 100%
3. **Transaction Management**: All checks occur within a single transaction
4. **Rollback on Failure**: Transaction rolls back if any validation fails

## Key Design Decisions

### Extra Credit Handling

- **Exclusion from Validation**: Extra credit items are explicitly excluded from the 100% requirement
- **Separate Totals**: System maintains separate `baseTotal` (non-extra-credit) and `extraCreditTotal`
- **Calculated Total**: `calculatedTotal = 100 + extraCreditTotal` for display purposes
- **Validation Logic**: Only `baseTotal` is validated to equal 100%

### Transaction Management

- **Nested Transaction Support**: Functions can accept existing transactions via `req.transactionID`
- **Automatic Management**: Functions create transactions if not provided
- **Proper Cleanup**: Only commit/rollback transactions created by the function
- **Atomic Operations**: All validation and operations occur within single transaction

### Manual Item Restriction

- **Deletion Limitation**: Only manual items (not linked to activity modules) can be deleted
- **Rationale**: Items linked to activity modules should be managed through module deletion
- **UI Indication**: Delete button only appears for eligible items

### Category Deletion Restriction

- **Empty Category Requirement**: Categories can only be deleted if they have no subcategories and no items
- **Validation Function**: Extracted `tryValidateNoSubItemAndCategory` for reusable validation
- **Clear Error Messages**: Users receive specific error messages indicating what needs to be removed first
- **UI Warning**: Confirmation dialog warns users that category must be empty

## Error Handling

- **WeightExceedsLimitError**: Thrown when weight total is not exactly 100%
- **GradebookItemNotFoundError**: Thrown when item to delete doesn't exist
- **GradebookCategoryNotFoundError**: Thrown when category to delete doesn't exist
- **InvalidArgumentError**: Thrown when category has subcategories or items (prevents deletion)
- **TransactionIdNotFoundError**: Thrown when transaction creation fails
- **Consistent Error Messages**: All errors include context about the operation that failed

## Testing

- Updated `gradebook-item-management.test.ts` to use new args pattern for `tryDeleteGradebookItem`
- Updated `gradebook-category-management.test.ts` to use new args pattern for `tryUpdateGradebookCategory` and `tryDeleteGradebookCategory`
- Added test case for weight validation failure on item deletion
- Tests verify transaction rollback on validation failure
- Tests verify extra credit items don't affect validation
- Tests verify category deletion validation (no subcategories, no items)

## Migration Notes

- No database migration required
- All changes are backward compatible
- Existing gradebook items continue to work as before

## Breaking Changes

None. All changes are additive and maintain backward compatibility.

## Future Enhancements

- Bulk delete operations for multiple manual items
- Soft delete option with restore functionality
- Weight validation warnings (non-blocking) for near-threshold values
- Visual indicators for items that would cause validation failures

