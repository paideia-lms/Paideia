# Changelog 0043: Admin Media Management Page

**Date**: November 11, 2025  
**Type**: Feature Addition  
**Impact**: Medium - Adds comprehensive admin media management page with user filtering, system-wide statistics, and improved deletion functionality

## Overview

Implemented a comprehensive admin media management page that allows administrators to view and manage all media files in the system. The page includes user filtering capabilities, system-wide statistics, storage visualization, and proper S3 file deletion. The implementation follows project conventions using TypeScript Result pattern, transactions for atomicity, and Mantine components for the UI.

## Features Added

### 1. Admin Media Management Page

**Features**:
- System-wide media view showing all media files in the system
- User filtering capability to view media for specific users
- Pagination support with URL-based search parameters
- Card and table view modes
- Media statistics with charts
- Storage visualization comparing user vs system storage

**Implementation**:
- Created `app/routes/admin/media.tsx`:
  - **Loader**:
    - Fetches all media or user-specific media based on `userId` search parameter
    - Uses `nuqs` `createLoader` for search parameter parsing
    - Supports `userId` (optional) and `page` (default: 1) search parameters
    - Fetches system-wide stats when viewing all media
    - Fetches user-specific stats and system-wide stats when viewing a user
    - Fetches user list for filter dropdown
    - Returns media with permissions, pagination info, stats, and user options
  - **Action**:
    - Handles DELETE requests for media deletion
    - Handles PATCH requests for media renaming
    - Uses transactions for atomicity
    - Admin can delete/rename any media (bypasses user-specific permissions)
  - **Component**:
    - Media header with title, file count, view mode toggle, and user filter
    - Statistics section with pie chart (media by type) and donut chart (storage)
    - Card view and table view modes
    - Batch delete functionality
    - Media preview modal
    - Media rename modal
    - Pagination component

**Benefits**:
- ✅ Centralized admin view of all system media
- ✅ Easy filtering by user
- ✅ Comprehensive statistics visualization
- ✅ Consistent with existing admin pages

### 2. System-Wide Media Statistics Function

**Features**:
- New function to get media statistics for entire system
- Calculates total count, total size, and media type distribution
- Supports access control with user context

**Implementation**:
- Updated `server/internal/media-management.ts`:
  - **`tryGetSystemMediaStats` function**:
    - Fetches all media in the system (no user filter)
    - Calculates total count and total size
    - Categorizes media by type (image, video, audio, pdf, text, document, spreadsheet, presentation, archive, other)
    - Returns aggregated statistics
    - Supports access control via user context and overrideAccess flag
  - **Type Definitions**:
    ```typescript
    export interface GetSystemMediaStatsArgs {
      payload: Payload;
      user?: unknown;
      req?: Partial<PayloadRequest>;
      overrideAccess?: boolean;
    }
    ```
  - Returns:
    ```typescript
    {
      count: number;
      totalSize: number;
      mediaTypeCount: Record<string, number>;
    }
    ```

**Benefits**:
- ✅ System-wide statistics for admin dashboard
- ✅ Type-safe with proper error handling
- ✅ Follows project conventions (Result pattern)

### 3. User Filtering with Search Parameters

**Features**:
- URL-based user filtering using `nuqs` library
- Page number support in URL
- Automatic page reset when user filter changes
- User selector dropdown with searchable interface

**Implementation**:
- Updated `app/routes/admin/media.tsx`:
  - **Search Parameters**:
    ```typescript
    export const mediaSearchParams = {
      userId: parseAsInteger,
      page: parseAsInteger.withDefault(1),
    };
    ```
  - **Loader Logic**:
    - Checks for `userId` in search params
    - If `userId` provided: fetches user-specific media and stats
    - If no `userId`: fetches all media and system stats
    - Fetches user list for filter dropdown
  - **Component**:
    - Uses `useQueryState` from `nuqs` for client-side state management
    - User filter selector with searchable dropdown
    - Automatically resets to page 1 when user filter changes
    - Updates URL when pagination or filter changes

**Benefits**:
- ✅ Shareable URLs with filter state
- ✅ Browser back/forward navigation support
- ✅ Clean URL-based state management

