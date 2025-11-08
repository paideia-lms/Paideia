# Changelog 0039: Maintenance Mode

**Date**: November 8, 2025  
**Type**: Feature Addition  
**Impact**: High - Adds system-wide maintenance mode for controlled access during maintenance periods

## Overview

Implemented a comprehensive maintenance mode feature that allows administrators to restrict system access during maintenance periods. When maintenance mode is enabled, only administrators can access the system, while all other users are blocked from logging in. The feature includes a dedicated admin page for managing maintenance mode, proper error handling to prevent infinite redirect loops, and a user-friendly error boundary for displaying maintenance messages.

## Features Added

### 1. Maintenance Settings Global

**Features**:
- Created `MaintenanceSettings` global collection in Payload CMS
- Single boolean field `maintenanceMode` to enable/disable maintenance mode
- Default value: `false` (maintenance mode disabled)
- Admin description explains the feature's purpose

**Implementation**:
- Added `MaintenanceSettings` to `server/collections/globals.ts`
- Field configuration:
  - `name`: "maintenanceMode"
  - `type`: "checkbox"
  - `label`: "Maintenance Mode"
  - `defaultValue`: false
  - Admin description: "When enabled, only administrators can access the system. All other users will be blocked from logging in."
- Registered in `server/payload.config.ts` globals array

**Benefits**:
- ✅ Simple boolean toggle for maintenance mode
- ✅ Persistent storage in database
- ✅ Easy to enable/disable via admin interface
- ✅ No code changes required to toggle maintenance mode

### 2. Maintenance Settings Internal Functions

**Features**:
- Created `tryGetMaintenanceSettings()` function to read maintenance settings
- Created `tryUpdateMaintenanceSettings()` function to update maintenance settings
- Follows TypeScript Result pattern for error handling
- Supports `overrideAccess` parameter for system-level reads

**Implementation**:
- Created `server/internal/maintenance-settings.ts`
- `tryGetMaintenanceSettings()`:
  - Fetches maintenance settings global from Payload
  - Validates and parses global data
  - Returns `Result<MaintenanceSettings>`
  - Supports `overrideAccess` for bypassing access control
- `tryUpdateMaintenanceSettings()`:
  - Updates maintenance settings global
  - Validates input data
  - Returns `Result<MaintenanceSettings>`
  - Requires proper user context for access control

**Benefits**:
- ✅ Reusable functions for maintenance settings access
- ✅ Consistent error handling using Result pattern
- ✅ Type-safe interfaces
- ✅ Supports both user and system-level access

### 3. Admin Maintenance Page

**Features**:
- Created admin page at `/admin/maintenance` for managing maintenance mode
- Switch control to enable/disable maintenance mode
- Real-time updates with success/error notifications
- Accessible only to administrators
- Located in Server tab of admin layout

**Implementation**:
- Created `app/routes/admin/maintenance.tsx`
- **Loader**:
  - Requires authentication and admin role
  - Fetches current maintenance settings
  - Returns settings object
- **Action**:
  - Requires authentication and admin role
  - Validates input using Zod schema
  - Updates maintenance settings global
  - Returns updated settings
- **Client Action**:
  - Shows success notification on update
  - Shows error notification on failure
- **Component**:
  - Mantine uncontrolled form with Switch control
  - Save button with loading state
  - Clear description of maintenance mode behavior
- **Error Boundary**:
  - Uses `DefaultErrorBoundary` for error display

**Benefits**:
- ✅ Easy-to-use interface for managing maintenance mode
- ✅ Clear visual feedback on status changes
- ✅ Secure access control (admin-only)
- ✅ Consistent with other admin settings pages

### 4. Maintenance Mode Middleware

**Features**:
- Added maintenance mode check in root middleware
- Blocks non-admin users when maintenance mode is enabled
- Allows access to login page and admin maintenance page
- Allows access to API routes
- Prevents infinite redirect loops

**Implementation**:
- Added middleware in `app/root.tsx` after user context is set
- Checks maintenance mode status using `tryGetMaintenanceSettings()`
- Logic:
  - If maintenance mode is disabled, allow all access
  - If maintenance mode is enabled:
    - Allow access to login page (`pageInfo.isLogin`)
    - Allow access to admin maintenance page (`pageInfo.isAdminMaintenance`)
    - Allow access to API routes (`pageInfo.isApi`)
    - Block non-admin users:
      - If already on root route (`pageInfo.isDashboard`), throw `MaintenanceModeResponse` error
      - Otherwise, redirect to root route
- Uses `overrideAccess: true` for system-level maintenance check

**Benefits**:
- ✅ System-wide access control
- ✅ Prevents infinite redirect loops
- ✅ Allows administrators to access maintenance page
- ✅ Allows users to access login page (for admin login)

