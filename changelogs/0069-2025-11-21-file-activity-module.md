# File Activity Module

**Date:** 2025-11-21  
**Type:** Feature Addition  
**Impact:** Medium - Adds file-type activity module for instructors to share files with students  
**Status:** ⚠️ **Not Ready - Buggy** - This feature is currently in development and contains known issues

## Overview

This changelog documents the initial implementation of the file activity module type, which allows instructors to upload and share multiple files with students in a course. The feature includes a new Files collection, file upload and management functionality, and UI components for creating, editing, and viewing file modules. This feature is currently incomplete and contains bugs that need to be addressed before production use.

## Key Changes

### New Activity Module Type: File

#### File Module Support
- Added "file" as a new activity module type alongside page, whiteboard, assignment, quiz, and discussion
- File modules allow instructors to upload and organize multiple media files for student access
- Files are displayed in a preview component with file type icons and download links
- Supports various file types including images, PDFs, text files, and other document formats

#### Activity Module Schema Updates
- Updated `activityModuleSchema` to include "file" in the type enum
- Added `fileMedia` field for storing array of media IDs
- Added `fileFiles` field for handling file uploads before they become media IDs
- Updated `ActivityModuleFormValues` type to include file-specific fields

### Files Collection

#### New Collection Structure
- Created `Files` collection in `server/collections/files.ts`
- Contains relationship to "media" collection (hasMany)
- Includes `createdBy` relationship to track file ownership
- Indexed on `createdBy` for efficient queries

#### Database Migrations
- **Migration 20251121_215049**: Creates `files` and `files_rels` tables
- **Migration 20251121_215303**: Adds `file_id` column to `activity_modules` table and updates enum type
- Both migrations include proper foreign key constraints and indexes

### File Management Functions

#### Internal File Management
- Created `server/internal/file-management.ts` with file management functions
- Added `NonExistingFileError` error class for error handling
- File management functions follow standard internal function pattern with `user`, `req`, and `overrideAccess` parameters

#### Activity Module Management Updates
- Updated `tryCreateActivityModule` to support file module creation
- Updated `tryUpdateActivityModule` to support file module updates
- Updated `tryDeleteActivityModule` to handle cascading deletion of file entities
- All functions now use transaction management utility

### Transaction ID Utility

#### Centralized Transaction Handling
- Created `server/internal/utils/handle-transaction-id.ts` utility function
- Handles transaction ID extraction from `req` (supports string, number, or Promise)
- Creates new transaction if none exists
- Returns `transactionID`, `isTransactionCreated` flag, and `reqWithTransaction`
- Used by `tryCreateActivityModule` and `tryUpdateActivityModule` to reduce code duplication

### UI Components

#### File Form Component
- Created `app/components/activity-module-forms/file-form.tsx`
- Supports file upload with drag-and-drop interface
- Displays existing media files with ability to remove
- Integrates with media upload system and respects upload limits
- Shows file previews and metadata

#### File Preview Component
- Created `app/components/activity-modules-preview/file-preview.tsx`
- Displays list of files with file type icons
- Shows file names, sizes, and download links
- Handles empty state when no files are available
- Uses shared file type utilities for consistent display

#### File Type Utilities
- Moved file type utilities to `app/routes/course/module.$id/utils.ts`
- `getFileType`: Determines file type (image, pdf, text, other) from filename and MIME type
- `getFileIcon`: Returns appropriate icon component for file type
- `formatFileSize`: Formats file size in human-readable format
- `getFileTypeLabel`: Returns user-friendly label for file type
- Shared between `FilePreview` and `AttachmentViewer` components

### Context and Type Updates

#### Course Module Context
- Added `CourseModuleFileData` type to course module context
- Includes file ID and media array with proper type handling
- Updated `CourseModule` type to include optional `file` field
- Updated `tryGetCourseModuleContext` to extract file data from activity modules

#### User Module Context
- Updated user module context to support file module type
- File data includes media array with proper type narrowing
- Supports both ID and object formats for media relationships

### Module Helper Updates

