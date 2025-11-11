# Changelog 0041: Site Policies and Upload Limits

**Date**: November 10, 2025  
**Type**: Feature Addition & Infrastructure Improvement  
**Impact**: High - Adds configurable site-wide upload limits and storage policies with unified system globals management

## Overview

Implemented a comprehensive site policies system that allows administrators to configure upload limits and storage quotas across the entire LMS. This includes a unified system globals management system that efficiently fetches all system-wide settings (maintenance mode, site policies) in a single call, reducing database queries and improving performance. All file upload routes now respect the configured upload limits, and the media drive displays the actual storage quota instead of hardcoded values.

## Features Added

### 1. Unified System Globals Management

**Features**:
- Created centralized function to fetch all system globals in parallel
- Reduces database queries from multiple sequential calls to a single parallel call
- Provides type-safe access to system-wide settings throughout the application
- Automatically available in global context for all routes

**Implementation**:
- Created `server/internal/system-globals.ts`:
  - **`tryGetSystemGlobals`** function:
    - Fetches maintenance settings and site policies in parallel using `Promise.all`
    - Returns unified `SystemGlobals` type with all system-wide configuration
    - Handles errors gracefully with sensible defaults
    - Uses TypeScript Result pattern for error handling
  - **Type Definition**:
    ```typescript
    export type SystemGlobals = {
      maintenanceSettings: {
        maintenanceMode: boolean;
      };
      sitePolicies: {
        userMediaStorageTotal: number | null;
        siteUploadLimit: number | null;
      };
    };
    ```

- Updated `server/contexts/global-context.ts`:
  - Added `SystemGlobals` type export
  - Added `systemGlobals` field to global context type
  - Makes system globals available to all routes via context

- Updated `app/root.tsx` middleware:
  - Replaced individual `tryGetMaintenanceSettings` call with `tryGetSystemGlobals`
  - Stores all system globals in context for app-wide access
  - Still performs maintenance mode check as before
  - More efficient: single parallel call instead of sequential calls

- Updated `server/index.ts`:
  - Initialized `systemGlobals` with default values in initial context

**Benefits**:
- ✅ Reduced database queries (parallel instead of sequential)
- ✅ System globals available throughout the app via context
- ✅ Easy to extend with more globals in the future
- ✅ More efficient and maintainable architecture
- ✅ Type-safe access to system-wide settings

### 2. Site Policies Global Configuration

**Features**:
- New `SitePolicies` global collection for site-wide configuration
- Configurable user media storage quota (per-user limit)
- Configurable site upload limit (maximum file size for all uploads)
- Supports unlimited storage/upload (null values)
- Default values: 10 GB storage per user, 20 MB upload limit

**Implementation**:
- Created `server/collections/globals.ts`:
  - **`SitePolicies` global**:
    - `userMediaStorageTotal`: Maximum total storage allowed per user (bytes)
      - Default: 10 GB (10 * 1024 * 1024 * 1024)
      - Nullable: `null` means unlimited storage
      - Min: 0
    - `siteUploadLimit`: Maximum file size allowed for uploads (bytes)
      - Default: 20 MB (20 * 1024 * 1024)
      - Nullable: `null` means unlimited upload size
      - Min: 0

- Created `server/internal/site-policies.ts`:
  - **`tryGetSitePolicies`** function:
    - Reads site policies from global collection
    - Returns `SitePolicies` type with proper defaults
    - Uses `overrideAccess: true` for system requests
    - Handles missing/invalid data gracefully
  - **`tryUpdateSitePolicies`** function:
    - Updates site policies in global collection
    - Validates input using Zod schema
    - Supports partial updates
    - Returns updated policies

- Updated `server/payload.config.ts`:
  - Added `SitePolicies` to globals array

- Database migrations:
  - `20251111_000840`: Creates `site_policies` global table
  - `20251111_001644`: Additional schema updates