### 5. Maintenance Mode Error Response

**Features**:
- Created `MaintenanceModeResponse` error response class
- Returns HTTP 503 (Service Unavailable) status
- Custom error message for maintenance mode
- Proper error handling in error boundaries

**Implementation**:
- Added `ServiceUnavailable: 503` to `StatusCode` enum in `app/utils/responses.ts`
- Created `MaintenanceModeResponse` class:
  - Extends `Response` class
  - Status: 503 (Service Unavailable)
  - Status text: "Service Unavailable"
  - Default message: "The system is currently under maintenance. Please try again later."
  - Customizable message via constructor

**Benefits**:
- ✅ Proper HTTP status code for maintenance mode
- ✅ Clear error messaging
- ✅ Consistent with HTTP standards
- ✅ Easy to handle in error boundaries

### 6. Root Error Boundary

**Features**:
- Created `RootErrorBoundary` component for displaying maintenance mode errors
- User-friendly maintenance message with icon and styling
- Link to login page for administrators
- Falls back to `DefaultErrorBoundary` for other errors
- Full HTML document structure for root-level errors

**Implementation**:
- Created `app/components/maintenance-mode-error-boundary.tsx`
- Renamed to `RootErrorBoundary` for clarity
- **Component Logic**:
  - Checks if error is maintenance mode error (503 status)
  - If maintenance mode error:
    - Displays maintenance message with icon
    - Shows alert with error message
    - Provides link to login page
    - Uses Mantine components for styling
  - If other error:
    - Falls back to `DefaultErrorBoundary`
- Added `ErrorBoundary` export to `app/root.tsx`:
  - Returns full HTML document structure
  - Includes Mantine provider and styles
  - Renders `RootErrorBoundary` component

**Benefits**:
- ✅ User-friendly error display
- ✅ Clear maintenance mode messaging
- ✅ Easy navigation to login page
- ✅ Handles both maintenance and other errors

### 7. Page Info Updates

**Features**:
- Added `isAdminMaintenance` flag to `PageInfo` type
- Route detection for maintenance page
- Proper tab categorization in admin layout

**Implementation**:
- Updated `server/contexts/global-context.ts`:
  - Added `isAdminMaintenance: boolean` to `PageInfo` type
- Updated `app/root.tsx` middleware:
  - Detects `routes/admin/maintenance` route
  - Sets `isAdminMaintenance` flag
- Updated `server/index.ts`:
  - Initializes `isAdminMaintenance: false` in default pageInfo
- Updated `app/layouts/server-admin-layout.tsx`:
  - Includes `isAdminMaintenance` in `AdminTab.Server` logic

**Benefits**:
- ✅ Proper route detection
- ✅ Correct tab highlighting in admin layout
- ✅ Consistent with other page info flags

### 8. Route Configuration

**Features**:
- Added `/admin/maintenance` route to routes configuration
- Added link to maintenance page in admin index
- Proper route organization

**Implementation**:
- Updated `app/routes.ts`:
  - Added `route("admin/maintenance", "routes/admin/maintenance.tsx")` within server admin layout
- Updated `app/routes/admin/index.tsx`:
  - Added "Maintenance mode" link in Server tab navigation
  - Uses `href()` utility for type-safe routing

**Benefits**:
- ✅ Easy navigation to maintenance page
- ✅ Consistent route organization
- ✅ Type-safe routing

## Technical Implementation

### Database Schema

**Maintenance Settings Global**:
- Table: `maintenance_settings` (created by Payload CMS)
- Fields:
  - `id`: Serial primary key
  - `maintenanceMode`: Boolean (default: false)
  - `created_at`: Timestamp
  - `updated_at`: Timestamp

### Error Handling Flow

**Maintenance Mode Check**:
1. Middleware checks maintenance mode status
2. If enabled and user is not admin:
   - If on root route: throw `MaintenanceModeResponse` error
   - Otherwise: redirect to root route
3. Root route error boundary catches `MaintenanceModeResponse`
4. `RootErrorBoundary` displays maintenance message

**Infinite Redirect Prevention**:
- Checks if already on root route (`pageInfo.isDashboard`)
- If on root route, throws error instead of redirecting
- Error boundary displays maintenance message
- Prevents redirect loop

### Access Control

**Allowed Routes During Maintenance**:
- `/login` - For administrators to log in
- `/admin/maintenance` - For administrators to disable maintenance mode
- `/api/*` - For API access (may be needed for system operations)

**Blocked Routes During Maintenance**:
- All other routes for non-admin users
- Root route (`/`) for non-admin users (shows maintenance message)

## Files Changed

### New Files

1. **`server/collections/globals.ts`** (updated)
   - Added `MaintenanceSettings` global configuration

