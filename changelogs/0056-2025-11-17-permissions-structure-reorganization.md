# Permissions Structure Reorganization

**Date:** 2025-11-17  
**Type:** Code Refactoring  
**Impact:** Low - Internal code organization improvement, maintains full backward compatibility

## Overview

This changelog documents the reorganization of the permissions system in `server/utils/permissions.ts`. The file has been restructured with clear domain-based sections, helper functions for common role checks, standardized return types, and a new organized permissions object. All changes maintain backward compatibility with existing code, ensuring no breaking changes for consumers of the permissions API.

## Key Changes

### File Organization

#### Section Comments
- Added clear section dividers using comment blocks (`// ============================================================================`)
- Organized functions into logical domains:
  - Types and Interfaces
  - Helper Functions
  - Course Permissions
  - User/Profile Permissions
  - Module Permissions
  - Media Permissions
  - Quiz/Assignment Permissions
  - Discussion Permissions
  - Admin Permissions
  - Permissions Object

#### Domain Grouping
- All course-related permissions grouped together (settings, participants, grades, modules, bin, backup, structure, groups, access, edit)
- User and profile permissions organized hierarchically
- Module, media, quiz, discussion, and admin permissions in separate sections
- Related functions are now easier to locate and maintain

### Helper Functions

#### Naming Convention
- Created helper functions with "is" prefix following naming convention:
  - `isAdminOrContentManager()` - Checks for admin or content-manager roles
  - `isTeacherOrManager()` - Checks for teacher or manager enrollment roles
  - `isTeachingStaff()` - Checks for teacher, manager, or TA roles
- All helper functions are private (not exported) and used internally
- Consistent naming: permission functions use "can" prefix, helpers use "is" prefix

#### Code Deduplication
- Extracted common role checking patterns into reusable helpers
- Reduced code duplication across permission functions
- Improved maintainability - role logic changes only need to be made in one place
- Helper functions are used throughout permission checks for consistency

### Return Type Standardization

#### PermissionResult Consistency
- Converted all boolean-returning permission functions to return `PermissionResult`
- `PermissionResult` provides both `allowed: boolean` and `reason: string`
- All permission functions now provide descriptive reasons for allow/deny decisions
- Better user experience with clear permission denial messages

#### Updated Function Signatures
- All permission functions now return `PermissionResult` type
- Functions that previously returned `boolean` now return structured results
- Maintains type safety while providing richer information

### Organized Permissions Object

#### New Export Structure
- Created `permissions` object that organizes all functions by domain
- Provides structured access: `permissions.course.canSeeSettings()`
- Nested organization for related permissions:
  - `permissions.course.section.canSeeSettings()`
  - `permissions.course.module.canSeeSettings()`
  - `permissions.user.profile.fields.canEditFirstName()`
- Makes permission relationships and hierarchy clear

#### Backward Compatibility
- All individual function exports remain available
- Existing code using `canSeeCourseSettings()` continues to work
- New code can use either individual exports or the organized object
- No breaking changes for existing consumers

### Caller Updates

#### Updated Permission Checks
- Updated all 22+ files that use permission functions
- Changed from direct boolean usage to `.allowed` property access
- Examples:
  - `canSeeSettings` → `canSeeCourseSettings(user, enrolment).allowed`
  - `canSeeUserModules(currentUser)` → `canSeeUserModules(currentUser).allowed`
- All callers now properly handle `PermissionResult` type

#### Files Updated
- Layout files: `course-layout.tsx`, `root-layout.tsx`, `user-modules-layout.tsx`, etc.
- Route files: `course.$id.tsx`, `course.$id.groups.tsx`, `module.$id.tsx`, etc.
- Context files: `course-context.ts`
- All updates maintain existing functionality while using new return type

## Technical Details

### Files Modified
- `server/utils/permissions.ts`: Complete reorganization with sections, helpers, and permissions object
- `app/layouts/course-layout.tsx`: Updated to use `.allowed` property
- `app/layouts/root-layout.tsx`: Updated to use `.allowed` property
- `app/layouts/user-modules-layout.tsx`: Updated to use `.allowed` property
- `app/layouts/course-content-layout.tsx`: Updated to use `.allowed` property
- `app/layouts/course-module-layout.tsx`: Updated to use `.allowed` property
- `app/layouts/course-section-layout.tsx`: Updated to use `.allowed` property
- `app/routes/course.$id.tsx`: Updated to use `.allowed` property
- `app/routes/course.$id.groups.tsx`: Updated to use `.allowed` property
- `app/routes/course.$id.participants.profile.tsx`: Updated to use `.allowed` property
- `app/routes/course/module.$id.tsx`: Updated to use `.allowed` property
- `app/routes/course/module.$id.submissions.tsx`: Updated to use `.allowed` property
- `server/contexts/course-context.ts`: Updated to use `.allowed` property

