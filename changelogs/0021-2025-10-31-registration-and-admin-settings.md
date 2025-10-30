# Changelog 0021: Registration Page and Admin Registration Settings

**Date**: October 30, 2025  
**Type**: Feature Addition  
**Impact**: High ? Replaces first-user-only registration flow with unified public registration system and adds administrative controls

## Overview

Implemented a comprehensive public registration system that replaces the first-user-only registration flow. The system includes a unified registration page accessible at all times, admin-configurable registration settings, and integration with the homepage to conditionally display registration CTAs. This feature provides administrators with granular control over user registration while maintaining backward compatibility with first-user setup workflows.

## Features

### 1. Public Registration Page

Created a unified registration page (`/registration`) that handles both first-user setup and regular user registration:

- **Dual-purpose functionality**: Automatically detects if no users exist and grants admin role to the first user with a prominent notice
- **Registration form**: Mantine uncontrolled form with fields for email, password, confirm password, first name, and last name
- **Form validation**: Client-side validation using Mantine form validators (email format, password length ? 8 characters, password confirmation match)
- **Server-side validation**: Zod schema validation in the action handler for additional security
- **Auto-login**: Automatically logs in newly registered users and redirects to homepage
- **Dev convenience**: Development-only auto-fill button for quick testing
- **Cross-linking**: Shows link to login page (hidden when registration is disabled)

**Route**: `/registration`

### 2. Admin Registration Settings Page

Implemented an admin-controlled settings page for managing registration behavior:

- **Location**: `/admin/registration` under the General tab in server admin layout
- **Settings controls**:
  - `disableRegistration`: Boolean toggle to completely disable public registration (first-user creation still allowed)
  - `showRegistrationButton`: Boolean toggle to show/hide the Register CTA button on the homepage
- **Conditional UI**: `showRegistrationButton` switch only appears when `disableRegistration` is false
- **Real-time updates**: Settings saved via form submission with success/error notifications
- **Access control**: Requires admin role, uses `overrideAccess: false` for proper permission checks

### 3. Registration Settings Global

Introduced a new Payload global collection for storing registration configuration:

- **Slug**: `registration-settings`
- **Fields**:
  - `disableRegistration`: Boolean (default: `false`) - Controls whether public registration is allowed
  - `showRegistrationButton`: Boolean (default: `true`) - Controls visibility of registration CTA on homepage
- **Database table**: `registration_settings` with standard Payload global fields (id, created_at, updated_at)
- **Migration**: Non-breaking database migration created to add the new table

### 4. Registration Settings Helper

Created an internal helper function for consistent registration settings access:

- **Function**: `tryGetRegistrationSettings` in `server/internal/registration-settings.ts`
- **Pattern**: Uses TypeScript Result pattern with `Result.wrap` for error handling
- **Validation**: Zod schema validation with sensible defaults when fields are unset
- **Flexibility**: Supports `overrideAccess` parameter for system-level reads (bypassing access control)
- **Default values**: Returns `{ disableRegistration: false, showRegistrationButton: true }` when global is unset or partially configured

### 5. Regular User Registration Function

Added a new registration function for non-admin user creation:

- **Function**: `tryRegisterUser` in `server/internal/user-management.ts`
- **Role assignment**: Automatically assigns `role: "student"` to new users
- **User creation**: Creates user with email, password, firstName, lastName, and default theme
- **Auto-login**: Automatically logs in the newly created user after registration
- **Return value**: Returns authentication token and expiration for cookie setting
- **Error handling**: Uses Result pattern, checks for existing users with same email

### 6. First-User Registration Bypass

Enhanced registration logic to always allow first-user creation:

- **Bypass mechanism**: `disableRegistration` setting is ignored when creating the first user
- **Visual feedback**: Shows prominent alert when registering as first user indicating admin access will be granted
- **Security**: Ensures system can always be initialized even if registration is disabled

### 7. Homepage Registration CTA

Integrated registration settings with homepage to conditionally display registration button:

- **Visibility control**: Register CTA button shown/hidden based on `showRegistrationButton` setting
- **Additional logic**: Button is automatically hidden if `disableRegistration` is true (regardless of `showRegistrationButton`)
- **Loader integration**: Fetches registration settings in homepage loader for public users

