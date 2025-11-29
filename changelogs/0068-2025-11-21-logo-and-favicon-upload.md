# Logo and Favicon Upload

**Date:** 2025-11-21  
**Type:** Feature Enhancement  
**Impact:** Medium - Adds logo and favicon upload functionality with theme-aware display

## Overview

This changelog documents the addition of logo and favicon upload functionality to the appearance settings. Administrators can now upload custom logos and favicons for both light and dark themes, which are automatically displayed in the application header and browser tabs. The feature includes comprehensive media usage tracking, clear/remove functionality, and seamless integration with the existing appearance settings system.

## Key Changes

### Appearance Settings Global Updates

#### Logo Fields in AppearanceSettings
- Added 6 new relationship fields to `AppearanceSettings` global:
  - `logoLight` - Main logo for light mode
  - `logoDark` - Main logo for dark mode
  - `compactLogoLight` - Compact logo for light mode (reserved for future use)
  - `compactLogoDark` - Compact logo for dark mode (reserved for future use)
  - `faviconLight` - Favicon for light mode
  - `faviconDark` - Favicon for dark mode
- All fields are optional relationships to the "media" collection
- Each field includes descriptive labels and admin descriptions
- Fields support both ID and object formats (handles depth variations)

#### Type System Updates
- Updated `AppearanceSettings` type to include all 6 logo fields as `number | null | undefined`
- Updated `UpdateAppearanceSettingsArgs` interface to include optional logo fields
- Created `LogoField` type union for type-safe field references
- Updated Zod schema to accept both number IDs and objects with id property

### Internal Functions

#### Appearance Settings Functions
- **`tryGetAppearanceSettings`**: 
  - Updated to extract and return logo field IDs
  - Handles both object and ID formats from Payload responses
  - Includes helper function `getLogoId` for robust ID extraction
  - Returns logo IDs as `number | null | undefined`

- **`tryUpdateAppearanceSettings`**:
  - Updated to accept and persist logo field updates
  - Supports transaction handling via `req` parameter
  - Validates and updates logo fields alongside other appearance settings
  - Returns updated appearance settings with logo field IDs

- **`tryClearLogo`** (New Function):
  - Clears a specific logo field by setting it to `null`
  - Accepts `field` parameter to specify which logo to clear
  - Supports transaction handling
  - Returns updated appearance settings after clearing

#### Media Usage Tracking
- **`tryFindMediaUsages`**:
  - Extended to search `appearance-settings` global for logo usage
  - Checks all 6 logo fields (logoLight, logoDark, compactLogoLight, compactLogoDark, faviconLight, faviconDark)
  - Adds usage entries with collection: "appearance-settings" and appropriate field paths
  - Ensures logo media files are properly tracked for deletion safety

### Admin Logo Management Page

#### Route Configuration
- Added route: `admin/appearance/logo` in `app/routes.ts`
- Added `isAdminLogo` flag to `PageInfo` type in `server/contexts/global-context.ts`
- Updated route detection in `app/root.tsx` middleware
- Added logo page link in admin appearance section

#### Page Components
- **Loader**:
  - Checks admin authentication
  - Fetches current appearance settings using `tryGetAppearanceSettings`
  - Resolves media IDs to full media objects for preview display
  - Returns logo data with media URLs and upload limits

- **Action**:
  - Handles POST requests for logo uploads
  - Uses `parseFormDataWithFallback` for file upload handling
  - Validates file types (images only) and file sizes
  - Creates media using `tryCreateMedia` within transaction
  - Updates appearance settings using `tryUpdateAppearanceSettings` with transaction
  - Handles clear logo action via query parameters (`?action=clear&field=logoLight`)
  - Supports all 6 logo field types
  - Proper error handling with rollback on failure

- **Client Action**:
  - Shows success/error notifications via Mantine notifications
  - Provides user feedback for upload and clear operations
  - Returns action result for hook consumption

