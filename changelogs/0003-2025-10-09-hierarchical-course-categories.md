# Changelog 0003 - Hierarchical Course Categories

**Date:** 2025-10-09  
**Type:** Major Feature  
**Status:** Completed

## Summary

Implemented a hierarchical course categories system that allows unlimited nesting (configurable via global settings), tracks direct courses and subcategories, and calculates total nested course counts. Categories can be organized in a tree structure to better organize courses in the LMS.

## Changes Made

### Database Schema Changes

#### 1. New CourseCategories Collection
Created `server/collections/course-categories.ts` with:
- **Fields:**
  - `name` (text, required): Category name
  - `parent` (relationship to self, optional): Parent category for nested organization
  - `subcategories` (join field): Auto-populated list of child categories
  - `courses` (join field): Auto-populated list of courses in this category

- **Validation Hooks:**
  - `beforeValidate`: Prevents circular references (category cannot be its own ancestor)
  - `beforeValidate`: Enforces max depth limit from global configuration
  - Validates parent exists and prevents self-referencing

#### 2. Updated Courses Collection
Added to `server/collections/courses.ts`:
```typescript
{
  name: "category",
  type: "relationship",
  relationTo: "course-categories",
  label: "Category",
}
```

#### 3. Updated Global Configuration
Added to `server/collections/globals.ts` (SystemGradeTable):
```typescript
{
  name: "maxCategoryDepth",
  type: "number",
  label: "Maximum Category Depth",
  admin: {
    description: "Maximum nesting depth for course categories. Leave empty for unlimited depth.",
  },
  min: 1,
}
```

### Internal Functions

Created `server/internal/course-category-management.ts` with:

#### Core CRUD Operations
- **`tryCreateCategory(payload, request, args)`**: Creates new category with validation
  - Validates against circular references
  - Checks depth limit from global config
  - Uses transactions for data integrity

- **`tryUpdateCategory(payload, request, categoryId, args)`**: Updates existing category
  - Validates parent changes
  - Prevents circular references on parent update
  - Recalculates depth on parent change

- **`tryDeleteCategory(payload, request, categoryId)`**: Deletes category
  - Checks for subcategories (must delete children first)
  - Checks for courses (must reassign or remove first)
  - Ensures clean deletion

- **`tryFindCategoryById(payload, categoryId)`**: Fetches single category with depth 1

#### Tree & Hierarchy Operations
- **`tryGetCategoryTree(payload)`**: Returns complete tree structure
  - Builds hierarchical tree from flat data
  - Includes counts for direct courses, subcategories, and total nested courses
  - Returns only root categories with populated subcategories

- **`tryGetCategoryAncestors(payload, categoryId)`**: Returns breadcrumb path
  - Gets all ancestors from root to current category
  - Ordered from root to target category
  - Useful for navigation breadcrumbs

- **`tryGetCategoryDepth(payload, categoryId)`**: Calculates category depth
  - Depth 0 for root categories
  - Depth 1 for first-level children
  - Recursively calculates by traversing ancestors

#### Counting & Search Operations
- **`tryGetTotalNestedCoursesCount(payload, categoryId)`**: Counts all courses
  - Recursively counts courses in category and all subcategories
  - Returns total including nested courses

- **`tryFindRootCategories(payload, limit)`**: Finds top-level categories
  - Returns categories without parent
  - Sorted by name

- **`tryFindSubcategories(payload, parentId, limit)`**: Finds direct children
  - Returns only immediate subcategories
  - Sorted by name

### Updated Course Management

Updated `server/internal/course-management.ts`:
- Added `category?: number` to `CreateCourseArgs` interface
- Updated `tryCreateCourse` to accept and store category
- Added type narrowing for category field
- Set `depth: 1` on course creation to populate category relationship

### Type Definitions

```typescript
export interface CreateCategoryArgs {
  name: string;
  parent?: number;
}

export interface UpdateCategoryArgs {
  name?: string;
  parent?: number;
}

export interface CategoryTreeNode {
  id: number;
  name: string;
  parent: number | null;
  directCoursesCount: number;
  directSubcategoriesCount: number;
  totalNestedCoursesCount: number;
  subcategories: CategoryTreeNode[];
}
```

### Key Features

#### 1. Circular Reference Prevention
```typescript
// Before setting parent, check if new parent is a descendant
const isDescendant = await checkIsDescendant(payload, currentId, parentId);
if (isDescendant) {
  throw new Error("Cannot set parent to a descendant category (circular reference)");
}
```

#### 2. Depth Limit Enforcement
```typescript
const globalConfig = await payload.findGlobal({ slug: "system-grade-table" });
const maxDepth = globalConfig?.maxCategoryDepth;

if (maxDepth != null && maxDepth > 0) {
  const parentDepth = await calculateDepth(payload, parentId);
  const newDepth = parentDepth + 1;
  
  if (newDepth >= maxDepth) {
    throw new Error(`Category depth limit exceeded. Maximum allowed depth is ${maxDepth}`);
  }
}
```

#### 3. Recursive Course Counting
```typescript
async function getTotalNestedCoursesCount(payload, categoryId) {
  // Count direct courses
  const directCount = await payload.count({
    collection: "courses",
    where: { category: { equals: categoryId } }
  });
  
  // Get subcategories and recursively count their courses
  const subcategories = await payload.find({
    collection: "course-categories",
    where: { parent: { equals: categoryId } }
  });
  
  let nestedCount = 0;
  for (const subcat of subcategories.docs) {
    nestedCount += await getTotalNestedCoursesCount(payload, subcat.id);
  }
  
  return directCount + nestedCount;
}
```