**Benefits**:
- ✅ Centralized configuration for storage and upload limits
- ✅ Easy to adjust limits without code changes
- ✅ Supports unlimited storage/upload when needed
- ✅ Type-safe configuration with proper defaults

### 3. Admin Site Policies Management Page

**Features**:
- New admin page for managing site policies
- Quick preset options for common storage and upload limit values
- Custom value input for precise configuration
- Real-time display of current values
- Integrated into admin layout under "General" tab
- Linked from "Security > Site security settings"

**Implementation**:
- Created `app/routes/admin/sitepolicies.tsx`:
  - **Loader**:
    - Fetches current site policies
    - Admin-only access control
    - Returns current settings for form initialization
  - **Action**:
    - Updates site policies
    - Validates input using Zod schema
    - Admin-only access control
    - Returns updated settings
  - **Client Action**:
    - Shows success/error notifications
    - Handles form submission feedback
  - **`useUpdateSitePolicies` hook**:
    - Custom hook for updating site policies
    - Handles form data submission
    - Manages loading states
  - **UI Components**:
    - `Select` component with preset options:
      - Storage options: Unlimited, 100 MB, 500 MB, 1 GB, 5 GB, 10 GB, 50 GB, 100 GB, Custom
      - Upload limit options: Unlimited, 1 MB, 5 MB, 10 MB, 20 MB, 50 MB, 100 MB, 500 MB, 1 GB, Custom
    - `NumberInput` for custom values
    - Displays current value when preset is selected
    - Form validation and error handling

- Updated `app/routes.ts`:
  - Added `admin/sitepolicies` route under `server-admin-layout`

- Updated `server/contexts/global-context.ts`:
  - Added `isAdminSitePolicies: boolean` to `PageInfo` type

- Updated `app/root.tsx`:
  - Added route detection for `admin/sitepolicies`
  - Sets `isAdminSitePolicies` flag in page info

- Updated `server/index.ts`:
  - Initialized `isAdminSitePolicies: false` in page info

- Updated `app/layouts/server-admin-layout.tsx`:
  - Added `admin/sitepolicies` to "General" tab

- Updated `app/routes/admin/index.tsx`:
  - Added link to site policies page under "Security > Site security settings"

**Benefits**:
- ✅ Easy-to-use admin interface for policy management
- ✅ Quick presets for common configurations
- ✅ Custom values for precise control
- ✅ Integrated into existing admin navigation
- ✅ Clear visual feedback for current settings

### 4. Upload Limit Enforcement Across All Routes

**Features**:
- All file upload routes now respect site-wide upload limit
- Consistent error handling for file size violations
- User-friendly error messages with formatted file sizes
- Supports unlimited uploads when limit is `null`
- Automatic enforcement in both primary and fallback form data parsers

**Implementation**:
- Updated `app/utils/parse-form-data-with-fallback.ts`:
  - Enhanced to accept `maxFileSize` and `maxFiles` options
  - Passes limits to `@remix-run/form-data-parser`'s `parseFormData`
  - Enforces limits in fallback `processWithNativeFormData` function
  - Throws `MaxFileSizeExceededError` and `MaxFilesExceededError` for violations

- Updated all upload routes to use system globals:
  - **`app/routes/user/overview.tsx`** (avatar uploads):
    - Gets `siteUploadLimit` from `systemGlobals`
    - Passes to `parseFormDataWithFallback`
    - Handles `MaxFileSizeExceededError` with formatted error message
  - **`app/routes/user/note-edit.tsx`** (note image uploads):
    - Gets `siteUploadLimit` from `systemGlobals`
    - Passes to `parseFormDataWithFallback`
    - Handles file size errors with `prettyBytes` formatting
  - **`app/routes/user/note-create.tsx`** (note image uploads):
    - Gets `siteUploadLimit` from `systemGlobals`
    - Passes to `parseFormDataWithFallback`
    - Handles file size errors with `prettyBytes` formatting
  - **`app/routes/user/media.tsx`** (media file uploads):
    - Gets `siteUploadLimit` from `systemGlobals`
    - Replaces hardcoded 100MB limit
    - Passes to `parseFormDataWithFallback`
    - Handles file size errors with formatted messages
  - **`app/routes/course/module.$id.tsx`** (assignment file uploads):
    - Gets `siteUploadLimit` from `systemGlobals`
    - Passes to `parseFormDataWithFallback`
    - Handles file size errors with formatted messages
  - **`app/routes/course.$id.settings.tsx`** (course thumbnail and description images):
    - Gets `siteUploadLimit` from `systemGlobals`
    - Passes to `parseFormDataWithFallback`
    - Handles file size errors with formatted messages
  - **`app/routes/admin/new.tsx`** (user avatar uploads):
    - Gets `siteUploadLimit` from `systemGlobals`
    - Passes to `parseFormDataWithFallback`
    - Handles file size errors with formatted messages