#### Upload Hooks
- **`useUploadLogo(field: LogoField)`**:
  - Single reusable hook for all logo uploads
  - Accepts field name as parameter (logoLight, logoDark, etc.)
  - Uses `useFetcher` for form submission
  - Returns `uploadLogo` function and loading state

- **`useClearLogo(field: LogoField)`**:
  - Hook for clearing logos
  - Submits clear action via query parameters
  - Returns `clearLogo` function and loading state

#### UI Components
- **`LogoDropzoneBase`**:
  - Reusable dropzone component for all logo types
  - Displays current logo preview inside dropzone when available
  - Shows default upload UI when no logo exists
  - Includes clear button (visible only when logo exists)
  - Handles file validation and error display
  - Respects upload size limits from site policies

- **Individual Dropzone Components**:
  - `LogoLightDropzone` - Logo for light mode
  - `LogoDarkDropzone` - Logo for dark mode
  - `CompactLogoLightDropzone` - Compact logo for light mode
  - `CompactLogoDarkDropzone` - Compact logo for dark mode
  - `FaviconLightDropzone` - Favicon for light mode
  - `FaviconDarkDropzone` - Favicon for dark mode
  - Each component uses appropriate upload and clear hooks

#### Page Layout
- 6 dropzones arranged in responsive grid (2 columns on desktop, 1 on mobile)
- Info alert explaining logo usage:
  - Logo: Displayed in header, respects theme
  - Compact Logo: Reserved for future use
  - Favicon: Appears in browser tabs/bookmarks, respects theme
- Each dropzone shows label and clear button when logo exists

### System Globals Integration

#### SystemGlobals Type Updates
- Updated `SystemGlobals` type in `server/contexts/global-context.ts`
- Added logo and favicon fields to `appearanceSettings`:
  - `logoLight?: number | null`
  - `logoDark?: number | null`
  - `compactLogoLight?: number | null`
  - `compactLogoDark?: number | null`
  - `faviconLight?: number | null`
  - `faviconDark?: number | null`

#### System Globals Function
- **`tryGetSystemGlobals`**:
  - Updated to include logo field IDs from appearance settings
  - Passes logo IDs through to system globals context
  - Available throughout application via global context

### Root Component Integration

#### Logo Display in Header
- **`app/layouts/root-layout.tsx`**:
  - Loader fetches logo media based on user's theme preference
  - Displays logo image in header instead of "Paideia LMS" text when available
  - Falls back to text if no logo is set
  - Logo positioned in left column of three-column header layout
  - Three-column layout ensures tabs remain centered regardless of logo width

#### Favicon Support
- **`app/root.tsx`**:
  - Loader fetches favicon media based on user's theme preference
  - Sets favicon in `<head>` using media file URL
  - Falls back to default favicon if none is set
  - Includes timestamp query parameter for cache busting
  - Favicon updates automatically when theme changes

#### Theme-Aware Logo Selection
- Logo and favicon selection based on user's theme preference:
  - Light theme: Uses `logoLight` and `faviconLight`
  - Dark theme: Uses `logoDark` and `faviconDark`
  - Falls back gracefully if theme-specific logo not available
  - Theme preference retrieved from user context

### Transaction Management

#### Database Transactions
- Logo upload operations use transactions for atomicity
- Media creation and appearance settings update in same transaction
- Transaction ID passed through `req` parameter to internal functions
- Proper rollback on errors
- Clear logo operations also support transactions

#### Transaction Flow
1. Begin transaction in action handler
2. Create media record with transaction ID
3. Update appearance settings with transaction ID
4. Commit transaction on success
5. Rollback transaction on any error

## Technical Details

### Files Modified

1. **`server/collections/globals.ts`**
   - Added 6 logo relationship fields to `AppearanceSettings` global

2. **`server/internal/appearance-settings.ts`**
   - Updated types and interfaces for logo fields
   - Updated Zod schema to handle logo fields
   - Added `tryClearLogo` function
   - Updated `tryGetAppearanceSettings` to extract logo IDs
   - Updated `tryUpdateAppearanceSettings` to handle logo updates with transactions