#### 4. Tree Building
```typescript
// Build hierarchical tree from flat category list
const categoryMap = new Map<number, CategoryTreeNode>();
const rootCategories: CategoryTreeNode[] = [];

// First pass: create all nodes with counts
for (const cat of allCategories.docs) {
  const node = {
    id: cat.id,
    name: cat.name,
    parent: cat.parent?.id ?? null,
    directCoursesCount: await payload.count(...),
    directSubcategoriesCount: await payload.count(...),
    totalNestedCoursesCount: await getTotalNestedCoursesCount(...),
    subcategories: []
  };
  categoryMap.set(cat.id, node);
}

// Second pass: build tree structure
for (const node of categoryMap.values()) {
  if (node.parent === null) {
    rootCategories.push(node);
  } else {
    categoryMap.get(node.parent)?.subcategories.push(node);
  }
}
```

### Test Coverage

Created comprehensive test suite in `server/internal/course-category-management.test.ts`:

#### Category Creation Tests
- ✅ Create root category
- ✅ Create nested category with valid parent
- ✅ Prevent circular reference when creating category
- ✅ Enforce max category depth when configured

#### Category Update Tests
- ✅ Update category name
- ✅ Change category parent
- ✅ Prevent circular reference when updating parent

#### Category Deletion Tests
- ✅ Delete empty category
- ✅ Fail to delete category with subcategories
- ✅ Fail to delete category with courses

#### Query Tests
- ✅ Find category by ID
- ✅ Get category tree structure
- ✅ Get category ancestors
- ✅ Calculate category depth correctly
- ✅ Count total nested courses correctly
- ✅ Find root categories
- ✅ Find subcategories

#### Course Integration Tests
- ✅ Assign course to category
- ✅ Move course between categories

### Transaction Management

All mutations use database transactions:
```typescript
const transactionID = await payload.db.beginTransaction();

try {
  // Perform operations
  await payload.create({ ..., req: { ...request, transactionID } });
  await payload.db.commitTransaction(transactionID);
  return result;
} catch (error) {
  await payload.db.rollbackTransaction(transactionID);
  throw error;
}
```

## Migration

Database migration created: `src/migrations/20251009_181538.ts`
- Adds `course-categories` collection
- Adds `category` field to `courses` collection
- Adds `maxCategoryDepth` field to `system-grade-table` global

## Usage Examples

### Create Category Hierarchy
```typescript
// Create root category
const scienceResult = await tryCreateCategory(payload, request, {
  name: "Science"
});

// Create subcategory
const physicsResult = await tryCreateCategory(payload, request, {
  name: "Physics",
  parent: scienceResult.value.id
});

// Create nested subcategory
const mechanicsResult = await tryCreateCategory(payload, request, {
  name: "Mechanics",
  parent: physicsResult.value.id
});
```

### Assign Course to Category
```typescript
const courseResult = await tryCreateCourse(payload, request, {
  title: "Introduction to Physics",
  description: "Fundamentals of physics",
  slug: "intro-physics-101",
  createdBy: userId,
  category: physicsResult.value.id
});
```

### Get Category Tree
```typescript
const treeResult = await tryGetCategoryTree(payload);
if (treeResult.ok) {
  // Returns:
  // [
  //   {
  //     id: 1,
  //     name: "Science",
  //     parent: null,
  //     directCoursesCount: 2,
  //     directSubcategoriesCount: 3,
  //     totalNestedCoursesCount: 15,
  //     subcategories: [
  //       {
  //         id: 2,
  //         name: "Physics",
  //         parent: 1,
  //         directCoursesCount: 5,
  //         subcategories: [...]
  //       }
  //     ]
  //   }
  // ]
}
```

### Get Breadcrumb Path
```typescript
const ancestorsResult = await tryGetCategoryAncestors(payload, mechanicsId);
if (ancestorsResult.ok) {
  // Returns: [Science, Physics, Mechanics]
  const breadcrumbs = ancestorsResult.value.map(c => c.name).join(' > ');
  // "Science > Physics > Mechanics"
}
```

### Configure Depth Limit
```typescript
// Set maximum depth to 3 levels (0, 1, 2)
await payload.updateGlobal({
  slug: "system-grade-table",
  data: { maxCategoryDepth: 3 }
});

// Set to null for unlimited depth
await payload.updateGlobal({
  slug: "system-grade-table",
  data: { maxCategoryDepth: null }
});
```

## Breaking Changes

None - This is a new feature with no impact on existing functionality.

## Benefits

1. **Better Course Organization**: Organize courses hierarchically for easier navigation
2. **Flexible Nesting**: Support for unlimited nesting depth (configurable)
3. **Data Integrity**: Circular reference prevention and depth validation
4. **Rich Metadata**: Track direct and nested course counts for each category
5. **Tree Navigation**: Built-in tree structure and breadcrumb support
6. **Transaction Safety**: All mutations are atomic with automatic rollback on error

## Future Enhancements

Potential future additions:
- Category icons/thumbnails
- Category descriptions
- Category-level permissions
- Category sorting/ordering
- Category archiving/hiding
- Drag-and-drop reordering in admin UI
- Category-based course filtering in frontend
- Category analytics (most popular categories, etc.)

