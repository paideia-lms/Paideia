<!-- 6e9d9567-888c-41ba-8a97-83092ba2ab29 52dbf2de-6c31-4a4e-8caf-c8a67ac7afe0 -->
# User Impersonation System

## Overview

Implement admin user impersonation functionality that allows admins to view the system as another user. The impersonation state will be stored in a cookie and validated in the root middleware.

## Implementation Steps

### 1. Update User Context Type

**File: `server/contexts/user-context.ts`**

Update the `UserSession` interface to properly store authentication and impersonation data:

- Store the authenticated user (the admin who is impersonating)
- Store the effective user (the user being impersonated, if any)
- Store permissions for the effective user
- Add `isImpersonating` boolean flag
- Remove `impersonatedBy` field (not needed since we track the real admin separately)
```typescript
export interface UserSession {
  authenticatedUser: User;  // The actual logged-in user (admin)
  effectiveUser: User;       // The user being impersonated, or same as authenticatedUser
  authenticatedUserPermissions: string[];  // Permissions for authenticatedUser (admin's real permissions)
  effectiveUserPermissions: string[];      // Permissions for effectiveUser (impersonated user's permissions)
  isImpersonating: boolean;  // true when admin is viewing as another user
  isAuthenticated: boolean;
}
```


### 2. Add Impersonation Cookie Utilities

**File: `app/utils/cookie.ts`**

Add two new functions:

- `setImpersonationCookie(userId: number, ...)` - Creates a cookie storing the impersonated user ID
- `removeImpersonationCookie(...)` - Clears the impersonation cookie

Use the same pattern as existing `setCookie`/`removeCookie` functions. Cookie name: `${payload.config.cookiePrefix}-impersonate`.

### 3. Update Root Middleware

**File: `app/root.tsx`**

Modify the middleware function (lines 31-45) to:

1. Call `payload.auth()` to get the authenticated user
2. Check for impersonation cookie using `parseCookies()` from Payload
3. If cookie exists AND authenticated user is admin:

   - Fetch the target user using `tryFindUserById`
   - Call `getAccessResults({ req: { user: targetUser, payload } })` to get target user's permissions
   - Set context with `isImpersonating: true`, `authenticatedUser` = admin, `effectiveUser` = target user

4. If no impersonation or not admin:

   - Set context with regular user, `isImpersonating: false`, both users are the same

5. Handle cookie validation errors (invalid user ID, user not found, etc.) by clearing the cookie

### 4. Create Impersonation Actions

**File: `app/routes/user/profile.tsx`**

Add a new server action to handle starting impersonation:

- Create a new action handler that accepts "START_IMPERSONATE" method (or use POST with intent field)
- Verify current user is admin
- Get target userId from formData
- Validate target user exists and is not an admin (rule 2.b)
- Return redirect with `setImpersonationCookie()` in headers

Add action to stop impersonation:

- Accept "STOP_IMPERSONATE" method
- Return redirect with `removeImpersonationCookie()` in headers

Update the existing action to handle both DELETE (existing) and the new impersonation actions. Use a `switch` on request method or add an "intent" form field.

### 5. Add Impersonation UI to Profile Page

**File: `app/routes/user/profile.tsx`**

In the loader (lines 37-123):

- Pass `currentUser` role to determine if impersonation button should show
- Add logic: show "Impersonate User" button if:
  - Current user is admin
  - Profile being viewed is NOT the current user
  - Profile being viewed is NOT an admin

In the component (lines 193-429):

- Add impersonation button near "Edit Profile" button
- Use `fetcher.submit()` with method POST and intent="impersonate"
- Style it distinctly (maybe warning color)

Add "Stop Impersonating" banner at the top of the page:

- Show when `loaderData.isImpersonating` is true
- Include original admin name and button to stop impersonation
- Make it prominent (maybe use Mantine's `Alert` component with warning color)
- Use `fetcher.submit()` with intent="stop-impersonate"

### 6. Update All Route Loaders Using Auth

**Files: Various route files**

Update route loaders that use `payload.auth()` to instead use `context.get(userContext)`:

- `app/routes/user/profile.tsx` - Use effectiveUser instead of calling payload.auth
- Other route files may need similar updates (check codebase)

The middleware already sets the user context, so routes should consume it instead of re-authenticating.

## Key Technical Details

- **Cookie-based**: Impersonation state stored in HTTP-only cookie (secure, not accessible via JS)
- **Admin-only**: Only users with `role === "admin"` can impersonate
- **No admin impersonation**: Admins cannot impersonate other admins
- **Permission isolation**: Impersonated user's permissions are fetched via `getAccessResults()`
- **Middleware-level**: All auth logic centralized in root middleware
- **Fail-safe**: Invalid cookies are silently cleared and ignored

### To-dos

- [ ] Update UserSession interface in server/contexts/user-context.ts with authenticatedUser, effectiveUser, and isImpersonating fields
- [ ] Add setImpersonationCookie and removeImpersonationCookie functions to app/utils/cookie.ts
- [ ] Modify root middleware in app/root.tsx to check impersonation cookie and set appropriate user context
- [ ] Add server actions in app/routes/user/profile.tsx to start and stop impersonation
- [ ] Add impersonation button and stop-impersonating banner to profile page UI
- [ ] Update profile loader to use context.get(userContext) instead of payload.auth()