3. **`server/internal/media-management.ts`**
   - Extended `tryFindMediaUsages` to check appearance-settings global
   - Searches all 6 logo fields for media usage tracking

4. **`server/contexts/global-context.ts`**
   - Added logo fields to `SystemGlobals` type
   - Added `isAdminLogo` to `PageInfo` type

5. **`server/internal/system-globals.ts`**
   - Updated to include logo field IDs in appearance settings

6. **`app/routes.ts`**
   - Added `admin/appearance/logo` route

7. **`app/root.tsx`**
   - Added logo and favicon fetching in loader
   - Added favicon link in `<head>` with theme support
   - Updated default appearance settings to include logo fields

8. **`app/layouts/root-layout.tsx`**
   - Added logo fetching in loader
   - Updated header to display logo image
   - Implemented three-column layout for centered tabs

9. **`app/routes/admin/appearance/logo.tsx`** (New File)
   - Complete logo management page with loader, action, client action
   - 6 dropzone components with upload and clear functionality
   - Upload and clear hooks

10. **`app/layouts/server-admin-layout.tsx`**
    - Updated tab detection to include logo page

11. **`app/routes/admin/index.tsx`**
    - Added logo page link in appearance section

12. **`server/index.ts`**
    - Updated default appearance settings to include logo fields

### Data Flow

#### Logo Upload Flow
1. User drops file in dropzone
2. `useUploadLogo` hook submits form data with field name
3. Action handler receives file via `parseFormDataWithFallback`
4. Transaction begins
5. Media created using `tryCreateMedia` with transaction ID
6. Appearance settings updated using `tryUpdateAppearanceSettings` with transaction ID
7. Transaction commits
8. Success notification shown
9. Page revalidates to show new logo

#### Logo Clear Flow
1. User clicks clear button
2. `useClearLogo` hook submits clear action
3. Action handler processes clear request
4. `tryClearLogo` sets logo field to `null`
5. Success notification shown
6. Page revalidates to remove logo

#### Logo Display Flow
1. Root loader fetches system globals
2. Gets logo media ID based on user theme
3. Fetches media object if ID exists
4. Passes logo media to root layout
5. Root layout displays logo in header
6. Logo updates when theme changes

#### Favicon Display Flow
1. Root loader fetches system globals
2. Gets favicon media ID based on user theme
3. Fetches media object if ID exists
4. Sets favicon link in `<head>` with media URL
5. Favicon updates when theme changes

## User Impact

### For Administrators

#### Logo Management
- Can upload logos for light and dark themes
- Can upload favicons for light and dark themes
- Can clear/remove logos and favicons
- Visual preview of current logos in dropzones
- Clear instructions on logo usage
- Upload size limits enforced from site policies

#### Branding Control
- Full control over application branding
- Theme-aware logo display
- Professional appearance customization
- Easy logo replacement workflow

### For All Users

#### Visual Experience
- Custom logos displayed in application header
- Theme-appropriate logos automatically shown
- Custom favicons in browser tabs and bookmarks
- Consistent branding across application
- Professional appearance

#### Theme Integration
- Logos automatically switch based on user's theme preference
- Seamless transition between light and dark modes
- No manual intervention required
- Respects user's visual preferences

## Migration Notes

### Database Migration Required

- **Migration Command**: `bun run payload migrate:create`
- Creates migration to add logo relationship columns to `appearance_settings` table
- Migration will:
  - Add 6 new relationship columns (logo_light_id, logo_dark_id, etc.)
  - Set columns as nullable (optional)
  - Add foreign key constraints to `media` table
  - Ensure referential integrity

### Backward Compatibility

- ✅ Existing appearance settings preserved
- ✅ No data loss or breaking changes
- ✅ All existing functionality maintained
- ✅ Logo fields are optional, so no required data migration
- ✅ Migration is non-breaking and safe to apply