### 8. Login Page Cross-Linking

Added cross-navigation between login and registration pages:

- **Conditional display**: Link to registration page shown only when registration is not disabled
- **Settings-aware**: Loader fetches registration settings to determine link visibility
- **User experience**: Provides easy navigation between authentication pages

### 9. Route Consolidation

Replaced first-user-specific route with unified registration route:

- **Removed**: `app/routes/first-user.tsx` route and file
- **Added**: `app/routes/registration.tsx` route
- **Updated**: All references to `/first-user` changed to `/registration`
- **Redirect logic**: Root redirect for zero users now points to `/registration`

### 10. Page Info Flags

Extended page info system to track registration-related pages:

- **New flags**: Added `isRegistration` and `isAdminRegistration` to `PageInfo` type
- **Route detection**: Middleware detects registration routes and sets appropriate flags
- **Usage**: Enables conditional rendering and navigation logic based on current page

## Technical Implementation

### New Files

#### `app/routes/registration.tsx`

Main registration page component with comprehensive functionality:

- **Loader**:
  - Checks if user is authenticated and redirects to homepage if so
  - Determines if this is first-user registration by checking user count
  - Fetches registration settings using `tryGetRegistrationSettings` with `overrideAccess: true` for system-level read
  - Throws `ForbiddenResponse` if registration is disabled (except for first user)
  - Returns `NODE_ENV`, `DEV_CONSTANTS`, `isFirstUser`, and `registrationDisabled` flags

- **Action**:
  - Validates request data using Zod schema (`formSchema`)
  - Determines if first-user registration by checking user count
  - Respects `disableRegistration` setting (except for first user)
  - Calls `tryRegisterFirstUser` for first user or `tryRegisterUser` for regular users
  - Sets authentication cookie and redirects to homepage on success
  - Returns `badRequest` with error message on validation/registration failure

- **Client Action**:
  - Shows success notification on successful registration
  - Shows error notification on registration failure

- **Component**:
  - Displays registration form in centered container
  - Shows alert when registering as first user
  - Renders `RegistrationClient` component with form
  - Conditionally shows link to login page

- **RegistrationClient Component**:
  - Mantine uncontrolled form with validation
  - Fields: email, firstName, lastName, password, confirmPassword
  - Dev-only auto-fill button
  - Form submission via fetcher

#### `app/routes/admin/registration.tsx`

Admin settings page for registration configuration:

- **Loader**:
  - Requires authentication and admin role
  - Fetches current registration settings global
  - Returns settings object

- **Action**:
  - Requires authentication and admin role
  - Validates input using Zod schema with boolean coercion
  - Updates registration settings global
  - Returns updated settings

- **Client Action**:
  - Shows success notification on update
  - Shows error notification on failure

- **Component**:
  - Mantine uncontrolled form with switches
  - `disableRegistration` switch (always visible)
  - `showRegistrationButton` switch (only visible when registration is not disabled)
  - Save button with loading state

- **Custom Hook**: `useUpdateRegistrationConfig`
  - Encapsulates fetcher logic for settings updates
  - Provides `update` function and loading state

#### `server/internal/registration-settings.ts`

Internal helper for registration settings access:

- **Type definitions**:
  - `GetRegistrationSettingsArgs`: Interface for function arguments
  - `RegistrationSettings`: Type for settings return value

- **Schema validation**:
  - Zod schema with optional boolean fields
  - Provides default values when fields are undefined

- **Function**: `tryGetRegistrationSettings`
  - Uses `Result.wrap` for error handling (no try/catch)
  - Fetches global using Payload API
  - Validates and parses global data
  - Returns sensible defaults when validation fails
  - Supports `overrideAccess` parameter

#### `src/migrations/20251030_202017.ts`

Database migration for registration settings global:

- **Up migration**:
  - Creates `registration_settings` table
  - Fields: `id` (serial PRIMARY KEY), `disable_registration` (boolean, default: false), `show_registration_button` (boolean, default: true), `updated_at`, `created_at` (timestamps)

- **Down migration**:
  - Drops `registration_settings` table with CASCADE

### Modified Files

#### `app/routes.ts`

Route configuration updates:

- **Removed**: `route("first-user", "routes/first-user.tsx")`
- **Added**: `route("registration", "routes/registration.tsx")`
- **Added**: `route("admin/registration", "routes/admin/registration.tsx")` within server admin layout

#### `app/routes/login.tsx`

Login page enhancements:

- **Loader updates**:
  - Added call to `tryGetRegistrationSettings` with `overrideAccess: true`
  - Returns `registrationDisabled` flag in loader data
  - Handles error case by throwing `ForbiddenResponse`

- **Component updates**:
  - Conditionally renders "Create an account" link based on `registrationDisabled`
  - Link navigates to `/registration` route

#### `app/routes/index.tsx`

Homepage registration CTA integration:

- **Loader updates** (for unauthenticated users):
  - Fetches registration settings global directly using `payload.findGlobal`
  - Determines `showRegistrationButton` value
  - Automatically sets to `false` if `disableRegistration` is true
  - Returns `showRegistrationButton` in loader data

- **Component updates**:
  - Conditionally renders Register button based on `showRegistrationButton`
  - Button links to `/registration` route

#### `app/root.tsx`

Root middleware and redirect logic:

- **Page info updates**:
  - Added `isRegistration` and `isAdminRegistration` boolean flags
  - Route detection logic sets flags when registration routes are matched
  - Flags added to pageInfo object passed to context

- **Redirect logic**:
  - Changed redirect target from `/first-user` to `/registration` when no users exist
  - Redirect occurs before essential routes check to allow registration access

#### `app/layouts/server-admin-layout.tsx`

Admin layout tab detection:

- **Tab detection**:
  - Added check for `pageInfo.isAdminRegistration`
  - Returns `AdminTab.General` when on registration settings page
  - Ensures proper tab highlighting in admin navigation

#### `server/collections/globals.ts`

Global collection definitions:

- **New global**: `RegistrationSettings`
  - Slug: `"registration-settings"`
  - Fields:
    - `disableRegistration`: checkbox with default `false`
    - `showRegistrationButton`: checkbox with default `true`

#### `server/payload.config.ts`

Payload configuration:

- **Global registration**:
  - Added `RegistrationSettings` to `globals` array
  - Imported from `./collections/globals`

#### `server/internal/user-management.ts`

User management functions:

- **New function**: `tryRegisterUser`
  - Interface: `RegisterUserArgs` with email, password, firstName, lastName, req, user, overrideAccess
  - Implementation:
    - Checks for existing user with same email (returns error if found)
    - Creates user with `role: "student"` and `theme: "light"`
    - Automatically logs in new user via `payload.login()`
    - Handles avatar extraction and assertion
    - Returns token, expiration, and user object
  - Error handling: Uses `Result.wrap` with `transformError` fallback to `UnknownError`

#### `server/contexts/global-context.ts`

Global context type definitions:

- **PageInfo type**:
  - Added `isRegistration: boolean` field
  - Added `isAdminRegistration: boolean` field

#### `server/index.ts`

Server initialization:

- **Default pageInfo**:
  - Initialized `isRegistration: false` and `isAdminRegistration: false` in default pageInfo object

#### `src/migrations/index.ts`

Migration exports:

- **Migration registration**: Added `20251030_202017` migration to exports array

## Usage Examples

### Registering as First User

1. Navigate to the application when no users exist
2. Automatically redirected to `/registration`
3. See alert: "You are creating the first account. It will be granted admin access."
4. Fill in registration form (email, password, first name, last name)
5. Submit form
6. Automatically logged in and redirected to homepage as admin

### Registering as Regular User

1. Navigate to `/registration` (or click Register button on homepage)
2. Fill in registration form (email, password, first name, last name)
3. Submit form
4. Automatically logged in and redirected to homepage as student

### Configuring Registration Settings (Admin)

1. Log in as admin user
2. Navigate to Admin ? General ? Registration
3. Toggle "Disable Self-Registration" to disable public registration
4. Toggle "Show Registration Button" to control homepage CTA visibility
5. Click "Save changes"
6. See success notification confirming settings update

### Homepage Registration Flow

1. Visit homepage as unauthenticated user
2. See Register button if `showRegistrationButton` is true and `disableRegistration` is false
3. Click Register button
4. Navigate to `/registration` page
5. Complete registration form