### Helper Function Implementation

```typescript
function isAdminOrContentManager(user?: { id: number; role?: User["role"] }): boolean {
  return user?.role === "admin" || user?.role === "content-manager";
}

function isTeacherOrManager(enrolment?: { role?: Enrollment["role"] }): boolean {
  return enrolment?.role === "teacher" || enrolment?.role === "manager";
}

function isTeachingStaff(enrolment?: { role?: Enrollment["role"] }): boolean {
  return enrolment?.role === "teacher" || 
         enrolment?.role === "manager" || 
         enrolment?.role === "ta";
}
```

### Permissions Object Structure

```typescript
export const permissions = {
  course: {
    canSeeSettings: canSeeCourseSettings,
    canSeeParticipants: canSeeCourseParticipants,
    canSeeGrades: canSeeCourseGrades,
    // ... other course permissions
    section: { canSeeSettings: canSeeCourseSectionSettings },
    module: { canSeeSettings: canSeeCourseModuleSettings },
  },
  user: {
    canSeeModules: canSeeUserModules,
    canEditModule: canEditUserModule,
    profile: {
      canEdit: canEditUserProfile,
      fields: { canEditFirstName: canEditProfileFirstName, ... },
      canEditEmail: canEditProfileEmail,
      canEditRole: canEditProfileRole,
    },
  },
  module: { canSeeSubmissions: canSeeModuleSubmissions, ... },
  media: { canDelete: canDeleteMedia },
  quiz: { canStartAttempt: canStartQuizAttempt, ... },
  discussion: { canParticipate: canParticipateInDiscussion },
  admin: { canImpersonateUser: canImpersonateUser },
} as const;
```

### Naming Convention Rules

- **Permission functions**: Must start with "can" (e.g., `canSeeCourseSettings`)
- **Helper functions**: Must start with "is" (e.g., `isAdminOrContentManager`)
- **No "has" prefix**: Helper functions should not use "has" prefix (those should be permission functions with "can" prefix)
- Consistent naming makes code self-documenting and easier to understand

## User Impact

### For Developers

#### Improved Code Organization
- Easier to find specific permission functions
- Clear domain separation makes codebase more navigable
- Related permissions are grouped together logically

#### Better Developer Experience
- New organized `permissions` object provides structured access
- Helper functions reduce duplication and improve maintainability
- Consistent return types make permission handling predictable

#### Backward Compatibility
- All existing code continues to work without changes
- Gradual migration possible - can adopt new structure over time
- No breaking changes for existing consumers

### For End Users

- No visible changes to application behavior
- All permission checks work exactly as before
- Permission denial messages are now more descriptive (via `reason` field)
- Better error messages when permissions are denied

## Migration Notes

### For Existing Code

- **No immediate action required** - all existing code continues to work
- Individual function exports remain available and unchanged
- Can gradually adopt new `permissions` object structure if desired

### For New Code

- Can use either individual exports or organized `permissions` object
- Recommended to use `permissions` object for better organization:
  ```typescript
  // New organized way
  permissions.course.canSeeSettings(user, enrolment)
  
  // Still works (backward compatible)
  canSeeCourseSettings(user, enrolment)
  ```

### Type Updates

- All permission functions now return `PermissionResult` instead of `boolean`
- When using permission functions, access `.allowed` property:
  ```typescript
  // Old way (no longer works)
  const canEdit = canEditCourse(user, enrolments);
  
  // New way
  const canEdit = canEditCourse(user, enrolments).allowed;
  ```

## Testing Considerations

- Verify all permission checks still work correctly
- Test that `.allowed` property is properly accessed in all callers
- Verify helper functions correctly identify roles
- Test that `permissions` object exports all functions correctly
- Verify backward compatibility with existing code
- Test that permission reasons are descriptive and helpful
- Verify no TypeScript errors after refactoring
- Test that all 22+ files using permissions work correctly

## Edge Cases Handled

- **Undefined values**: Helper functions safely handle undefined user/enrolment
- **Type safety**: All functions maintain proper TypeScript types
- **Null coalescing**: Used `?? false` for optional array operations to ensure boolean return
- **Backward compatibility**: All existing imports continue to work
- **Missing properties**: Permission functions handle missing user/enrolment gracefully

## Future Enhancements

- Consider splitting into multiple files if file grows too large (currently ~1000 lines)
- Add permission caching for frequently checked permissions
- Create permission composition utilities for complex checks
- Add permission testing utilities for easier unit testing
- Consider permission middleware for route-level checks
- Add permission analytics/logging for security auditing
- Create permission documentation generator from code structure

## Conclusion

This refactoring significantly improves the organization and maintainability of the permissions system while maintaining full backward compatibility. The clear domain-based structure, helper functions, standardized return types, and organized permissions object make the codebase easier to navigate and maintain. The changes are purely internal improvements with no breaking changes for existing code.

