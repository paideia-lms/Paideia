# Changelog 0046: Media Usage Tracking and Deletion Protection

**Date**: November 11, 2025  
**Type**: Feature Addition  
**Impact**: Medium - Adds media usage tracking to prevent accidental deletion of media files that are still referenced in the system

## Overview

Implemented comprehensive media usage tracking functionality that allows users and administrators to identify where media files are being used across the system. The feature prevents accidental deletion of media files that are still referenced in collections such as user avatars, course thumbnails, and submission attachments. The implementation includes usage detection, deletion protection, and a user-friendly UI for viewing media usage information.

## Features Added

### 1. Media Usage Detection Function

**Features**:
- Finds all usages of a specific media file across all collections
- Handles both direct relationship fields and array fields
- Returns detailed usage information with collection name, document ID, and field path
- Validates media existence before searching
- Supports both numeric and string media IDs

**Implementation**:
- Updated `server/internal/media-management.ts`:
  - **`tryFindMediaUsages` function**:
    - Takes `payload` and `mediaId` (number or string)
    - Validates and normalizes media ID
    - Verifies media exists before searching
    - Searches through multiple collections:
      - `users` collection: `avatar` field
      - `courses` collection: `thumbnail` field
      - `assignment-submissions` collection: `attachments[].file` array field
      - `discussion-submissions` collection: `attachments[].file` array field
    - Handles array fields by iterating through each attachment and checking file references
    - Returns array of usage objects with collection, documentId, and fieldPath
    - Uses `overrideAccess: true` to bypass access control for system-level checks
  - **Type Definitions**:
    ```typescript
    export interface MediaUsage {
      collection: string;
      documentId: number;
      fieldPath: string; // e.g., "avatar", "thumbnail", "attachments.0.file"
    }

    export interface FindMediaUsagesArgs {
      mediaId: number | string;
    }

    export interface FindMediaUsagesResult {
      usages: MediaUsage[];
      totalUsages: number;
    }
    ```

**Benefits**:
- ✅ Prevents accidental deletion of in-use media
- ✅ Provides detailed usage information for debugging
- ✅ Type-safe with proper error handling
- ✅ Follows project conventions (Result pattern)
- ✅ Handles complex array field structures

### 2. Deletion Protection with Usage Checking

**Features**:
- Checks for media usage before allowing deletion
- Prevents deletion if media is referenced anywhere in the system
- Provides clear error messages indicating which media files have usage
- Works with both single and batch deletion operations
- Transaction-safe: rolls back entire operation if any media has usage

**Implementation**:
- Updated `server/internal/media-management.ts`:
  - **Modified `tryDeleteMedia` function**:
    - Added usage checking step before S3 deletion
    - Iterates through all media files to be deleted
    - Calls `tryFindMediaUsages` for each media file
    - Collects all media files with usage
    - Throws `MediaInUseError` if any media has usage
    - Includes media IDs and total usage count in error message
    - Transaction automatically rolls back on error
  - **Error Handling**:
    - Created `MediaInUseError` error class in `app/utils/error.ts`
    - Added to `transformError` function for proper error transformation
    - Error message format: `"Cannot delete media file(s) {ids} because {count} usage(s) found. Please remove all references before deleting."`

**Benefits**:
- ✅ Prevents data corruption from deleting referenced media
- ✅ Clear error messages guide users to fix issues
- ✅ Transaction-safe ensures atomicity
- ✅ Works seamlessly with existing deletion flow

### 3. Media Usage API Route

**Features**:
- RESTful API endpoint for fetching media usage data
- On-demand data fetching (not loaded in page loader)
- Type-safe request/response handling
- Proper authentication and authorization checks
- Zod validation for media ID parameter

