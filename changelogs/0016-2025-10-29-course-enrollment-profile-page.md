# Changelog 0016: Course Enrollment Profile Page

**Date**: October 29, 2025

## Overview

Implemented a course enrollment profile page within the course participants layout that displays user profile information alongside their enrollment details in the course context. This feature provides administrators and instructors with a dedicated interface to view enrolled user profiles and manage impersonation within the course context.

## Features

### 1. Course Enrollment Profile Page

Created a new profile page accessible within the course participants layout that shows:
- User avatar and basic information
- Enrollment details (role, status, groups)
- Enrollment and completion dates
- Admin impersonation capabilities (when applicable)

**Route**: `/course/:id/participants/profile?userId=<userId>`

### 2. Profile Tab in Participants Layout

Added a "Profile" tab to the course participants layout navigation, positioned between "Participants" and "Groups" tabs, providing quick access to the enrollment profile viewer.

### 3. User Selection via Query Parameters

Implemented server-side query parameter handling using `nuqs/server`:
- User selection is passed via `?userId=` query parameter
- Server-side parsing using `createLoader` and `parseAsInteger`
- Empty state displayed when no user is selected
- Dropdown to select from enrolled users

### 4. Permission-Based Impersonation

Enhanced impersonation functionality with proper permission checks:
- Created `canImpersonateUser` permission function in `permissions.ts`
- Server-side permission calculation prevents client-side manipulation
- Only admins can impersonate non-admin users
- Cannot impersonate yourself or when already impersonating
- Impersonation button shown only when permitted

### 5. Context-Aware Redirect After Impersonation

Improved user experience when stopping impersonation:
- Added `redirectTo` parameter to impersonation hooks
- When impersonating from course pages, redirects back to the course
- When stopping impersonation from course pages, stays in course context
- Uses route params from `pageInfo` for type-safe redirects

### 6. Global Context Enhancement

Enhanced the global context to include route params:
- Added `params` field to `PageInfo` type
- Params passed from middleware to all pages
- Type-safe param access using `RouteParams<RouteId>`
- Eliminates need for client-side URL parsing

## Technical Implementation

### New Files

#### `app/routes/course.$id.participants.profile.tsx`
Main profile page component with:
- Loader that validates course access and calculates impersonation permissions
- User selection dropdown populated with enrolled users
- Profile section displaying avatar, name, and email
- Enrollment details section showing role, status, groups, and dates
- Empty state when no user is selected
- Error boundary for proper error handling

### Modified Files

#### `app/routes.ts`
- Added profile route within `course-participants-layout`

#### `app/layouts/course-participants-layout.tsx`
- Added "Profile" to `ParticipantsTab` enum
- Updated tab detection and navigation logic
- Added Profile tab to UI

#### `app/routes/user/profile.tsx`
- Enhanced `useImpersonate` hook to accept optional `redirectTo` parameter
- Updated action to handle redirect URL from form data
- Maintains backward compatibility with default "/" redirect

#### `app/routes/api/stop-impersonation.tsx`
- Added `redirectTo` parameter support in action handler
- Updated `useStopImpersonating` hook to accept redirect URL
- Updated `StopImpersonatingButton` component with `redirectTo` prop
- Updated `StopImpersonatingMenuItem` component with `redirectTo` prop

#### `app/layouts/root-layout.tsx`
- Added `getStopImpersonationRedirect` function
- Detects if user is in course using `pageInfo.isInCourse`
- Extracts course ID from `pageInfo.params` using type-safe `RouteParams`
- Passes redirect URL to `StopImpersonatingMenuItem`

#### `server/utils/permissions.ts`
- Added `canImpersonateUser` permission function
- Validates authenticated user, target user, and impersonation state
- Follows existing permission function patterns

#### `server/contexts/global-context.ts`
- Added `params: Record<string, string>` to `PageInfo` type
- Provides access to route parameters in all components

#### `server/index.ts`
- Initialized `params: {}` in default pageInfo object

#### `app/root.tsx`
- Updated first middleware to accept `params` argument
- Passed params to pageInfo (cast as `Record<string, string>`)
- Enables type-safe route parameter access

## Usage Examples

### Accessing Enrollment Profile

1. Navigate to a course's participants page
2. Click the "Profile" tab
3. Select a user from the dropdown
4. View their profile and enrollment details

### Impersonating a User (Admin Only)

1. From the enrollment profile page, select a user
2. If permitted, the "Impersonate User" button appears
3. Click to impersonate and redirect to the course page
4. Stop impersonation returns to the same course

### Type-Safe Route Params

```typescript
// In any component with access to pageInfo
if (pageInfo.isInCourse) {
  const { id } = pageInfo.params as RouteParams<"layouts/course-layout">;
  // id is properly typed as string
  const courseUrl = href("/course/:id", { id });
}
```

## Benefits

1. **Context-Aware**: Profile information shown in the context of the course enrollment
2. **Type-Safe**: Server-side param handling and type-safe route params
3. **Secure**: Permission checks performed server-side
4. **User-Friendly**: Empty states, proper redirects, and intuitive navigation
5. **Maintainable**: Reusable hooks and permission functions
6. **Consistent**: Follows established patterns in the codebase

## Breaking Changes

None. All changes are additive and backward compatible.

## Migration Guide

No migration required. The new feature is immediately available to users with appropriate permissions.

## Related Features

- Admin User Impersonation System (Changelog 0005)
- Course Enrollment Management (Changelog 0006)
- Course Participants Layout

## Testing Checklist

- [x] Profile page loads correctly for enrolled users
- [x] User selection dropdown shows all enrolled users
- [x] Empty state displays when no user selected
- [x] Profile information displays correctly
- [x] Enrollment details (role, status, groups) render properly
- [x] Impersonation button shows only when permitted
- [x] Impersonation redirects to course page
- [x] Stop impersonation from course returns to course
- [x] Permission function works correctly
- [x] Type-safe route params work as expected
- [x] No linter errors
- [x] Error boundaries handle failures gracefully

## Future Enhancements

- Add activity history in enrollment profile
- Show submission statistics
- Display grade information
- Add course-specific notes for the user
- Support bulk user selection for batch operations

