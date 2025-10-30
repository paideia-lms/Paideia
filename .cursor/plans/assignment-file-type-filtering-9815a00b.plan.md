<!-- 9815a00b-95ae-4294-a861-9cf26cc404c6 935ffba0-ec45-41ed-959f-f98bec0d5b61 -->
# Assignment File Type Filtering

## Overview

Implement file type filtering for assignment submissions similar to Moodle, with both preset common file types and custom type support, server-side validation, and extracted default constants.

## Implementation Steps

### 1. Create Default File Types Constant

Create a new constants file `app/utils/file-types.ts` with:

- `DEFAULT_ALLOWED_FILE_TYPES` constant containing preset options (PDF, DOCX, PNG, JPEG, etc.)
- Type definitions for file type objects: `{ extension: string; mimeType: string; label: string }`
- Helper function to get MIME types array for Dropzone

### 2. Update Activity Module Schema

In `app/utils/activity-module-schema.ts`:

- Add `assignmentAllowedFileTypes` field to schema with array of file type objects
- Add `assignmentMaxFileSize` and `assignmentMaxFiles` fields
- Update `ActivityModuleFormValues` type to include these fields
- Update `getInitialFormValues()` to initialize with empty array
- Update `transformToActivityData()` to include file type fields in `assignmentData`

### 3. Update Assignment Form UI

In `app/components/activity-module-forms/assignment-form.tsx`:

- Conditionally render file configuration section when `requireFileSubmission` is true
- Add MultiSelect for preset file types (from constants)
- Add dynamic array input to add custom file types (extension + MIME type pairs)
- Add NumberInput for `maxFileSize` (MB) and `maxFiles`
- Show combined list of selected preset + custom file types

### 4. Update Assignments Collection

In `server/collections/assignments.ts`:

- Ensure `allowedFileTypes`, `maxFileSize`, and `maxFiles` fields are properly configured
- Fields already exist, no changes needed

### 5. Update Activity Module Management

In `server/internal/activity-module-management.ts`:

- Update `CreateAssignmentModuleArgs` type to include file type fields
- Update `UpdateAssignmentModuleArgs` type to include file type fields
- In `tryCreateActivityModule()`: Pass file type configuration to assignment creation (lines 286-304)
- In `tryUpdateActivityModule()`: Pass file type configuration to assignment update (lines 663-692)

### 6. Update Assignment Preview Dropzone

In `app/components/activity-modules-preview/assignment-preview.tsx`:

- Import `DEFAULT_ALLOWED_FILE_TYPES` constant
- Update `FileUploadZone` component (lines 82-167):
- Use `assignment.allowedFileTypes` if defined
- Map to MIME types array for Dropzone `accept` prop
- Fallback to `DEFAULT_ALLOWED_FILE_TYPES` MIME types if not configured
- Display allowed file types to user

### 7. Add Server-Side Validation

In `server/internal/assignment-submission-management.ts`:

- In `tryCreateAssignmentSubmission()` (lines 67-192):
- Validate uploaded file MIME types against assignment's `allowedFileTypes`
- Check file size against `maxFileSize`
- Check file count against `maxFiles`
- Throw `InvalidArgumentError` if validation fails
- In `tryUpdateAssignmentSubmission()` (lines 269-345):
- Add same validation when attachments are updated

### 8. Update Route Handlers

Update route handlers that create/update activity modules to pass file type configuration from form data to internal functions.

## Files to Modify

- `app/utils/file-types.ts` (new file)
- `app/utils/activity-module-schema.ts`
- `app/components/activity-module-forms/assignment-form.tsx`
- `app/components/activity-modules-preview/assignment-preview.tsx`
- `server/internal/activity-module-management.ts`
- `server/internal/assignment-submission-management.ts`
- Route handlers for assignment module creation/update

### To-dos

- [ ] Create app/utils/file-types.ts with DEFAULT_ALLOWED_FILE_TYPES constant and helper functions
- [ ] Update app/utils/activity-module-schema.ts to include file type configuration fields
- [ ] Update app/components/activity-module-forms/assignment-form.tsx to show file type configuration UI when requireFileSubmission is true
- [ ] Update server/internal/activity-module-management.ts to handle file type configuration in create and update operations
- [ ] Update app/components/activity-modules-preview/assignment-preview.tsx dropzone to use configured or default file types
- [ ] Add server-side file validation in server/internal/assignment-submission-management.ts
- [ ] Test file type filtering: preset selection, custom types, dropzone filtering, and server-side validation