2. **`server/internal/maintenance-settings.ts`**
   - `tryGetMaintenanceSettings()` function
   - `tryUpdateMaintenanceSettings()` function
   - Type definitions and interfaces

3. **`app/routes/admin/maintenance.tsx`**
   - Admin maintenance page component
   - Loader, action, and client action handlers
   - Error boundary

4. **`app/components/maintenance-mode-error-boundary.tsx`**
   - `RootErrorBoundary` component
   - Maintenance mode error display
   - Fallback to default error boundary

### Modified Files

1. **`server/payload.config.ts`**
   - Added `MaintenanceSettings` to globals array

2. **`app/root.tsx`**
   - Added maintenance mode middleware
   - Added `isAdminMaintenance` flag detection
   - Added `ErrorBoundary` export for root-level errors
   - Updated imports

3. **`server/contexts/global-context.ts`**
   - Added `isAdminMaintenance` to `PageInfo` type

4. **`server/index.ts`**
   - Initialized `isAdminMaintenance: false` in default pageInfo

5. **`app/routes.ts`**
   - Added `/admin/maintenance` route

6. **`app/layouts/server-admin-layout.tsx`**
   - Added `isAdminMaintenance` to `AdminTab.Server` logic

7. **`app/routes/admin/index.tsx`**
   - Added "Maintenance mode" link in Server tab

8. **`app/utils/responses.ts`**
   - Added `ServiceUnavailable: 503` status code
   - Added `MaintenanceModeResponse` class

## Migration Guide

### No Breaking Changes

This update is **backward compatible**. All existing functionality continues to work:

- ✅ No configuration changes needed
- ✅ Maintenance mode defaults to disabled
- ✅ No database migrations required (Payload creates global table automatically)
- ✅ No API changes

### New Features

**Enabling Maintenance Mode**:
1. Log in as administrator
2. Navigate to Admin → Server → Maintenance mode
3. Toggle "Enable Maintenance Mode" switch
4. Click "Save changes"
5. System is now in maintenance mode

**Disabling Maintenance Mode**:
1. Log in as administrator (if not already logged in)
2. Navigate to Admin → Server → Maintenance mode
3. Toggle "Enable Maintenance Mode" switch to off
4. Click "Save changes"
5. System is now accessible to all users

**User Experience During Maintenance**:
- Non-admin users see maintenance message on root route
- Non-admin users can access login page (to allow admin login)
- Administrators can access all routes normally
- Administrators can access maintenance page to disable maintenance mode

## Benefits

### System Control

- **Controlled Access**: Restrict system access during maintenance periods
- **Admin Access**: Administrators can still access system to perform maintenance
- **User Communication**: Clear messaging to users about maintenance status
- **Easy Toggle**: Simple switch to enable/disable maintenance mode

### User Experience

- **Clear Messaging**: User-friendly maintenance message with icon and styling
- **Easy Navigation**: Link to login page for administrators
- **No Infinite Loops**: Proper error handling prevents redirect loops
- **Professional Display**: Well-styled error boundary with Mantine components

### Developer Experience

- **Reusable Functions**: Internal functions can be used elsewhere
- **Type Safety**: TypeScript interfaces ensure type safety
- **Error Handling**: Proper error handling using Result pattern
- **Consistent Patterns**: Follows established patterns in codebase

## Testing

- ✅ Maintenance mode can be enabled via admin page
- ✅ Maintenance mode can be disabled via admin page
- ✅ Non-admin users are blocked when maintenance mode is enabled
- ✅ Administrators can access system when maintenance mode is enabled
- ✅ Login page is accessible during maintenance mode
- ✅ Admin maintenance page is accessible during maintenance mode
- ✅ API routes are accessible during maintenance mode
- ✅ Root route shows maintenance message for non-admin users
- ✅ No infinite redirect loops occur
- ✅ Error boundary displays maintenance message correctly
- ✅ Error boundary falls back to default for other errors
- ✅ Page info flags are set correctly
- ✅ Admin layout tab detection works correctly
- ✅ Route configuration is correct

## Future Enhancements

- Add scheduled maintenance mode (enable/disable at specific times)
- Add maintenance mode notification banner (before enabling)
- Add maintenance mode countdown timer
- Add custom maintenance message configuration
- Add maintenance mode history/audit log
- Add maintenance mode email notifications
- Add maintenance mode API endpoints
- Add maintenance mode status API endpoint
- Add maintenance mode bypass for specific users/roles
- Add maintenance mode automatic disable after timeout

## References

- Related changelog: [0021-2025-10-30-registration-and-admin-settings.md](./0021-2025-10-30-registration-and-admin-settings.md)
- Payload CMS Globals Documentation
- React Router Error Boundaries Documentation