**Implementation**:
- Created `app/routes/api/media-usage.tsx`:
  - **Route**: `/api/media-usage/:mediaId`
  - **Loader**:
    - Extracts `mediaId` from URL params
    - Validates authentication (requires authenticated user)
    - Validates media ID using Zod schema (supports number or string)
    - Calls `tryFindMediaUsages` with validated media ID
    - Returns usage data or error response
    - Uses `NotFoundResponse` for unauthorized requests (security best practice)
  - **Type Definitions**:
    ```typescript
    export interface UseMediaUsageDataOptions {
      onSuccess?: (data: { usages: MediaUsage[]; totalUsages: number }) => void;
      onError?: (error: string) => void;
    }
    ```
  - **Hook**: `useMediaUsageData`:
    - Uses React Router's `useFetcher` for data fetching
    - Provides `fetchMediaUsage` function to trigger data load
    - Returns `data`, `loading`, `error`, and `state`
    - Supports optional `onSuccess` and `onError` callbacks
    - Handles response parsing and error extraction

**Benefits**:
- ✅ On-demand fetching avoids performance overhead
- ✅ Type-safe API with proper validation
- ✅ Reusable hook for any component
- ✅ Follows React Router v7 patterns

### 4. Media Usage UI Components

**Features**:
- "Show Usage" menu item in media action menus
- Modal dialog displaying usage information
- Lists all usages with collection, document ID, and field path
- Shows total usage count
- Handles loading and error states
- Automatically refetches when switching between files in shared modal
- Uses Mantine's `usePrevious` hook for efficient change detection

**Implementation**:
- Updated `app/routes/user/media.tsx` and `app/routes/admin/media.tsx`:
  - **MediaUsageModal Component**:
    - Receives `file`, `opened`, and `onClose` props
    - Uses `useMediaUsageData` hook for data fetching
    - Uses `usePrevious` hook to track previous file ID and modal state
    - Uses `useRef` to track which file ID the current data belongs to
    - Automatically fetches usage when modal opens or file changes
    - Displays loading state while fetching
    - Shows error message if fetch fails
    - Lists all usages in cards with collection, document ID, and field path
    - Shows "not used anywhere" message if no usages found
    - Only displays data matching current file ID (prevents stale data)
  - **MediaActionMenu Component**:
    - Added `onShowUsage` prop
    - Added "Show Usage" menu item with `IconInfoCircle` icon
    - Calls `onShowUsage` callback when clicked
  - **State Management**:
    - Added `usageModalOpened` state
    - Added `usageFile` state
    - Added `handleOpenUsageModal` function
    - Added `handleCloseUsageModal` function
    - Passes handlers to `MediaCard` and `MediaTableView` components

**Benefits**:
- ✅ User-friendly interface for viewing usage
- ✅ Prevents accidental deletion by showing usage before deletion
- ✅ Efficient data fetching with proper caching
- ✅ Handles edge cases (loading, errors, no usage)
- ✅ Consistent UI across user and admin pages

### 5. Test Coverage

**Features**:
- Comprehensive test cases for media usage detection
- Tests for deletion protection
- Tests for various usage scenarios (direct fields, array fields)
- Tests for edge cases (no usage, non-existent media)

**Implementation**:
- Updated `server/internal/media-management.test.ts`:
  - **Test: "should find media usages across collections"**:
    - Creates a media file
    - Links media to user avatar
    - Links media to course thumbnail
    - Links media to assignment submission attachment
    - Links media to discussion submission attachment
    - Verifies all usages are detected correctly
    - Verifies field paths are correct (including array indices)
  - **Test: "should return empty array for media with no usage"**:
    - Creates a media file with no references
    - Verifies `tryFindMediaUsages` returns empty array
  - **Test: "should fail for non-existent media"**:
    - Attempts to find usage for non-existent media ID
    - Verifies error is returned
  - **Test: "should fail to delete media with usage"**:
    - Creates a media file
    - Links media to user avatar
    - Attempts to delete media
    - Verifies deletion fails with `MediaInUseError`
    - Verifies media still exists after failed deletion
  - **Test: "should fail to delete multiple media when one has usage"**:
    - Creates two media files
    - Links one media to user avatar
    - Attempts to delete both media files
    - Verifies deletion fails (transaction rollback)
    - Verifies both media files still exist