### 4. Storage Visualization Enhancement

**Features**:
- Dynamic storage chart based on view context
- User view: shows user storage vs system storage (all users)
- System view: shows system storage vs available disk space
- Visual comparison with donut charts

**Implementation**:
- Updated `app/routes/admin/media.tsx`:
  - **Storage Chart Logic**:
    - When viewing specific user (`currentUserId` and `systemStats` exist):
      - Shows "User Storage" (blue) vs "System Storage" (green)
      - Displays both user storage and total system storage values
    - When viewing system-wide (`systemResources?.disk` exists):
      - Shows "System Storage" (blue) vs "Available" (green)
      - Displays system storage and available disk space
    - Fallback: shows just "Used" storage if system resources unavailable
  - **Loader**:
    - Fetches system stats when viewing a user for comparison
    - Fetches system resources (disk info) only for system-wide view

**Benefits**:
- ✅ Clear visual comparison of user vs system storage
- ✅ Context-aware chart display
- ✅ Helps admins understand storage distribution

### 5. Creator Information Display

**Features**:
- Shows creator avatar in media cards and table
- Creator name links to user profile page
- Avatar displayed using media file API endpoint

**Implementation**:
- Updated `app/routes/admin/media.tsx`:
  - **MediaCard Component**:
    - Extracts creator ID, name, and avatar ID from `createdBy` field
    - Builds avatar URL using `/api/media/file/${avatarId}`
    - Builds profile URL using `/user/profile/:id`
    - Displays avatar (20px) with creator name as clickable link
    - Handles cases where avatar or profile URL might not be available
  - **MediaTableView Component**:
    - Updated "Created By" column to show avatar (24px) and name
    - Creator name is clickable link to profile
    - Same avatar and profile URL logic as card view
  - Added imports:
    - `Avatar` from Mantine core
    - `Link` from react-router

**Benefits**:
- ✅ Easy identification of media creators
- ✅ Quick navigation to user profiles
- ✅ Visual consistency with user avatars

### 6. Shared Media Helper Functions

**Features**:
- Extracted common media helper functions to shared utility
- Reusable across user and admin media pages
- Type-safe helper functions for media type detection

**Implementation**:
- Created `app/utils/media-helpers.tsx`:
  - **`getFileIcon`**: Returns icon component based on MIME type
  - **`isImage`**: Checks if MIME type is an image
  - **`isAudio`**: Checks if MIME type is audio
  - **`isVideo`**: Checks if MIME type is video
  - **`isPdf`**: Checks if MIME type is PDF
  - **`canPreview`**: Checks if MIME type can be previewed
  - **`getTypeColor`**: Returns color for media type (used in charts)
- Updated `app/routes/admin/media.tsx`:
  - Removed duplicate function definitions
  - Added import from `~/utils/media-helpers`
- Updated `app/routes/user/media.tsx`:
  - Removed duplicate function definitions
  - Added import from `~/utils/media-helpers`

