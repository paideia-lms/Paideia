<!-- 4a0403e1-a674-474b-afc0-f105c6c6b70a 7cdecb31-0351-4e41-b0df-35076cf281d0 -->
# Category Role Assignments Implementation Plan

## Overview

Implement a role-based access control system at the category level where role assignments cascade down to all nested courses and subcategories. If a user has a "manager" role on a category, they automatically have manager access to all courses in that category and its subcategories.

## 1. Create Category Role Assignments Collection

**File: `server/collections/category-role-assignments.ts`**

Create new collection with category-specific management roles:

```typescript
{
  slug: "category-role-assignments",
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "course-categories",
      required: true
    },
    {
      name: "role",
      type: "select",
      options: [
        { 
          label: "Category Admin", 
          value: "category-admin",
          description: "Manages category settings, nested subcategories, and direct courses (e.g., bulk course creation)"
        },
        { 
          label: "Category Coordinator", 
          value: "category-coordinator",
          description: "Assigns roles within a category, monitors course counts, oversees subcategory consistency"
        },
        { 
          label: "Category Reviewer", 
          value: "category-reviewer",
          description: "Views analytics and content across category's courses/subcategories without edit rights"
        }
      ],
      required: true
    },
    {
      name: "assignedBy",
      type: "relationship",
      relationTo: "users",
      required: true
    },
    {
      name: "assignedAt",
      type: "date",
      defaultValue: () => new Date()
    },
    {
      name: "notes",
      type: "textarea",
      label: "Assignment Notes",
      admin: {
        description: "Optional notes about why this role was assigned"
      }
    }
  ],
  indexes: [
    {
      fields: ["user", "category"],
      unique: true  // One role per user per category
    },
    {
      fields: ["category"],  // Fast lookup of all users with roles on a category
    },
    {
      fields: ["user"],  // Fast lookup of all categories where user has roles
    }
  ]
}
```

## 2. Create Internal Functions

**File: `server/internal/category-role-management.ts`**

### Core Assignment Functions

- `tryAssignCategoryRole(payload, request, args)` - Assign role to user on category
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Args: `{ userId, categoryId, role, assignedBy }`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Validates user and category exist
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Creates or updates role assignment
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Uses transactions

- `tryRevokeCategoryRole(payload, request, userId, categoryId)` - Remove role assignment
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Validates assignment exists
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Deletes role assignment
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Uses transactions

- `tryUpdateCategoryRole(payload, request, assignmentId, newRole)` - Change assigned role
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Validates assignment exists
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Updates role
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Uses transactions

### Query Functions

- `tryGetUserCategoryRoles(payload, userId)` - Get all category role assignments for a user
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns list of categories with assigned roles
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Includes category details

- `tryGetCategoryRoleAssignments(payload, categoryId)` - Get all role assignments for a category
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns list of users with their roles
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Includes user details

- `tryFindCategoryRoleAssignment(payload, userId, categoryId)` - Get specific assignment
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns role if exists, null otherwise

### Permission Check Functions

- `tryCheckUserCategoryRole(payload, userId, categoryId, requiredRole?)` - Check if user has role on category
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns role if user has assignment
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns null if no assignment
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Optionally validates against required role

- `tryGetEffectiveCategoryRole(payload, userId, categoryId)` - Get effective role considering inheritance
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Checks category and all ancestors
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns highest priority role found
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Priority: manager > teacher > ta > student

- `tryGetUserCoursesFromCategories(payload, userId)` - Get all courses user has access to via category roles
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Finds all categories where user has roles
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Recursively collects all courses in those categories and subcategories
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns courses with effective role

- `tryCheckUserCourseAccessViaCategory(payload, userId, courseId)` - Check if user has access to course via category role
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Gets course's category
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Checks if user has role on that category or any ancestor
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns effective role or null

## 3. Update Course Access Control Logic

**File: `server/utils/check-course-access.ts`** (new file)

Create centralized access control:

```typescript
export async function checkUserCourseAccess(
  payload: Payload,
  userId: number,
  courseId: number
): Promise<{
  hasAccess: boolean;
  role: 'student' | 'teacher' | 'ta' | 'manager' | null;
  source: 'enrollment' | 'category' | 'global-admin';
}> {
  // 1. Check if user is global admin
  const user = await payload.findByID({ collection: 'users', id: userId });
  if (user.role === 'admin') {
    return { hasAccess: true, role: 'manager', source: 'global-admin' };
  }

  // 2. Check direct enrollment
  const enrollment = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { user: { equals: userId } },
        { course: { equals: courseId } },
        { status: { equals: 'active' } }
      ]
    }
  });

  if (enrollment.docs.length > 0) {
    return {
      hasAccess: true,
      role: enrollment.docs[0].role,
      source: 'enrollment'
    };
  }

  // 3. Check category-based access
  const categoryAccessResult = await tryCheckUserCourseAccessViaCategory(
    payload,
    userId,
    courseId
  );

  if (categoryAccessResult.ok && categoryAccessResult.value) {
    return {
      hasAccess: true,
      role: categoryAccessResult.value,
      source: 'category'
    };
  }

  return { hasAccess: false, role: null, source: null };
}
```

## 4. Helper Functions for Permission Cascade