**Error Handling**:
- All routes import `MaxFileSizeExceededError` and `MaxFilesExceededError` from `@remix-run/form-data-parser`
- All routes import `prettyBytes` for user-friendly file size formatting
- Error messages format the limit using `prettyBytes(maxFileSize ?? 0)`
- Consistent error handling pattern across all upload routes

**Benefits**:
- ✅ Site-wide upload limit enforcement
- ✅ Consistent user experience across all upload features
- ✅ Easy to adjust limits without code changes
- ✅ Supports unlimited uploads when needed
- ✅ User-friendly error messages with formatted file sizes

### 5. Storage Limit Display in Media Page

**Features**:
- Media drive page displays actual storage limit from system globals
- Replaces hardcoded 10GB value with configurable limit
- Shows "Unlimited" when storage limit is `null`
- Dynamic donut chart that adapts to limit configuration
- Real-time display of used vs available storage

**Implementation**:
- Updated `app/routes/user/media.tsx` loader:
  - Gets `systemGlobals` from global context
  - Extracts `userMediaStorageTotal` as `storageLimit`
  - Returns `storageLimit` in loader data

- Updated `app/routes/user/media.tsx` component:
  - Receives `storageLimit` from `loaderData`
  - **DonutChart**:
    - When limit is set: Shows used vs available storage
    - Chart label: `${prettyBytes(stats.totalSize)} / ${prettyBytes(storageLimit)}`
    - Available calculation: `Math.max(0, storageLimit - stats.totalSize)`
    - When limit is `null`: Shows only used storage
    - Chart label: `${prettyBytes(stats.totalSize)}`
  - **Allowance Text**:
    - When limit is set: Displays formatted limit (e.g., "10 GB")
    - When limit is `null`: Displays "Unlimited"
    - Format: `Allowance: <strong>{storageLimit !== null && storageLimit !== undefined ? prettyBytes(storageLimit) : "Unlimited"}</strong>`

**Benefits**:
- ✅ Accurate storage quota display
- ✅ Reflects actual configured limits
- ✅ Supports unlimited storage display
- ✅ Dynamic visualization based on configuration
- ✅ Better user awareness of storage usage

## Technical Details

### Database Changes

**Migrations**:
- `20251111_000840`: Creates `site_policies` global table with:
  - `userMediaStorageTotal` (integer, nullable)
  - `siteUploadLimit` (integer, nullable)
- `20251111_001644`: Additional schema updates

### Type Safety

**New Types**:
- `SystemGlobals` type in `server/contexts/global-context.ts`
- `SystemGlobals` type in `server/internal/system-globals.ts`
- `SitePolicies` type in `server/internal/site-policies.ts`

**Type Exports**:
- `SystemGlobals` exported from `server/contexts/global-context.ts` for use in routes
- All types use proper nullability to support unlimited values

### Error Handling

**New Error Handling**:
- All upload routes handle `MaxFileSizeExceededError`
- All upload routes handle `MaxFilesExceededError`
- Consistent error message formatting using `prettyBytes`
- Graceful fallbacks when system globals cannot be fetched

### Performance Improvements