### Access Control Behavior

- **Public registration page**: Accessible to everyone when `disableRegistration` is false (or when no users exist)
- **Disabled registration**: Returns `ForbiddenResponse` when `disableRegistration` is true and not first user
- **Admin settings**: Requires admin role, throws `ForbiddenResponse` for non-admin users
- **Settings reading**: Uses `overrideAccess: true` for system-level reads in public pages, `overrideAccess: false` for user context

## Benefits

1. **Unified Experience**: Single registration page handles both first-user setup and regular registration, reducing code duplication
2. **Administrative Control**: Admins can control registration availability and UI visibility through settings
3. **Security**: Server-side validation and access control prevent unauthorized registration
4. **Flexibility**: Settings can be changed without code deployment, allowing runtime configuration
5. **User-Friendly**: Clear messaging for first-user scenario and seamless auto-login after registration
6. **Type-Safe**: TypeScript Result pattern ensures proper error handling throughout
7. **Maintainable**: Centralized settings helper and consistent patterns across codebase
8. **Backward Compatible**: Migration is non-breaking and preserves existing functionality

## Breaking Changes

**Route Change**: The `/first-user` route has been removed and replaced with `/registration`. Any bookmarks or external links to `/first-user` will need to be updated to `/registration`. However, the system automatically redirects to `/registration` when no users exist, so the impact is minimal.

## Migration Guide

### Database Migration

Run the migration to create the registration settings table:

```bash
bun run payload migrate
```

This will create the `registration_settings` table with default values (`disableRegistration: false`, `showRegistrationButton: true`).

### Code Updates

No code changes required for existing features. The registration settings global will use default values until explicitly configured by an admin.

### Configuration

After migration, admins can configure registration settings via:
1. Navigate to Admin ? General ? Registration
2. Adjust settings as needed
3. Save changes

## Related Features

- User Authentication System (Login/Logout)
- Admin User Management
- First User Setup Flow (replaced by this feature)
- Global Settings System
- Page Info and Route Detection System

## Testing Checklist

- [x] First user registration creates admin user successfully
- [x] First user registration shows admin access notice
- [x] Regular user registration creates student user successfully
- [x] Registration form validation works (email format, password length, confirmation match)
- [x] Registration redirects authenticated users to homepage
- [x] Registration page respects `disableRegistration` setting (except first user)
- [x] Registration action validates input with Zod schema
- [x] Registration automatically logs in new users
- [x] Admin registration settings page loads for admin users
- [x] Admin registration settings page blocks non-admin users
- [x] Admin can update `disableRegistration` setting
- [x] Admin can update `showRegistrationButton` setting
- [x] `showRegistrationButton` switch hidden when `disableRegistration` is true
- [x] Settings update shows success notification
- [x] Homepage shows Register button when enabled
- [x] Homepage hides Register button when disabled
- [x] Login page shows registration link when enabled
- [x] Login page hides registration link when disabled
- [x] Page info flags (`isRegistration`, `isAdminRegistration`) set correctly
- [x] Root redirect works for zero users (redirects to `/registration`)
- [x] Admin layout tab detection works for registration settings page
- [x] Database migration creates table correctly
- [x] Migration rollback works correctly
- [x] `tryGetRegistrationSettings` returns defaults when global is unset
- [x] `tryGetRegistrationSettings` supports `overrideAccess` parameter
- [x] `tryRegisterUser` checks for existing email
- [x] `tryRegisterUser` assigns student role
- [x] `tryRegisterUser` auto-logs in user`
- [x] Error handling uses Result pattern (no try/catch in internal functions)
- [x] Forms use Mantine uncontrolled mode (no cascadeUpdates)
- [x] No Tailwind classes used
- [x] No linter errors

## Future Enhancements

- Add email verification requirement option to registration settings
- Implement invitation-only registration mode
- Add registration analytics (number of registrations per day/week)
- Support for custom registration fields via settings
- Add registration approval workflow for admin review
- Implement rate limiting for registration attempts
- Add CAPTCHA integration option
- Support for social login providers
- Registration email notifications to admins
- Custom registration success redirect URL setting