### Post-Migration Steps

1. Run database migration: `bun run payload migrate`
2. Regenerate Payload types: `bun run payload generate:types`
3. Logo fields will be `null` by default
4. Administrators can upload logos via admin interface
5. Logos will appear in header and favicon once uploaded

## Testing Considerations

### Functional Testing

- ✅ Verify logo upload for all 6 logo types
- ✅ Test logo display in header (light and dark themes)
- ✅ Test favicon display in browser (light and dark themes)
- ✅ Verify logo clearing functionality
- ✅ Test transaction rollback on errors
- ✅ Verify media usage tracking for logos
- ✅ Test file size validation
- ✅ Test file type validation (images only)
- ✅ Verify theme-based logo selection
- ✅ Test fallback behavior when logo not set

### UI/UX Testing

- ✅ Verify dropzone UI for all logo types
- ✅ Test logo preview in dropzones
- ✅ Verify clear button visibility and functionality
- ✅ Test responsive layout (mobile and desktop)
- ✅ Verify three-column header layout
- ✅ Test logo alignment in header
- ✅ Verify favicon display in browser
- ✅ Test theme switching with logos

### Edge Cases

- ✅ Missing logo: Falls back to text "Paideia LMS"
- ✅ Missing favicon: Falls back to default favicon
- ✅ Invalid file type: Rejected with error message
- ✅ File too large: Rejected with size limit message
- ✅ Transaction failure: Proper rollback
- ✅ Media not found: Graceful handling
- ✅ Theme change: Logo updates automatically
- ✅ Unauthenticated user: No logo displayed (defaults)

## Media Usage Tracking

### Logo Media Tracking
- Logo media files are tracked in media usage system
- Prevents accidental deletion of logos in use
- Shows usage in appearance-settings global
- Field paths indicate which logo field uses the media
- Supports safe media cleanup operations

### Integration with Media Management
- Logo uploads create media records
- Media records linked to appearance settings
- Usage tracking prevents orphaned media
- Clear logo operation removes usage reference
- Media can be safely deleted when not in use

## Future Enhancements

### Potential Improvements

- **Compact Logo Usage**: Implement compact logo display in specific contexts
- **Logo Positioning**: Allow configuration of logo position in header
- **Logo Size Limits**: Configurable max dimensions for logos
- **Multiple Logo Formats**: Support for SVG, WebP, etc.
- **Logo Animation**: Support for animated logos (GIF, etc.)
- **Logo Preview**: Live preview of logo in header before saving
- **Bulk Logo Operations**: Upload/clear multiple logos at once
- **Logo History**: Version history for logo changes
- **Logo Templates**: Pre-configured logo templates
- **Auto-optimization**: Automatic image optimization on upload

## Related Features

### Appearance Settings
- Logo management is part of unified appearance settings
- Works alongside theme settings (color, radius)
- Integrates with additional CSS stylesheets
- Follows same patterns as other appearance settings

### Media Management
- Logo uploads use existing media management system
- Leverages media usage tracking
- Follows same file upload patterns
- Integrates with S3 storage

### Theme Settings
- Logos respect user theme preferences
- Automatic theme-based logo selection
- Seamless integration with light/dark mode
- Works alongside color and radius settings

## Conclusion

The addition of logo and favicon upload functionality provides administrators with comprehensive branding control over the application. The feature supports theme-aware logo display, ensuring appropriate logos are shown based on user preferences. The implementation includes proper media usage tracking, transaction management, and a user-friendly interface for managing logos. The feature is well-integrated with existing systems and maintains full backward compatibility.

---

**Summary**: Added logo and favicon upload functionality with support for light and dark themes. Administrators can upload 6 different images (logo, compact logo, and favicon for each theme) through a dedicated admin page. Logos are displayed in the application header, and favicons appear in browser tabs, both automatically switching based on the user's theme preference. The feature includes clear/remove functionality and proper media usage tracking.

