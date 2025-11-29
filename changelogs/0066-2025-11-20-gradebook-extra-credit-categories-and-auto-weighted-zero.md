# Gradebook Extra Credit Categories and Auto-Weighted-Zero Support

**Date:** 2025-11-20  
**Type:** Feature Enhancement  
**Impact:** Medium - Adds extra credit support for categories and automatic handling of empty categories in weight distribution

## Overview

This changelog documents the implementation of extra credit support for gradebook categories and the introduction of auto-weighted-zero categories. These enhancements provide more flexible weight management for gradebook structures, allowing categories to be marked as extra credit and automatically handling categories with no contributing weight. This feature enables more sophisticated gradebook configurations while maintaining weight integrity.

## Key Changes

### Extra Credit Categories

#### Category Extra Credit Field
- **Database Field**: Added `extraCredit` boolean field to gradebook categories collection
- **Database Migration**: Created migration to add `extra_credit` column to `gradebook_categories` table
- **Weight Calculation**: Extra credit categories contribute to `extraCreditTotal` and allow totals to exceed 100%
- **UI Integration**: Extra credit checkbox available in category edit modal (only when category has items)
- **Validation**: Extra credit categories must have a weight specified (cannot be auto-weighted)

#### Category Creation Restriction
- Categories cannot be created as extra credit
- Extra credit checkbox only available in edit modal when category has items
- Prevents confusion about when extra credit applies

### Auto-Weighted-Zero Categories

#### Automatic Detection
- **Empty Category Detection**: Categories with no non-extra-credit items are automatically marked as auto-weighted-zero
- **Recursive Detection**: Parent categories are marked as auto-weighted-zero if all subcategories are auto-weighted-zero
- **Weight Distribution Exclusion**: Auto-weighted-zero categories do not participate in weight distribution
- **UI Display**: Auto-weighted-zero categories display as "auto (0%)" with explanatory tooltip

#### Weight Calculation
- Auto-weighted-zero categories are treated as 0% weight but still show as auto-weighted
- Excluded from weight distribution to ensure accurate calculations
- Two-pass algorithm identifies these categories before weight distribution

### Enhanced Weight Calculations

#### Two-Pass Algorithm
- **Refactored `calculateAdjustedWeights`**: Now uses two-pass approach:
  - First pass: Recursively processes children and identifies auto-weighted-zero categories
  - Second pass: Calculates adjusted weights, excluding auto-weighted-zero categories from distribution
- **Extra Credit Category Totals**: `calculateOverallWeights` now includes extra credit categories in `extraCreditTotal`
- **Category Overall Weight**: Added helper function to calculate overall weight for extra credit categories
- **Total Display**: Updated total tooltip to show both extra credit items and categories separately

### UI Improvements

#### Conditional Weight Fields
- Category edit modal only shows weight and extra credit fields when category has items
- Alert display shows informative message when category has no items
- Prevents users from setting weight on empty categories

#### Weight Display Enhancements
- Auto-weighted-zero categories show "auto (0%)" instead of "auto-weighted-0"
- Tooltip enhancements explain auto-weighted-zero behavior
- Extra credit category contributions shown in total tooltip

## Technical Details

### Files Modified

1. **`server/collections/gradebook-categories.ts`**
   - Added `extraCredit` checkbox field to gradebook categories collection
   - Field configuration: checkbox, default false, not required

2. **`server/internal/gradebook-category-management.ts`**
   - Removed `extraCredit` from create arguments
   - Added `extraCredit?: boolean` to `UpdateGradebookCategoryArgs`
   - Added validation: Extra credit categories must have a weight specified

3. **`server/internal/gradebook-weight-calculations.ts`**
   - Refactored `calculateAdjustedWeights` to use two-pass algorithm
   - Added auto-weighted-zero category detection logic
   - Enhanced `calculateOverallWeights` to include extra credit categories
   - Added `collectAllCategories` helper function
   - Added `calculateCategoryOverallWeight` helper function

4. **`app/components/create-category-modal.tsx`**
   - Removed `extraCredit` checkbox from create modal
   - Removed `extraCredit` from initial values and form submission

5. **`app/components/update-grade-category-modal.tsx`**
   - Added conditional rendering based on `category.hasItems`
   - Shows weight and extra credit fields only when category has items
   - Shows informative alert when category has no items

6. **`app/components/create-grade-item-modal.tsx`**
   - Extra credit checkbox now only appears when "Override Weight" is checked
   - Matches behavior of `UpdateGradeItemModal` for consistency

7. **`app/components/weight-display.tsx`**
   - Added `autoWeightedZero?: boolean` prop
   - Special handling for auto-weighted-zero categories
   - Display text: "auto (0%)" with explanatory tooltip

8. **`app/components/gradebook-setup-view.tsx`**
   - Added `extraCreditCategories` prop to display in total tooltip
   - Updated total tooltip to show extra credit categories separately
   - Passes `auto_weighted_zero` flag to `WeightDisplay` component

