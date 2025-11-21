# Gradebook Extra Credit Categories and Auto-Weighted-Zero Support

**Date:** November 20, 2025

## Overview

This changelog documents the implementation of extra credit support for gradebook categories and the introduction of auto-weighted-zero categories. These enhancements provide more flexible weight management for gradebook structures, allowing categories to be marked as extra credit and automatically handling categories with no contributing weight.

## Key Features

### 1. Extra Credit Categories

- **Category Extra Credit Field**: Added `extraCredit` boolean field to gradebook categories collection
- **Database Migration**: Created migration to add `extra_credit` column to `gradebook_categories` table
- **Weight Calculation**: Extra credit categories contribute to `extraCreditTotal` and allow totals to exceed 100%
- **UI Integration**: Extra credit checkbox available in category edit modal (only when category has items)
- **Validation**: Extra credit categories must have a weight specified (cannot be auto-weighted)

### 2. Auto-Weighted-Zero Categories

- **Automatic Detection**: Categories with no non-extra-credit items are automatically marked as auto-weighted-zero
- **Weight Distribution Exclusion**: Auto-weighted-zero categories do not participate in weight distribution
- **Recursive Detection**: Parent categories are marked as auto-weighted-zero if all subcategories are auto-weighted-zero
- **UI Display**: Auto-weighted-zero categories display as "auto (0%)" with explanatory tooltip
- **Weight Calculation**: Auto-weighted-zero categories are treated as 0% weight but still show as auto-weighted

### 3. Enhanced Weight Calculations

- **Two-Pass Algorithm**: Refactored `calculateAdjustedWeights` to use two-pass approach:
  - First pass: Recursively processes children and identifies auto-weighted-zero categories
  - Second pass: Calculates adjusted weights, excluding auto-weighted-zero categories from distribution
- **Extra Credit Category Totals**: `calculateOverallWeights` now includes extra credit categories in `extraCreditTotal`
- **Category Overall Weight**: Added helper function to calculate overall weight for extra credit categories
- **Total Display**: Updated total tooltip to show both extra credit items and categories separately

### 4. UI Improvements

- **Conditional Weight Fields**: Category edit modal only shows weight and extra credit fields when category has items
- **Alert Display**: Shows informative alert when category has no items, explaining weight can only be changed when items exist
- **Extra Credit Checkbox**: Extra credit checkbox in create item modal only appears when "Override Weight" is checked
- **Weight Display**: Auto-weighted-zero categories show "auto (0%)" instead of "auto-weighted-0"
- **Tooltip Enhancements**: Updated tooltips to explain auto-weighted-zero behavior and extra credit category contributions

## Technical Changes

### API Changes

#### `tryCreateGradebookCategory`

**Enhanced:**
- Removed `extraCredit` from create arguments (categories cannot be created as extra credit)
- Categories are always created with `extraCredit: false`
- Rationale: Extra credit should only be set after category has items and weight

#### `tryUpdateGradebookCategory`

**Before:**
- No support for `extraCredit` field
- No validation for extra credit categories requiring weight

**After:**
- Added `extraCredit?: boolean` to `UpdateGradebookCategoryArgs`
- Added validation: Extra credit categories must have a weight specified
- Throws `InvalidArgumentError` if category is marked as extra credit but weight is `null`
- Error message: "Extra credit categories must have a weight specified. Please set a weight before marking the category as extra credit."

#### `calculateAdjustedWeights`

**Before:**
- Single-pass algorithm
- All auto-weighted items participated in weight distribution
- No special handling for empty categories

**After:**
- Two-pass algorithm:
  1. **First Pass**: Process children recursively and identify auto-weighted-zero categories
  2. **Second Pass**: Calculate adjusted weights, excluding auto-weighted-zero categories from distribution
- Auto-weighted-zero detection:
  - Category has no non-extra-credit items
  - Category has no nested categories, OR
  - Category has nested categories but all are auto-weighted-zero
