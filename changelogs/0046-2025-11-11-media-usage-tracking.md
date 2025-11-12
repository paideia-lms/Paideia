# Changelog 0046: Media Usage Tracking and Deletion Protection

**Date**: November 11, 2025  
**Type**: Feature Addition + Refactoring  
**Impact**: High - Adds media usage tracking to prevent accidental deletion of media files, standardizes internal function signatures across the codebase, adds media relationship fields to content collections, and implements HTML parsing for automatic media reference tracking

## Overview

Implemented comprehensive media usage tracking functionality that allows users and administrators to identify where media files are being used across the system. The feature prevents accidental deletion of media files that are still referenced in collections such as user avatars, course thumbnails, and submission attachments. The implementation includes usage detection, deletion protection, and a user-friendly UI for viewing media usage information.

Additionally, this PR includes significant refactoring to standardize internal function signatures, adds media relationship fields to content collections (courses, pages, notes), implements HTML parsing for media references, and improves transaction handling throughout the codebase.

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
    - Standardized to accept single `args` object with `payload`, `mediaId`, `user`, `req`, and `overrideAccess`
    - Validates and normalizes media ID
    - Verifies media exists before searching
    - Searches through multiple collections:
      - `users` collection: `avatar` field
      - `courses` collection: `thumbnail` field
      - `assignment-submissions` collection: `attachments[].file` array field
      - `discussion-submissions` collection: `attachments[].file` array field
      - `courses` collection: `media` relationship array (new)
      - `pages` collection: `media` relationship array (new)
      - `notes` collection: `media` relationship array (new)
    - Handles array fields by iterating through each attachment and checking file references
    - Returns array of usage objects with collection, documentId, and fieldPath
    - Properly propagates `user`, `req`, and `overrideAccess` to internal calls
  - **Type Definitions**:
    ```typescript
    export interface MediaUsage {
      collection: string;
      documentId: number;
      fieldPath: string; // e.g., "avatar", "thumbnail", "attachments.0.file", "media"
    }

    export interface FindMediaUsagesArgs {
      payload: Payload;
      mediaId: number | string;
      user?: TypedUser | null;
      req?: Partial<PayloadRequest>;
      overrideAccess?: boolean;
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

### 6. Internal Function Signature Standardization

**Features**:
- Standardized all internal functions to accept a single `args` object
- Consistent parameter structure across all internal functions
- Proper transaction handling and propagation
- Improved type safety and maintainability

**Implementation**:
- Updated all internal functions in `server/internal/media-management.ts`:
  - All functions now accept single `args` object containing:
    - `payload: Payload`
    - `user?: TypedUser | null`
    - `req?: Partial<PayloadRequest>`
    - `overrideAccess?: boolean`
    - `s3Client: S3Client` (when applicable)
  - Functions properly propagate `user`, `req`, and `overrideAccess` to nested calls
  - Transaction handling improved to check for existing `req?.transactionID`
  - Updated all call sites throughout the codebase to use new signature
- Updated related internal functions:
  - `tryCreateMedia`, `tryUpdateMedia`, `tryDeleteMedia`, `tryRenameMedia`
  - `tryGetMediaById`, `tryGetMediaByFilename`, `tryGetAllMedia`
  - `tryGetMediaBufferFromFilename`, `tryGetMediaBufferFromId`
  - `tryGetMediaStreamFromFilename`, `tryGetMediaStreamFromId`
  - `tryFindMediaUsages`, `tryGetOrphanedMedia`, `tryDeleteOrphanedMedia`
  - `tryPruneAllOrphanedMedia`, `tryGetUserMediaStats`, `tryGetSystemMediaStats`

**Benefits**:
- ✅ Consistent API across all internal functions
- ✅ Better type safety and IDE support
- ✅ Easier to maintain and extend
- ✅ Proper transaction propagation

### 7. Media Relationship Fields

**Features**:
- Added `media` relationship fields to content collections
- Enables tracking of media references in courses, pages, and notes
- Supports automatic media reference extraction from HTML content

**Implementation**:
- Updated collection schemas:
  - **`server/collections/courses.ts`**: Added `media` relationship field (hasMany)
  - **`server/collections/pages.ts`**: Added `media` relationship field (hasMany)
  - **`server/collections/notes.ts`**: Added `media` relationship field (hasMany)
- Created database migration `20251112_074156.ts`:
  - Creates relationship tables: `courses_rels`, `pages_rels`, `notes_rels`
  - Sets up proper foreign key constraints with cascade delete
  - Adds indexes for performance
- Updated internal functions:
  - `tryCreatePage`, `tryUpdatePage` - Parse HTML and extract media references
  - `tryCreateNote`, `tryUpdateNote` - Parse HTML and extract media references
  - `tryUpdateCourse` - Support media relationship updates

**Benefits**:
- ✅ Proper relationship tracking for media in content
- ✅ Database-level referential integrity
- ✅ Efficient queries with indexes
- ✅ Automatic cleanup on content deletion

### 8. HTML Media Parsing

**Features**:
- Parses HTML content to extract media file references
- Handles both numeric IDs and filenames in image src attributes
- Automatically resolves filenames to IDs when creating/updating content
- Transaction-aware to see uncommitted media files

**Implementation**:
- Created `server/internal/utils/parse-media-from-html.ts`:
  - **`tryParseMediaFromHtml` function**:
    - Uses Cheerio to parse HTML
    - Extracts `<img>` tags with `src` attributes matching `/api/media/file/:filenameOrId`
    - Returns both numeric IDs and filenames separately
    - Handles edge cases (empty HTML, missing src attributes)
- Updated content management functions:
  - `tryCreatePage`, `tryUpdatePage` - Parse HTML and resolve media references
  - `tryCreateNote`, `tryUpdateNote` - Parse HTML and resolve media references
  - Functions resolve filenames to IDs using Payload queries within transaction context
  - Transaction context allows seeing uncommitted media files created in same transaction

**Benefits**:
- ✅ Automatic media reference tracking from HTML content
- ✅ Supports both ID and filename references
- ✅ Transaction-safe media resolution
- ✅ No manual media relationship management needed

### 9. Test Improvements

**Features**:
- Updated tests to use `getAuthUser` helper instead of `overrideAccess` in test cases
- Better test isolation and authentication testing
- Consistent test patterns across all test files

**Implementation**:
- Updated test files:
  - `server/internal/enrollment-management.test.ts` - Added `getAuthUser` helper
  - `server/internal/media-management.test.ts` - Updated to use standardized signatures
  - `server/internal/page-management.test.ts` - Added media parsing tests
  - `server/internal/note-management.test.ts` - Updated to use `getAuthUser` helper
- Test best practices:
  - `overrideAccess: true` only used in `beforeAll`/`afterAll` hooks
  - Test cases use authenticated users via `getAuthUser` helper
  - Proper user object structure with `collection: "users"` property

**Benefits**:
- ✅ More realistic test scenarios
- ✅ Better access control testing
- ✅ Consistent test patterns
- ✅ Easier to maintain tests

## Technical Details

### Usage Detection Strategy

The media usage detection searches through multiple collections:

1. **Direct Relationship Fields**:
   - `users.avatar` - User profile avatars
   - `courses.thumbnail` - Course thumbnail images

2. **Array Relationship Fields**:
   - `assignment-submissions.attachments[].file` - Assignment submission attachments
   - `discussion-submissions.attachments[].file` - Discussion submission attachments

3. **Content Media Relationship Fields** (new):
   - `courses.media` - Media references in course content (extracted from HTML)
   - `pages.media` - Media references in page content (extracted from HTML)
   - `notes.media` - Media references in note content (extracted from HTML)

The function handles all cases:
- Direct fields: Uses Payload's `where` clause with `equals` operator
- Array fields: Fetches all documents and iterates through arrays to find matches
- Relationship arrays: Uses Payload's relationship query capabilities to find references

### Field Path Format

Field paths use dot notation to indicate nested structures:
- `"avatar"` - Direct field
- `"thumbnail"` - Direct field
- `"attachments.0.file"` - Array field with index
- `"attachments.1.file"` - Array field with index
- `"media"` - Relationship array field (for courses, pages, notes)

This format makes it easy to identify exactly where a media file is referenced. The `media` relationship field is automatically populated when content is created or updated with HTML containing media references.

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

**Database Migration Required**: `20251112_074156`

This migration adds relationship tables for media references in courses, pages, and notes:
- Creates `courses_rels`, `pages_rels`, and `notes_rels` tables
- Sets up foreign key constraints with cascade delete
- Adds performance indexes

**Backward Compatibility**: The migration is non-breaking. Existing media records and content are unaffected. The new relationship fields are optional and can be populated gradually as content is updated.

**Media Reference Resolution**: When creating or updating content with HTML containing media references, the system automatically:
1. Parses HTML to find media references (both IDs and filenames)
2. Resolves filenames to IDs within the transaction context
3. Updates the `media` relationship field automatically
4. Works seamlessly with existing content that may not have media relationships populated

## Files Changed

### Modified Files
- `server/internal/media-management.ts` - Added `tryFindMediaUsages` function, standardized all function signatures, modified `tryDeleteMedia` to check usage
- `server/internal/page-management.ts` - Added HTML parsing and media relationship handling, standardized function signatures
- `server/internal/note-management.ts` - Added HTML parsing and media relationship handling, standardized function signatures
- `server/internal/course-management.ts` - Standardized function signatures, added media relationship support
- `server/internal/enrollment-management.ts` - Standardized function signatures
- `app/utils/error.ts` - Added `MediaInUseError` error class
- `server/internal/media-management.test.ts` - Added comprehensive test cases, updated to use standardized signatures
- `server/internal/page-management.test.ts` - Added media parsing tests
- `server/internal/note-management.test.ts` - Updated to use `getAuthUser` helper
- `server/internal/enrollment-management.test.ts` - Updated to use `getAuthUser` helper
- `server/internal/course-management.test.ts` - Updated to use standardized signatures
- `app/routes/user/media.tsx` - Added usage modal, "Show Usage" menu item, updated to use standardized signatures
- `app/routes/admin/media.tsx` - Added usage modal, "Show Usage" menu item, updated to use standardized signatures
- `app/routes/user/note-create.tsx` - Updated to use standardized signatures, added transaction context for media resolution
- `app/routes/user/note-edit.tsx` - Updated to use standardized signatures, added transaction context for media resolution
- `app/routes/user/overview.tsx` - Updated to use standardized signatures
- `app/routes/admin/new.tsx` - Updated to use standardized signatures
- `app/routes/admin/course-new.tsx` - Updated to use standardized signatures
- `app/routes/admin/courses.tsx` - Updated to use standardized signatures
- `app/routes/admin/appearance.tsx` - Fixed validation and React key warnings
- `app/routes/course.$id.settings.tsx` - Updated to use standardized signatures, added transaction context
- `app/routes/course.$id.groups.tsx` - Updated to use standardized signatures
- `app/routes/course/module.$id.tsx` - Updated to use standardized signatures
- `app/routes/api/media-usage.tsx` - Updated to use standardized signatures
- `app/routes/api/media/file.$filenameOrId.tsx` - Updated to use standardized signatures
- `app/routes/api/user.$id.avatar.tsx` - Updated to use standardized signatures
- `app/routes/api/batch-update-courses.tsx` - Updated to use standardized signatures
- `server/collections/courses.ts` - Added `media` relationship field
- `server/collections/pages.ts` - Added `media` relationship field
- `server/collections/notes.ts` - Added `media` relationship field
- `server/collections/globals.ts` - Improved URL validation using Zod
- `server/contexts/course-context.ts` - Updated to include `collection` property
- `server/utils/db/seed.ts` - Updated to use standardized signatures
- `.cursor/rules/best-practice.mdc` - Updated documentation for internal function standards and test practices

### New Files
- `app/routes/api/media-usage.tsx` - New API route and `useMediaUsageData` hook
- `server/internal/utils/parse-media-from-html.ts` - HTML parsing utility for media references
- `server/internal/utils/parse-media-from-html.test.ts` - Tests for HTML parsing utility
- `src/migrations/20251112_074156.ts` - Database migration for media relationships
- `src/migrations/20251112_074156.json` - Migration metadata

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
- Add migration script to populate media relationships for existing content
- Add bulk media relationship update functionality
- Improve HTML parsing to support more media reference patterns