9. **`app/components/gradebook-item-row.tsx`**
   - Passes `autoWeightedZero` flag to `WeightDisplay`
   - Passes `extraCredit` and `hasItems` to `UpdateGradeCategoryButton`

10. **`app/utils/schemas.ts`**
    - Removed `extraCredit` from `createCategorySchema`
    - Added `extraCredit: z.boolean().optional()` to `updateCategorySchema`

### Database Schema

**Migration:** `20251120_233806.ts`

Added field to `gradebook_categories` table:
- `extra_credit` (boolean): Indicates if category is extra credit
- Default value: `false`
- Not required (nullable)

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

## User Impact

### For Instructors

#### Extra Credit Categories
- Can mark categories as extra credit after adding items and setting weight
- Extra credit categories contribute to gradebook totals beyond 100%
- Clear UI indication of which categories are extra credit
- Validation prevents marking empty categories as extra credit

#### Auto-Weighted-Zero Categories
- Empty categories are automatically handled in weight distribution
- Clear display shows "auto (0%)" for auto-weighted-zero categories
- Tooltip explains that category doesn't participate in weight distribution
- No manual intervention needed for empty categories

#### Weight Management
- More flexible gradebook configurations with extra credit categories
- Automatic handling of empty categories simplifies weight management
- Clear visual indicators for category states

### For Administrators

#### Gradebook Integrity
- System automatically handles empty categories in weight distribution
- Extra credit categories properly contribute to totals
- Weight calculations remain accurate with complex category structures

## Migration Notes

### Database Migration Required

- **Migration Command**: `bun run payload migrate`
- **Migration File**: `20251120_233806.ts`
- Migration will:
  - Add `extra_credit` column (boolean) to `gradebook_categories` table
  - Set default value to `false` for existing categories
  - Make column nullable (not required)

### Backward Compatibility

- ✅ Existing categories default to `extraCredit: false`
- ✅ No data loss or breaking changes
- ✅ All existing categories continue to work as before
- ✅ Migration is non-breaking and safe to apply

### Post-Migration Steps

1. Run database migration: `bun run payload migrate`
2. Regenerate Payload types: `bun run payload generate:types`
3. Existing categories will have `extraCredit: false` by default
4. Instructors can mark categories as extra credit after adding items
5. Auto-weighted-zero detection will work automatically for empty categories

## Testing Considerations

### Functional Testing

- ✅ Verify extra credit checkbox appears only when category has items
- ✅ Test marking category as extra credit with weight specified
- ✅ Test validation error when extra credit checked but weight is null
- ✅ Verify extra credit categories contribute to `extraCreditTotal`
- ✅ Test auto-weighted-zero detection for empty categories
- ✅ Test auto-weighted-zero detection for categories with only extra credit items
- ✅ Test auto-weighted-zero detection for categories with all auto-weighted-zero subcategories
- ✅ Verify auto-weighted-zero categories excluded from weight distribution
- ✅ Test two-pass algorithm identifies auto-weighted-zero categories correctly
- ✅ Verify weight display shows "auto (0%)" for auto-weighted-zero categories
- ✅ Test total tooltip shows extra credit categories separately

### UI/UX Testing

- ✅ Verify conditional weight fields display correctly
- ✅ Test alert message when category has no items
- ✅ Verify tooltip explanations are clear and helpful
- ✅ Test responsive layout for category modals
- ✅ Verify weight display formatting is consistent

### Edge Cases

- ✅ Empty category: Automatically marked as auto-weighted-zero
- ✅ Category with only extra credit items: Marked as auto-weighted-zero
- ✅ Category with all auto-weighted-zero subcategories: Marked as auto-weighted-zero
- ✅ Extra credit category with null weight: Validation error shown
- ✅ Extra credit category with weight: Works correctly
- ✅ Mixed extra credit and non-extra-credit items: Handled correctly

## Related Features

### Gradebook Weight Validation
- Extra credit categories integrate with existing weight validation system
- Auto-weighted-zero categories work with weight distribution logic
- Both features maintain weight integrity requirements

### Category Management
- Extra credit setting follows same pattern as other category updates
- Auto-weighted-zero detection works automatically with category operations
- UI improvements consistent with existing category management patterns

## Conclusion

The addition of extra credit category support and auto-weighted-zero handling significantly enhances gradebook flexibility and usability. Extra credit categories enable more sophisticated grading schemes, while auto-weighted-zero categories automatically handle empty categories in weight distribution. The two-pass algorithm ensures accurate weight calculations, and the UI improvements provide clear feedback to instructors. All changes maintain backward compatibility and improve the overall gradebook management experience.

---

**Summary**: Added extra credit support for gradebook categories and automatic handling of empty categories (auto-weighted-zero). Categories can now be marked as extra credit after adding items, and empty categories are automatically excluded from weight distribution. The two-pass algorithm ensures accurate weight calculations while maintaining gradebook integrity.