**File: `server/internal/category-role-management.ts`** (continued)

### Cascade Logic

```typescript
/**
 * Get all descendant courses of a category (recursive)
 */
async function getAllDescendantCourses(
  payload: Payload,
  categoryId: number
): Promise<number[]> {
  const courseIds: number[] = [];

  // Get direct courses
  const directCourses = await payload.find({
    collection: 'courses',
    where: { category: { equals: categoryId } },
    pagination: false
  });
  courseIds.push(...directCourses.docs.map(c => c.id));

  // Get subcategories and recurse
  const subcategories = await payload.find({
    collection: 'course-categories',
    where: { parent: { equals: categoryId } },
    pagination: false
  });

  for (const subcat of subcategories.docs) {
    const nestedCourses = await getAllDescendantCourses(payload, subcat.id);
    courseIds.push(...nestedCourses);
  }

  return courseIds;
}

/**
 * Get effective role by checking category and all ancestors
 */
async function getEffectiveRole(
  payload: Payload,
  userId: number,
  categoryId: number
): Promise<string | null> {
  const rolePriority = {
    manager: 4,
    teacher: 3,
    ta: 2,
    student: 1
  };

  let currentCategoryId: number | null = categoryId;
  let highestRole: string | null = null;
  let highestPriority = 0;

  // Traverse up the category hierarchy
  while (currentCategoryId !== null) {
    // Check for role assignment at current level
    const assignments = await payload.find({
      collection: 'category-role-assignments',
      where: {
        and: [
          { user: { equals: userId } },
          { category: { equals: currentCategoryId } }
        ]
      }
    });

    if (assignments.docs.length > 0) {
      const role = assignments.docs[0].role;
      const priority = rolePriority[role] || 0;

      if (priority > highestPriority) {
        highestRole = role;
        highestPriority = priority;
      }
    }

    // Move to parent category
    const category = await payload.findByID({
      collection: 'course-categories',
      id: currentCategoryId,
      depth: 0
    });

    currentCategoryId = typeof category.parent === 'number'
      ? category.parent
      : category.parent?.id ?? null;
  }

  return highestRole;
}
```

## 5. Create Test Suite

**File: `server/internal/category-role-management.test.ts`**

Test cases:

- Assign role to user on category
- Revoke role from user on category
- Update role for existing assignment
- Prevent duplicate assignments (user can only have one role per category)
- Get all role assignments for a user
- Get all role assignments for a category
- Find specific role assignment
- Check if user has role on category
- Get effective role with inheritance (role on parent category applies to children)
- Role priority (manager > teacher > ta > student)
- Get all courses user can access via category roles
- Check course access via category role (direct category)
- Check course access via category role (ancestor category)
- Category role overrides lower priority enrollment
- Direct enrollment overrides lower priority category role
- Global admin has access regardless of assignments

## 6. Update Exports

**File: `server/collections/index.ts`**

- Export `CategoryRoleAssignments`

**File: `server/payload.config.ts`**

- Import and add to collections array

## 7. Integration Points

### Access Control Hooks

Update collections to use `checkUserCourseAccess`:

- Courses collection (access hooks)
- Assignments collection
- Quizzes collection
- Discussions collection
- Submissions collections

### API Endpoints

Create endpoints to:

- Assign/revoke category roles (admin/manager only)
- View category role assignments
- View inherited permissions

### Frontend Integration

- Category management UI to assign roles
- Visual indicators for inherited permissions
- User dashboard showing all courses (direct + category-based)

## 8. Migration

Generate migration for:

- New `category-role-assignments` collection
- Indexes for efficient queries

## Key Implementation Details

### Role Inheritance

- Roles cascade from parent categories to child categories and courses
- Users inherit the highest priority role from any ancestor category
- Direct enrollment takes precedence over category role if higher priority

### Role Priority

1. **Global Admin** - Full system access
2. **Manager** (category or enrollment) - Full access to category/course
3. **Teacher** (category or enrollment) - Teaching access
4. **TA** (category or enrollment) - Assistant access
5. **Student** (category or enrollment) - Student access

### Access Resolution Order

1. Check if user is global admin → grant manager access
2. Check direct course enrollment → use enrollment role
3. Check category role on course's category → use category role
4. Check category role on ancestor categories → use highest priority role
5. No access found → deny access

### Performance Considerations

- Cache category hierarchy for faster ancestor lookups
- Index on user-category pairs for fast role checks
- Batch queries when checking multiple courses
- Consider materialized view for user-course-role mapping

## Future Enhancements

- Role expiration dates
- Role-specific permissions customization
- Audit log for role assignments/revocations
- Bulk role assignment tools
- Role templates for common setups
- Category-level content restrictions
- Analytics on role usage

### To-dos

- [ ] Create category-role-assignments collection with user, category, role, and assignment tracking
- [ ] Implement core functions: assign, revoke, update, query role assignments
- [ ] Implement role inheritance and cascade logic (check ancestors, get effective role)
- [ ] Create centralized checkUserCourseAccess function with enrollment + category role checks
- [ ] Write comprehensive test suite for category roles and inheritance
- [ ] Export CategoryRoleAssignments and update payload config
- [ ] Generate database migration for category-role-assignments collection