- Auto-weighted-zero categories get `adjusted_weight = 0` and `auto_weighted_zero = true`

#### `calculateOverallWeights`

**Enhanced:**
- Added `extraCreditCategories` to return type
- Added `collectAllCategories` helper to find all categories in structure
- Added `calculateCategoryOverallWeight` helper to recursively calculate category's overall weight
- `extraCreditFromCategories`: Sums overall weights of categories marked as extra credit
- `extraCreditTotal`: Now includes both `extraCreditFromItems` and `extraCreditFromCategories`
- `extraCreditCategoriesWithWeights`: Maps extra credit categories with their calculated overall weights

### Component Changes

#### `CreateCategoryModal`

**Removed:**
- `extraCredit` checkbox (categories cannot be created as extra credit)
- `extraCredit` from initial values and form submission

**Rationale:**
- Extra credit should only be set after category has items and weight
- Prevents confusion about when extra credit applies

#### `UpdateGradeCategoryModal`

**Enhanced:**
- Added conditional rendering based on `category.hasItems`
- When category has items:
  - Shows "Override Weight" checkbox
  - Shows weight input and extra credit checkbox when override is checked
- When category has no items:
  - Shows informative `Alert` component
  - Message: "Weight can only be changed when category has items"
  - Prevents users from setting weight on empty categories

#### `CreateGradeItemModal`

**Enhanced:**
- Extra credit checkbox now only appears when "Override Weight" is checked
- Matches behavior of `UpdateGradeItemModal` for consistency
- Extra credit checkbox moved inside conditional block with weight input

#### `WeightDisplay`

**Enhanced:**
- Added `autoWeightedZero?: boolean` prop
- Special handling for auto-weighted-zero categories:
  - Display text: "auto (0%)"
  - Tooltip explains category doesn't participate in weight distribution
  - Tooltip title: "No weight specified" (updated from "Auto-weighted-0")
- Consistent display format across all weight states

#### `GradebookSetupView`

**Enhanced:**
- Added `extraCreditCategories` prop to display in total tooltip
- Updated total tooltip to show:
  - Extra credit categories with "(Category)" label
  - Extra credit items with item name
  - Both displayed with their overall weights
- Passes `auto_weighted_zero` flag to `WeightDisplay` component

#### `GradebookItemRow`

**Enhanced:**
- Passes `autoWeightedZero={item.auto_weighted_zero ?? false}` to `WeightDisplay`
- Passes `extraCredit: item.extra_credit ?? false` to `UpdateGradeCategoryButton`
- Passes `hasItems: hasNestedItems ?? false` to `UpdateGradeCategoryButton`

### Schema Changes

#### `gradebook-categories` Collection

**Added:**
- `extraCredit` field:
  - Type: `checkbox`
  - Label: "Extra Credit"
  - Default value: `false`
  - Required: No

#### Database Migration

**New Migration:**
- `20251120_233806.ts`: Adds `extra_credit` column to `gradebook_categories` table
- Column type: `boolean` with default value `false`
- Backward compatible: Existing categories default to `false`

#### Zod Schemas

**Updated:**
- `createCategorySchema`: Removed `extraCredit` field
- `updateCategorySchema`: Added `extraCredit: z.boolean().optional()`

### Type Changes

#### `GradebookSetupItem`

**Added:**
- `extra_credit?: boolean` - Indicates if item/category is extra credit
- `auto_weighted_zero?: boolean` - Indicates if category is auto-weighted to 0%

#### `GradebookSetupItemWithCalculations`

**Added:**
- `auto_weighted_zero?: boolean` - Flag for auto-weighted-zero categories

#### `GradebookSetupForUI`

**Added:**
- `extraCreditCategories: GradebookSetupItemWithCalculations[]` - List of extra credit categories with calculated weights

#### `UpdateGradebookCategoryArgs`

**Added:**
- `extraCredit?: boolean` - Optional flag to mark category as extra credit

## Workflow Changes

### Category Creation Workflow