#### Icon and Color Support
- Added "file" type to `getModuleIcon` function with `IconFile` icon
- Added "indigo" color for file modules in `getModuleColor` function
- Updated type definitions to include "file" in module type unions

### Route Updates

#### Module Creation and Editing
- Updated `app/routes/user/module/new.tsx` to support file module creation
- Updated `app/routes/user/module/edit-setting.tsx` to support file module editing
- Both routes handle file uploads using multipart form data
- File uploads are processed and converted to media IDs before module creation/update

#### Module Viewing
- Updated `app/routes/course/module.$id/route.tsx` to display file modules
- Added `FilePreview` component integration for file module display
- File modules show module dates info and file list

### Media Relationship Tracking

#### Collection Updates
- Added media relationship fields to `Pages`, `Notes`, and `Courses` collections
- These fields track media used in rich text content
- Comments added explaining the purpose of these fields

## Technical Details

### Files Created

1. **`server/collections/files.ts`**
   - New Files collection definition
   - Relationship to media collection
   - CreatedBy tracking

2. **`server/internal/file-management.ts`**
   - File management internal functions
   - Error handling for file operations

3. **`server/internal/file-management.test.ts`**
   - Test suite for file management functions

4. **`server/internal/utils/handle-transaction-id.ts`**
   - Utility function for transaction ID handling
   - Reduces code duplication across internal functions

5. **`app/components/activity-module-forms/file-form.tsx`**
   - File upload form component
   - Media management UI

6. **`app/components/activity-modules-preview/file-preview.tsx`**
   - File preview component for displaying files
   - File list with download links

7. **`src/migrations/20251121_215049.ts`**
   - Migration to create files table
   - Creates files and files_rels tables

8. **`src/migrations/20251121_215303.ts`**
   - Migration to add file relationship to activity_modules
   - Updates enum type to include 'file'

### Files Modified

1. **`server/collections/activity-modules.ts`**
   - Added "file" to module type enum
   - Added file relationship field
   - Added file index

2. **`server/collections/index.ts`**
   - Exported Files collection

3. **`server/payload.config.ts`**
   - Added Files to collections array

4. **`server/internal/activity-module-management.ts`**
   - Added file module support to create/update/delete functions
   - Integrated transaction ID utility
   - Updated function signatures to include `user`, `req`, `overrideAccess`

5. **`server/contexts/course-module-context.ts`**
   - Added file data type and extraction logic

6. **`server/contexts/user-module-context.ts`**
   - Added file module support

7. **`app/utils/activity-module-schema.ts`**
   - Added file type to schema
   - Added fileMedia and fileFiles fields

8. **`app/utils/module-helper.tsx`**
   - Added file icon and color support

9. **`app/routes/course/module.$id/route.tsx`**
   - Added file module preview rendering

10. **`app/routes/course/module.$id/utils.ts`**
    - Added file type utility functions

11. **`app/components/attachment-viewer.tsx`**
    - Refactored to use shared file type utilities

12. **`app/routes/user/module/new.tsx`**
    - Added file module creation support

13. **`app/routes/user/module/edit-setting.tsx`**
    - Added file module editing support
    - Added delete functionality with linked courses check

14. **`server/payload-types.ts`**
    - Added File interface and related types

15. **`app/root.tsx`**
    - Updated user module context creation to pass request

16. **`app/components/activity-module-forms/page-form.tsx`**
    - Switched to SimpleRichTextEditor

### API Changes

#### `tryCreateActivityModule`

**Updated:**
- Now accepts `user`, `req`, and `overrideAccess` parameters
- Uses `handleTransactionId` utility for transaction management
- Supports file module creation with fileData containing media array
- Creates File entity and links it to activity module

#### `tryUpdateActivityModule`

**Updated:**
- Now accepts `user`, `req`, and `overrideAccess` parameters
- Uses `handleTransactionId` utility for transaction management
- Supports file module updates with fileData containing media array
- Updates File entity media relationships

#### `tryDeleteActivityModule`

**Updated:**
- Handles cascading deletion of File entity when deleting file module
- Deletes file entity before deleting activity module