**Benefits**:
- ✅ DRY principle (Don't Repeat Yourself)
- ✅ Consistent behavior across pages
- ✅ Easier maintenance and updates

### 7. S3 File Deletion in Delete Media Function

**Features**:
- Media deletion now removes files from S3 storage
- Atomic operation: S3 deletion and database deletion in transaction
- Proper error handling with transaction rollback

**Implementation**:
- Updated `server/internal/media-management.ts`:
  - **`tryDeleteMedia` function**:
    - Added `s3Client: S3Client` parameter
    - Deletes files from S3 before deleting database records
    - Uses `DeleteObjectCommand` from AWS SDK
    - Deletes all files within transaction
    - If S3 deletion fails, transaction rolls back
    - Skips S3 deletion if filename is missing
  - Updated function signature:
    ```typescript
    export const tryDeleteMedia = Result.wrap(
      async (
        payload: Payload,
        s3Client: S3Client,
        args: DeleteMediaArgs,
      ): Promise<DeleteMediaResult>
    ```
- Updated `app/routes/admin/media.tsx`:
  - Updated `tryDeleteMedia` call to pass `s3Client`
- Updated `app/routes/user/media.tsx`:
  - Updated `tryDeleteMedia` call to pass `s3Client`
- Updated `server/internal/media-management.test.ts`:
  - Updated all `tryDeleteMedia` calls to include `s3Client`
  - Added S3 deletion verification in test

**Benefits**:
- ✅ Prevents orphaned files in S3 storage
- ✅ Atomic operations ensure consistency
- ✅ Proper cleanup of storage resources

### 8. Admin Media Page Integration

**Features**:
- Added route to admin navigation
- Integrated with admin layout and tabs
- Added to admin dashboard index page

**Implementation**:
- Updated `app/routes.ts`:
  - Added route: `route("admin/media", "routes/admin/media.tsx")`
- Updated `app/root.tsx`:
  - Added `isAdminMedia` flag to `pageInfo` in middleware
- Updated `server/contexts/global-context.ts`:
  - Added `isAdminMedia: boolean` to `PageInfo` interface
- Updated `server/index.ts`:
  - Added `isAdminMedia: false` to initial `pageInfo`
- Updated `app/layouts/server-admin-layout.tsx`:
  - Added `isAdminMedia` check to map to `AdminTab.Server` tab
- Updated `app/routes/admin/index.tsx`:
  - Added "Media management" link under "Server" section

**Benefits**:
- ✅ Properly integrated into admin navigation
- ✅ Consistent with other admin pages
- ✅ Easy access from admin dashboard

## Technical Details

### Search Parameter Management

The page uses `nuqs` library for URL-based state management:
- Server-side: `createLoader` with `parseAsInteger` for type-safe parsing
- Client-side: `useQueryState` for reactive state updates
- Automatic URL synchronization
- Browser navigation support

### Storage Chart Logic

The storage visualization adapts based on context:
- **User View**: Compares user's storage against total system storage
- **System View**: Compares system storage against available disk space
- Uses `systemResources` from `detectSystemResources` utility
- Falls back gracefully when system resources unavailable

### Transaction Management

Media deletion uses transactions to ensure atomicity:
1. Begin transaction
2. Verify user exists
3. Fetch media records
4. Delete files from S3
5. Delete records from database
6. Commit transaction

If any step fails, transaction rolls back, ensuring no partial deletions.

### Error Handling

All operations use TypeScript Result pattern:
- `tryGetSystemMediaStats` returns `Result<Stats>`
- `tryDeleteMedia` returns `Result<DeleteMediaResult>`
- Errors are properly typed and transformed
- Client receives clear error messages

## Testing

- ✅ Unit tests for `tryGetSystemMediaStats` function
- ✅ Updated tests for `tryDeleteMedia` with S3 deletion
- ✅ Tests verify S3 and database consistency
- ✅ Manual testing of admin media page UI
- ✅ Manual testing of user filtering
- ✅ Manual testing of storage charts

## Migration Notes

No database migrations required. This feature uses existing Media collection schema and adds new functions only.

## Files Changed

### New Files
- `app/routes/admin/media.tsx` - Admin media management page
- `app/utils/media-helpers.tsx` - Shared media helper functions

### Modified Files
- `server/internal/media-management.ts` - Added `tryGetSystemMediaStats`, updated `tryDeleteMedia` signature
- `server/internal/media-management.test.ts` - Updated tests for S3 deletion
- `app/routes/user/media.tsx` - Updated `tryDeleteMedia` call, removed duplicate helpers
- `app/routes.ts` - Added admin media route
- `app/root.tsx` - Added `isAdminMedia` flag
- `server/contexts/global-context.ts` - Added `isAdminMedia` to PageInfo
- `server/index.ts` - Added `isAdminMedia` initialization
- `app/layouts/server-admin-layout.tsx` - Added media page tab mapping
- `app/routes/admin/index.tsx` - Added media management link

## Future Enhancements

Potential improvements for future iterations:
- Bulk operations (bulk delete, bulk rename)
- Advanced filtering (by date, type, size)
- Media search functionality
- Export media list to CSV
- Media usage analytics
- Storage quota warnings