**Optimizations**:
- System globals fetched in parallel instead of sequentially
- Single database call for all system-wide settings
- Cached in global context for request lifetime
- Reduced database queries in middleware

## Migration Guide

### For Administrators

1. **Access Site Policies**:
   - Navigate to Admin → General → Security → Site security settings
   - Or directly: `/admin/sitepolicies`

2. **Configure Storage Limits**:
   - Select a preset or enter a custom value for "User Media Storage Total"
   - Leave empty for unlimited storage per user
   - Default: 10 GB

3. **Configure Upload Limits**:
   - Select a preset or enter a custom value for "Site Upload Limit"
   - Leave empty for unlimited upload size
   - Default: 20 MB

4. **Save Changes**:
   - Click "Save changes" button
   - Changes take effect immediately for all new uploads

### For Developers

1. **Accessing System Globals**:
   ```typescript
   const { systemGlobals } = context.get(globalContextKey);
   const uploadLimit = systemGlobals.sitePolicies.siteUploadLimit;
   const storageLimit = systemGlobals.sitePolicies.userMediaStorageTotal;
   ```

2. **Using Upload Limits in Routes**:
   ```typescript
   const maxFileSize = systemGlobals.sitePolicies.siteUploadLimit ?? undefined;
   const formData = await parseFormDataWithFallback(
     request,
     uploadHandler,
     maxFileSize !== undefined ? { maxFileSize } : undefined,
   );
   ```

3. **Handling Upload Errors**:
   ```typescript
   import { MaxFileSizeExceededError, MaxFilesExceededError } from "@remix-run/form-data-parser";
   import prettyBytes from "pretty-bytes";

   try {
     // ... upload logic
   } catch (error) {
     if (error instanceof MaxFileSizeExceededError) {
       return badRequest({
         error: `File size exceeds maximum allowed size of ${prettyBytes(maxFileSize ?? 0)}`,
       });
     }
     if (error instanceof MaxFilesExceededError) {
       return badRequest({ error: error.message });
     }
     // ... other error handling
   }
   ```

## Testing

### Manual Testing

1. **Site Policies Configuration**:
   - ✅ Access admin site policies page
   - ✅ Select preset values for storage and upload limits
   - ✅ Enter custom values
   - ✅ Save and verify changes persist
   - ✅ Verify unlimited option works (empty/null values)

2. **Upload Limit Enforcement**:
   - ✅ Upload file smaller than limit (should succeed)
   - ✅ Upload file larger than limit (should fail with error message)
   - ✅ Verify error message shows formatted limit
   - ✅ Test unlimited uploads (when limit is null)

3. **Storage Limit Display**:
   - ✅ Verify media page shows actual configured limit
   - ✅ Verify "Unlimited" displays when limit is null
   - ✅ Verify donut chart adapts to limit configuration
   - ✅ Verify chart shows correct used vs available

4. **System Globals**:
   - ✅ Verify system globals available in all routes
   - ✅ Verify maintenance mode still works
   - ✅ Verify parallel fetching improves performance

## Breaking Changes

**None** - All changes are backward compatible:
- Default values ensure existing functionality continues to work
- Null values support unlimited storage/upload (existing behavior)
- All new features are additive

## Future Enhancements

**Potential Improvements**:
- Per-user storage limit overrides
- Per-collection upload limit configuration
- Storage usage warnings when approaching limit
- Automatic cleanup of old media files
- Storage quota enforcement during upload
- Detailed storage usage reports

## Related Changes

- **Changelog 0040**: User Media Drive (foundation for media management)
- **Changelog 0039**: Maintenance Mode (now part of unified system globals)

## Summary

This changelog introduces a comprehensive site policies system that allows administrators to configure upload limits and storage quotas. The implementation includes a unified system globals management system that efficiently fetches all system-wide settings, an admin interface for policy management, and consistent enforcement of upload limits across all file upload routes. The media drive now displays the actual configured storage limit instead of hardcoded values, providing users with accurate information about their storage quota.