#### `handleTransactionId` (New Utility)

**Function:**
- Centralizes transaction ID handling logic
- Accepts `payload` and optional `req`
- Returns `transactionID`, `isTransactionCreated`, and `reqWithTransaction`
- Handles Promise transaction IDs
- Creates new transaction if none exists

## Known Issues and Limitations

### Current Bugs

⚠️ **This feature is not production-ready and contains known issues:**

1. **Transaction Management**: Some edge cases in transaction handling may need refinement
2. **File Upload**: File upload flow may have issues with large files or multiple simultaneous uploads
3. **Media Relationships**: Media relationship tracking may not be fully implemented
4. **Error Handling**: Some error scenarios may not be properly handled
5. **UI/UX**: File form and preview components may need additional polish
6. **Access Control**: File access permissions may need additional validation

### Missing Features

- File versioning
- File organization/folders
- File access permissions per file
- File download tracking/analytics
- File preview for non-image files
- Bulk file operations

## User Impact

### For Instructors

#### File Module Creation
- Can create file-type activity modules
- Can upload multiple files to a single module
- Can manage existing files (add/remove)
- Files are organized and displayed to students

#### File Management
- Upload interface with drag-and-drop support
- File preview and metadata display
- Ability to remove files from modules
- Respects site upload limits

### For Students

#### File Access
- Can view list of files in file modules
- Can download files via direct links
- File type icons help identify file types
- File sizes displayed for reference

## Migration Notes

### Database Migration Required

- **Migration Command**: `bun run payload migrate`
- **New Tables**: `files` and `files_rels` tables will be created
- **Schema Changes**: `activity_modules` table will have new `file_id` column
- **Enum Update**: `enum_activity_modules_type` will include 'file' value

### Backward Compatibility

- ✅ Existing activity modules continue to work
- ✅ No data loss for existing modules
- ✅ File type is optional and doesn't affect other module types

### Post-Migration Steps

1. Run database migration: `bun run payload migrate`
2. Regenerate Payload types: `bun run payload generate:types`
3. ⚠️ **Do not use file modules in production until bugs are fixed**
4. Test file upload functionality thoroughly
5. Verify file access permissions
6. Test file deletion and module deletion workflows

## Testing Considerations

### Functional Testing (Incomplete)

- ⚠️ File module creation needs thorough testing
- ⚠️ File upload functionality needs validation
- ⚠️ File module updates need testing
- ⚠️ File module deletion needs testing
- ⚠️ Transaction handling needs edge case testing
- ⚠️ Media relationship tracking needs verification

### UI/UX Testing (Incomplete)

- ⚠️ File form component needs usability testing
- ⚠️ File preview component needs responsive design testing
- ⚠️ File upload flow needs user experience validation
- ⚠️ Error states need proper UI feedback

### Edge Cases (Not Fully Tested)

- ⚠️ Large file uploads
- ⚠️ Multiple simultaneous uploads
- ⚠️ File deletion while in use
- ⚠️ Module deletion with linked courses
- ⚠️ Transaction rollback scenarios
- ⚠️ Media relationship edge cases

## Related Features

### Activity Module System
- File modules integrate with existing activity module infrastructure
- Follows same patterns as other module types (page, whiteboard, etc.)
- Uses same access control and permission system

### Media Management
- File modules use existing media collection
- Integrates with media upload system
- Respects site upload limits and policies

### Transaction Management
- Uses new transaction ID utility for consistent transaction handling
- Supports nested transactions
- Proper rollback on errors

## Conclusion

The file activity module feature provides a foundation for instructors to share files with students. However, this feature is **not production-ready** and contains known bugs that need to be addressed. The implementation includes the core infrastructure (database schema, internal functions, UI components) but requires additional testing, bug fixes, and refinement before it can be safely used in production environments.

---

**Summary**: Added file-type activity module allowing instructors to upload and share multiple files with students. Includes new Files collection, file management functions, UI components, and transaction handling utility. **⚠️ Status: Not Ready - Contains Known Bugs - Do Not Use in Production**