1. **Create Category**: User creates category without weight or extra credit options
2. **Add Items**: User adds items to category
3. **Set Weight**: User can now set weight and optionally mark as extra credit
4. **Validation**: If marked as extra credit, weight must be specified (cannot be null)

### Category Update Workflow

1. **Check Items**: System checks if category has items
2. **No Items**: Shows alert explaining weight can only be changed when items exist
3. **Has Items**: Shows weight override checkbox
4. **Override Weight**: When checked, shows weight input and extra credit checkbox
5. **Set Extra Credit**: If extra credit is checked, validates weight is not null
6. **Validation Error**: If extra credit checked but weight is null, shows error message

### Weight Distribution Workflow

1. **Identify Auto-Weighted-Zero**: System identifies categories with no contributing weight
2. **Exclude from Distribution**: Auto-weighted-zero categories are excluded from weight distribution
3. **Distribute Remaining**: Remaining weight is distributed evenly among other auto-weighted items
4. **Display**: Auto-weighted-zero categories show as "auto (0%)" with explanatory tooltip

### Extra Credit Calculation Workflow

1. **Calculate Item Extra Credit**: Sum overall weights of extra credit items
2. **Calculate Category Extra Credit**: Sum overall weights of extra credit categories
3. **Total Extra Credit**: Combine item and category extra credit totals
4. **Display Total**: Show `calculatedTotal = 100 + extraCreditTotal` in UI

## Key Design Decisions

### Extra Credit Categories Cannot Be Created

- **Rationale**: Extra credit requires a weight to be meaningful
- **Implementation**: Extra credit checkbox only available in edit modal when category has items
- **User Experience**: Prevents confusion about when extra credit applies

### Auto-Weighted-Zero Categories

- **Rationale**: Categories with no contributing weight should not participate in distribution
- **Implementation**: Two-pass algorithm identifies and excludes these categories
- **Display**: Shows as "auto (0%)" to indicate it's auto-weighted but treated as 0%
- **User Experience**: Clear indication that category doesn't contribute to weight distribution

### Weight Required for Extra Credit Categories

- **Rationale**: Extra credit needs a weight to calculate contribution
- **Validation**: Throws error if extra credit is checked but weight is null
- **Error Message**: Clear explanation that weight must be set before marking as extra credit

### Two-Pass Weight Calculation

- **Rationale**: Need to identify auto-weighted-zero categories before calculating distribution
- **First Pass**: Recursively processes children to identify auto-weighted-zero categories
- **Second Pass**: Calculates weights excluding auto-weighted-zero categories
- **Benefits**: Ensures accurate weight distribution and proper handling of empty categories

## Error Handling

- **InvalidArgumentError**: Thrown when extra credit category has null weight
  - Message: "Extra credit categories must have a weight specified. Please set a weight before marking the category as extra credit."
- **Consistent Error Messages**: All errors include context about the operation that failed

## Testing

- Added test case for extra credit category calculation in `calculateOverallWeights`
- Added test case for auto-weighted-zero category detection in `calculateAdjustedWeights`
- Added test case for empty auto-weighted category
- Added test case for category with only extra credit items
- Added test case for category with all auto-weighted-zero subcategories
- Added test case for auto-weighted-zero categories excluded from weight distribution
- All 22 tests pass in `gradebook-weight-calculations.test.ts`

## Migration Notes

- **Database Migration Required**: `20251120_233806.ts` adds `extra_credit` column
- **Backward Compatible**: Existing categories default to `extraCredit: false`
- **No Data Loss**: All existing categories continue to work as before
- **Automatic Migration**: Migration runs automatically on next deployment

## Breaking Changes

None. All changes are additive and maintain backward compatibility.

## Future Enhancements

- Visual indicators for auto-weighted-zero categories in gradebook structure
- Bulk operations for setting extra credit on multiple categories
- Weight distribution preview before applying changes
- Validation warnings for categories that would become auto-weighted-zero