**Benefits**:
- ✅ Ensures correct functionality
- ✅ Prevents regressions
- ✅ Validates error handling
- ✅ Tests complex scenarios (array fields, multiple usages)

## Technical Details

### Usage Detection Strategy

The media usage detection searches through multiple collections:

1. **Direct Relationship Fields**:
   - `users.avatar` - User profile avatars
   - `courses.thumbnail` - Course thumbnail images

2. **Array Relationship Fields**:
   - `assignment-submissions.attachments[].file` - Assignment submission attachments
   - `discussion-submissions.attachments[].file` - Discussion submission attachments

The function handles both cases:
- Direct fields: Uses Payload's `where` clause with `equals` operator
- Array fields: Fetches all documents and iterates through arrays to find matches

### Field Path Format

Field paths use dot notation to indicate nested structures:
- `"avatar"` - Direct field
- `"thumbnail"` - Direct field
- `"attachments.0.file"` - Array field with index
- `"attachments.1.file"` - Array field with index

This format makes it easy to identify exactly where a media file is referenced.

### Deletion Protection Flow

1. User attempts to delete media file(s)
2. System finds all media files to be deleted
3. For each media file, system checks for usage
4. If any media has usage:
   - Transaction rolls back
   - `MediaInUseError` is thrown
   - User sees error message with media IDs and usage count
5. If no media has usage:
   - Deletion proceeds normally
   - Files are removed from database and S3

### Modal Data Fetching Strategy

The `MediaUsageModal` uses a smart fetching strategy:

1. **Change Detection**: Uses `usePrevious` hook to detect when file ID or modal state changes
2. **Conditional Fetching**: Only fetches if:
   - Modal just opened (`!previousOpened`)
   - OR file ID changed (`file.id !== previousFileId`)
3. **Data Validation**: Uses `useRef` to track which file ID the current data belongs to
4. **Stale Data Prevention**: Only displays data if it matches the current file ID

This ensures:
- Data is fetched when needed
- No unnecessary refetches
- No stale data displayed
- Efficient performance

## Testing

- ✅ Unit tests for `tryFindMediaUsages` function
- ✅ Unit tests for deletion protection in `tryDeleteMedia`
- ✅ Tests verify usage detection across all collection types
- ✅ Tests verify array field handling
- ✅ Tests verify error handling for non-existent media
- ✅ Tests verify transaction rollback on deletion failure
- ✅ Manual testing of UI components
- ✅ Manual testing of usage modal
- ✅ Manual testing of deletion protection

## Migration Notes

No database migrations required. This feature adds new functions, API routes, and UI components only. Existing media records are unaffected. The usage detection works with existing data structures.

## Files Changed

### Modified Files
- `server/internal/media-management.ts` - Added `tryFindMediaUsages` function and modified `tryDeleteMedia` to check usage
- `app/utils/error.ts` - Added `MediaInUseError` error class
- `server/internal/media-management.test.ts` - Added comprehensive test cases for usage detection and deletion protection
- `app/routes/user/media.tsx` - Added usage modal and "Show Usage" menu item
- `app/routes/admin/media.tsx` - Added usage modal and "Show Usage" menu item

### New Files
- `app/routes/api/media-usage.tsx` - New API route and `useMediaUsageData` hook
- `app/routes.ts` - Added route for `/api/media-usage/:mediaId`

## Future Enhancements

Potential improvements for future iterations:
- Add usage information to media list view (show usage count badge)
- Add bulk usage check before batch deletion
- Add links to navigate to documents using the media
- Add usage history tracking (when was media first used, last used)
- Add usage analytics (most used media, unused media)
- Add automatic cleanup suggestions for unused media
- Add usage preview in delete confirmation dialog
- Support for detecting media usage in rich text content fields

