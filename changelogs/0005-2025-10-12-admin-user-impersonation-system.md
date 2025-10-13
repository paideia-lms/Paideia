# Admin User Impersonation System

**Date:** October 12, 2025

## Overview

Implemented a comprehensive admin user impersonation system that allows administrators to view and interact with the system as another user. This feature enables admins to troubleshoot user issues, provide support, and understand user experiences while maintaining security through proper access controls and audit trails.

## Changes

### User Context Updates

#### `server/contexts/user-context.ts`
Updated the `UserSession` interface to support impersonation:

```typescript
export interface UserSession {
  authenticatedUser: User;  // The actual logged-in user (admin)
  effectiveUser: User | null;       // The user being impersonated, or null when not impersonating
  authenticatedUserPermissions: string[];  // Permissions for authenticatedUser (admin's real permissions)
  effectiveUserPermissions: string[] | null;      // Permissions for effectiveUser, or null when not impersonating
  isImpersonating: boolean;  // true when admin is viewing as another user
  isAuthenticated: boolean;
}
```

Key improvements:
- **Dual user tracking**: Separates the authenticated admin from the effective user being impersonated
- **Permission isolation**: Stores both admin's real permissions and impersonated user's permissions
- **Null optimization**: `effectiveUser` and `effectiveUserPermissions` are `null` when not impersonating to avoid duplication
- **Type safety**: Updated `User` interface to include all possible role types from Payload CMS

### Cookie Management

#### `app/utils/cookie.ts`
Added secure cookie management for impersonation state:

#### `setImpersonationCookie`
- Creates HTTP-only, secure cookie storing the impersonated user ID
- Cookie name: `${payload.config.cookiePrefix}-impersonate`
- 24-hour expiration with site-wide availability (`path: "/"`)
- Proper domain handling for localhost and production environments

#### `removeImpersonationCookie`
- Safely removes impersonation cookie
- Sets expiration to past date to ensure immediate removal
- Maintains same security settings as creation

### Middleware Implementation

#### `app/root.tsx`
Refactored root middleware to handle impersonation logic:

**Key Features:**
- **Centralized authentication**: Single source of truth for user context
- **Impersonation validation**: Checks cookie and validates admin permissions
- **Fail-safe design**: Invalid cookies are silently cleared
- **Reduced nesting**: Extracted impersonation logic to reduce complexity
- **Performance optimization**: Only sets user context when authenticated

**Security Measures:**
- Only users with `role === "admin"` can impersonate
- Admins cannot impersonate other admins
- Invalid user IDs or non-existent users are handled gracefully
- Cookie validation errors result in automatic cleanup

### User Management Functions

#### `server/internal/user-management.ts`
Added `tryHandleImpersonation` function with comprehensive error handling:

```typescript
export interface HandleImpersonationArgs {
  payload: Payload;
  impersonateUserId: string;
  authenticatedUser: User;
}

export interface ImpersonationResult {
  targetUser: User;
  permissions: string[];
}
```

**Features:**
- **User validation**: Verifies target user exists and is not an admin
- **Permission fetching**: Uses `getAccessResults()` to get impersonated user's permissions
- **Error handling**: Comprehensive error transformation using `Result.wrap`
- **Type safety**: Proper TypeScript interfaces for all parameters and return values

### Profile Page Integration

#### `app/routes/user/profile.tsx`
Enhanced profile page with impersonation capabilities:

**Server Actions:**
- **`impersonate`**: Starts impersonation session with validation
- **`stop-impersonate`**: Ends impersonation and redirects to admin's profile
- **Security checks**: Validates admin permissions and target user eligibility

**UI Components:**
- **Impersonation banner**: Prominent alert when impersonating with admin context
- **Impersonate button**: Shows only for admins viewing non-admin profiles
- **Stop impersonation**: Quick action to end impersonation session
- **Smart visibility**: Hides impersonate button when already impersonating

**Loader Updates:**
- Uses `userContext` instead of direct `payload.auth()` calls
- Implements effective user logic (`effectiveUser || authenticatedUser`)
- Passes impersonation state to UI components

### Testing

#### `server/internal/user-management.test.ts`
Added comprehensive test suite for impersonation functionality:

**Test Coverage:**
- ✅ Admin successfully impersonating a student
- ❌ Admin attempting to impersonate another admin (security boundary)
- ❌ Invalid user ID handling
- ❌ Non-existent user ID handling
- ✅ Proper permission fetching for impersonated user
- ✅ Error handling and cleanup

**Test Structure:**
- Proper setup/teardown with test users
- Database refresh using `beforeAll` hook
- Single `describe` block as per project standards
- Uses Payload local API without mocking

## Security Features

### Access Control Matrix

| Scenario | Can Impersonate | Target User | Result |
|----------|----------------|-------------|---------|
| Admin → Student | ✅ | Non-admin | Success |
| Admin → Admin | ❌ | Admin | Blocked |
| Student → Anyone | ❌ | Any | Blocked |
| Invalid User ID | ❌ | N/A | Graceful failure |

### Cookie Security

- **HTTP-only**: Prevents JavaScript access
- **Secure**: HTTPS-only transmission
- **SameSite**: Strict CSRF protection
- **Path**: Site-wide availability (`/`)
- **Domain**: Proper localhost/production handling

### Permission Isolation

- **Admin permissions**: Preserved in `authenticatedUserPermissions`
- **Effective permissions**: Impersonated user's permissions in `effectiveUserPermissions`
- **No privilege escalation**: Impersonated user cannot access admin functions
- **Audit trail**: Clear distinction between real admin and effective user

## User Experience

### Admin Workflow

1. **Start Impersonation**: Admin views user profile → clicks "Impersonate User"
2. **Impersonation Active**: System shows banner with admin context and stop button
3. **End Impersonation**: Admin clicks "Stop Impersonating" → redirected to their profile

### UI States

**Not Impersonating:**
- Shows "Impersonate User" button for eligible profiles
- No impersonation banner
- Normal user interface

**Impersonating:**
- Hides "Impersonate User" button
- Shows prominent impersonation banner
- Clear indication of current effective user and real admin

## Technical Implementation

### Cookie Path Fix

**Issue**: Impersonation cookie was only visible on `/user/profile/:id` but not on root path `/`

**Solution**: Added `path: "/"` to cookie configuration ensuring site-wide availability

### Middleware Optimization

**Before**: 4 levels of nested `if` statements
**After**: Extracted impersonation logic to separate function with early returns

### Type Safety Improvements

- Eliminated `null as any` type assertions
- Proper `PayloadUser` type usage
- Comprehensive error handling with `Result.wrap`
- Nullable fields for non-impersonation state

## Migration Notes

- **No database changes**: Uses existing user and permission systems
- **Backward compatible**: Existing functionality unchanged
- **Cookie-based**: No persistent storage required
- **Automatic cleanup**: Invalid cookies are automatically removed

## Breaking Changes

None. This is a purely additive feature that enhances admin capabilities without affecting existing user workflows.

## Future Enhancements

Potential improvements for future iterations:
- **Impersonation logs**: Audit trail of impersonation sessions
- **Time limits**: Automatic session expiration
- **Bulk operations**: Impersonate multiple users for testing
- **Notification system**: Alert users when being impersonated
- **Advanced permissions**: Role-specific impersonation rules
- **Session management**: Multiple concurrent impersonation sessions

## Dependencies

- **Payload CMS**: Authentication and user management
- **React Router**: Server actions and navigation
- **Mantine UI**: Alert and button components
- **TypeScript Result**: Error handling and type safety
