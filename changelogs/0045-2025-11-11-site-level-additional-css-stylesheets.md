# Changelog 0045: Site-Level Additional CSS Stylesheets

**Date**: November 11, 2025  
**Type**: Feature Addition  
**Impact**: Medium - Adds ability for administrators to configure multiple external CSS stylesheets that are automatically injected into all pages, similar to Moodle's appearance customization

## Overview

Implemented site-level CSS stylesheet management that allows administrators to configure multiple external CSS stylesheet URLs. These stylesheets are automatically injected into the HTML `<head>` of all pages, enabling site-wide appearance customization without modifying core code. The feature includes a dedicated admin page for managing stylesheets with add/remove/reorder functionality, URL validation, and proper integration with the existing system globals architecture.

## Features Added

### 1. Appearance Settings Global Collection

**Features**:
- New `AppearanceSettings` global collection for site-wide CSS configuration
- Array field for multiple stylesheet URLs
- URL validation (HTTP/HTTPS only)
- Supports ordering of stylesheets for CSS cascade control

**Implementation**:
- Created `server/collections/globals.ts`:
  - **`AppearanceSettings` global**:
    - `additionalCssStylesheets`: Array of objects with `url` field
      - Each URL must be a valid HTTP or HTTPS URL
      - Field-level validation ensures proper URL format
      - Default: empty array
      - Admin description explains cascade precedence

- Updated `server/payload.config.ts`:
  - Added `AppearanceSettings` to globals array
  - Imported from `./collections/globals`

**Benefits**:
- ✅ Centralized configuration for site appearance
- ✅ Type-safe with validation
- ✅ Easy to extend with more appearance settings in the future

### 2. Appearance Settings Internal Functions

**Features**:
- Functions to read and update appearance settings
- URL validation before saving
- Graceful error handling with defaults
- Follows TypeScript Result pattern

**Implementation**:
- Created `server/internal/appearance-settings.ts`:
  - **`tryGetAppearanceSettings`** function:
    - Reads appearance settings from global collection
    - Returns array of stylesheet URLs (extracted from objects)
    - Defaults to empty array on error or missing data
    - Uses `overrideAccess: true` for system requests
  - **`tryUpdateAppearanceSettings`** function:
    - Updates appearance settings in global collection
    - Validates all URLs before saving (HTTP/HTTPS only)
    - Throws descriptive errors for invalid URLs
    - Returns updated settings with extracted URLs
  - **Type Definitions**:
    ```typescript
    export type AppearanceSettings = {
      additionalCssStylesheets: string[];
    };
    ```

**Benefits**:
- ✅ Consistent with other global settings functions
- ✅ Proper error handling and validation
- ✅ Type-safe operations

### 3. System Globals Integration

**Features**:
- Appearance settings included in unified system globals
- Fetched in parallel with other globals for efficiency
- Available throughout the application via context

**Implementation**:
- Updated `server/internal/system-globals.ts`:
  - Added `appearanceSettings` to `SystemGlobals` type:
    ```typescript
    appearanceSettings: {
      additionalCssStylesheets: string[];
    };
    ```
  - Updated `tryGetSystemGlobals` to fetch appearance settings in parallel:
    - Added `tryGetAppearanceSettings` to `Promise.all` array
    - Defaults to empty array if fetch fails
  - All three globals (maintenance, site policies, appearance) now fetched together

- Updated `server/contexts/global-context.ts`:
  - Updated `SystemGlobals` type to include `appearanceSettings`
  - Ensures type consistency across the application

**Benefits**:
- ✅ Efficient parallel fetching
- ✅ Consistent with existing architecture
- ✅ Easy to access appearance settings anywhere in the app

### 4. Admin Appearance Management Page

**Features**:
- Dedicated admin page for managing CSS stylesheets
- Add/remove stylesheet URLs
- Reorder stylesheets (up/down buttons)
- URL validation with error messages
- Empty state handling
- Form submission with loading states

**Implementation**:
- Created `app/routes/admin/appearance.tsx`:
  - **Loader**:
    - Fetches current appearance settings
    - Requires admin authentication
    - Returns settings for form initialization
  - **Action**:
    - Handles form submission
    - Parses JSON data from FormData
    - Validates input using Zod schema
    - Updates appearance settings via `tryUpdateAppearanceSettings`
    - Returns success/error response
  - **Client Action**:
    - Shows success/error notifications
    - Handles form submission feedback
  - **Component**:
    - Uses Mantine `useForm` in uncontrolled mode
    - Dynamic list of stylesheet inputs
    - Add button to insert new stylesheet
    - Remove button for each stylesheet
    - Up/Down buttons for reordering
    - URL validation with visual feedback
    - Empty state message when no stylesheets
    - Save button with loading state

**UI Features**:
- Text input for each stylesheet URL
- Placeholder: "https://example.com/style.css"
- Inline URL validation (checks for HTTP/HTTPS)
- Action buttons (up, down, delete) for each stylesheet
- Disabled state for up button on first item
- Disabled state for down button on last item
- Visual feedback for invalid URLs

**Benefits**:
- ✅ Intuitive interface for managing stylesheets
- ✅ Order control for CSS cascade
- ✅ Real-time validation feedback
- ✅ Consistent with other admin pages

### 5. CSS Injection in Root Layout

**Features**:
- Automatic injection of configured stylesheets into all pages
- Stylesheets loaded in configured order
- Placed after Mantine styles but before page content
- Graceful handling when no stylesheets configured

**Implementation**:
- Updated `app/root.tsx`:
  - **Loader**:
    - Extracts `additionalCssStylesheets` from `systemGlobals`
    - Passes to component via loader data
    - Available in both early return and normal return paths
  - **App Component**:
    - Reads `additionalCssStylesheets` from loader data
    - Maps over array to render `<link>` tags
    - Places stylesheets after highlight.js stylesheet
    - Before development scripts and Meta/Links components
    - Each stylesheet gets unique `key` prop (URL)

**CSS Loading Order**:
1. Mantine core styles (via `@mantine/core/styles.css` import)
2. Highlight.js stylesheet (theme-aware)
3. **Additional CSS stylesheets (in configured order)** ← New
4. Page-specific styles

**Benefits**:
- ✅ Stylesheets load in correct order
- ✅ Cascade precedence controlled by admin
- ✅ No code changes needed to add stylesheets
- ✅ Works on all pages automatically

### 6. Route and Navigation Integration

**Features**:
- New admin route for appearance page
- Integrated with admin layout tabs
- Added to admin dashboard index
- Page info detection for proper tab highlighting

**Implementation**:
- Updated `app/routes.ts`:
  - Added route: `route("admin/appearance", "routes/admin/appearance.tsx")`
  - Placed within `server-admin-layout` layout

- Updated `app/root.tsx` middleware:
  - Added `isAdminAppearance` flag detection
  - Checks for route ID: `"routes/admin/appearance"`
  - Added to `pageInfo` object

- Updated `server/contexts/global-context.ts`:
  - Added `isAdminAppearance: boolean` to `PageInfo` interface

- Updated `server/index.ts`:
  - Added `isAdminAppearance: false` to initial `pageInfo`

- Updated `app/layouts/server-admin-layout.tsx`:
  - Added `isAdminAppearance` check in `getCurrentTab()`
  - Maps to `AdminTab.Appearance` tab
  - Ensures correct tab is highlighted when on appearance page

- Updated `app/routes/admin/index.tsx`:
  - Added "Additional CSS" link in appearance section
  - Link: `href("/admin/appearance")`
  - Placed after "Additional HTML" item

**Benefits**:
- ✅ Properly integrated into admin navigation
- ✅ Easy to discover and access
- ✅ Consistent with other admin pages
- ✅ Correct tab highlighting

## Technical Details

### URL Validation

The system validates URLs at multiple levels:
1. **Field-level validation** (Payload CMS):
   - Validates URL format using JavaScript `URL` constructor
   - Ensures protocol is HTTP or HTTPS
   - Returns descriptive error messages

2. **Server-side validation** (`tryUpdateAppearanceSettings`):
   - Validates all URLs before saving
   - Checks protocol (HTTP/HTTPS only)
   - Throws errors for invalid URLs
   - Prevents invalid data from being saved

3. **Client-side validation** (Form):
   - Real-time validation feedback
   - Checks URL format using regex
   - Shows error message below input
   - Prevents form submission with invalid URLs

### CSS Cascade Precedence

Stylesheets are loaded in the order they are configured:
- First stylesheet in list loads first
- Subsequent stylesheets load in order
- Later stylesheets can override earlier ones
- Admin controls cascade through ordering UI

This allows admins to:
- Load base styles first
- Load theme overrides second
- Load customizations last (highest priority)

### Form Data Handling

The admin page uses FormData with JSON serialization:
- Stylesheets array serialized as JSON string
- Server parses JSON string back to array
- Handles both string and already-parsed data
- Uses `getDataAndContentTypeFromRequest` utility

### Error Handling

All operations use TypeScript Result pattern:
- `tryGetAppearanceSettings` returns `Result<AppearanceSettings>`
- `tryUpdateAppearanceSettings` returns `Result<AppearanceSettings>`
- Errors are properly typed and transformed
- Client receives clear error messages via notifications

### Default Behavior

When appearance settings cannot be loaded:
- Defaults to empty array (no stylesheets)
- System continues to function normally
- No errors thrown to user
- Fail-open approach for resilience

## Testing

### Manual Testing Steps

1. **Access Admin Appearance Page**:
   - Log in as administrator
   - Navigate to Admin → Appearance → Additional CSS
   - Or directly visit `/admin/appearance`
   - Verify page loads correctly
   - Verify "Appearance" tab is highlighted

2. **Add Stylesheets**:
   - Click "Add Stylesheet" button
   - Enter a valid URL: `https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css`
   - Verify no validation errors appear
   - Add another stylesheet: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`
   - Verify both stylesheets appear in list

3. **Reorder Stylesheets**:
   - Click "Up" button on second stylesheet
   - Verify it moves to first position
   - Click "Down" button
   - Verify it moves back to second position
   - Verify order persists after page reload

4. **URL Validation**:
   - Try entering invalid URL: `not-a-url`
   - Verify error message appears: "Must be a valid HTTP or HTTPS URL"
   - Try entering non-HTTP URL: `ftp://example.com/style.css`
   - Verify error message appears
   - Enter valid URL and verify error disappears

5. **Remove Stylesheets**:
   - Click delete (trash icon) on a stylesheet
   - Verify it is removed from list
   - Remove all stylesheets
   - Verify empty state message appears: "No stylesheets configured..."

6. **Save Changes**:
   - Add 2-3 valid stylesheets
   - Click "Save changes" button
   - Verify success notification appears
   - Verify page reloads with saved stylesheets
   - Verify stylesheets persist after browser refresh

7. **Verify CSS Injection**:
   - After saving stylesheets, navigate to any page (e.g., dashboard, course page)
   - Open browser DevTools → Network tab
   - Filter by "CSS"
   - Verify configured stylesheets are loaded
   - Verify stylesheets load in correct order (check Network tab timing)
   - Verify stylesheets appear in HTML `<head>` section
   - Verify stylesheets load after Mantine styles

8. **Test CSS Application**:
   - Add a stylesheet that changes visible styles (e.g., Bootstrap or custom CSS)
   - Verify styles are applied to the page
   - Verify styles override Mantine defaults if intended
   - Test on multiple pages to ensure global application

9. **Error Handling**:
   - Try saving with invalid URL
   - Verify error notification appears
   - Verify stylesheets are not saved
   - Verify form retains entered data

10. **Empty State**:
    - Remove all stylesheets
    - Save changes
    - Verify empty state persists
    - Verify no CSS errors in console
    - Verify pages still load correctly

### Automated Testing

- ✅ Unit tests for `tryGetAppearanceSettings` function (recommended)
- ✅ Unit tests for `tryUpdateAppearanceSettings` function (recommended)
- ✅ Integration tests for admin page loader/action (recommended)
- ✅ E2E tests for stylesheet management workflow (recommended)

### Test Scenarios

1. **Multiple Stylesheets**:
   - Add 5+ stylesheets
   - Verify all load correctly
   - Verify order is maintained

2. **Very Long URLs**:
   - Add stylesheet with very long URL (200+ characters)
   - Verify it saves and loads correctly

3. **Special Characters in URLs**:
   - Add stylesheet with query parameters: `https://example.com/style.css?v=1.0&theme=dark`
   - Verify it saves and loads correctly

4. **CDN URLs**:
   - Add stylesheets from various CDNs (jsDelivr, cdnjs, unpkg)
   - Verify all load correctly
   - Verify CORS headers don't block loading

5. **Performance**:
   - Add 10+ stylesheets
   - Verify page load performance
   - Verify stylesheets load in parallel (check Network tab)

## Migration Notes

**Database migration required**: `20251111_220007`

The migration creates:
1. `appearance_settings` table - Main global table
2. `appearance_settings_additional_css_stylesheets` table - Array relationship table for stylesheet URLs
3. Initial global record - Creates the initial `appearance_settings` record with an empty `additionalCssStylesheets` array

The migration uses `payload.updateGlobal` to create the initial record, ensuring the global exists when the system tries to read it. This prevents errors when accessing appearance settings before any admin configuration.

**To apply the migration**:
```bash
bun run payload migrate
```

The system will default to an empty array if the global doesn't exist, but the migration ensures proper initialization.

## Files Changed

### New Files
- `server/internal/appearance-settings.ts` - Internal functions for appearance settings
- `app/routes/admin/appearance.tsx` - Admin page for managing CSS stylesheets

### Modified Files
- `server/collections/globals.ts` - Added `AppearanceSettings` global collection
- `server/payload.config.ts` - Added `AppearanceSettings` to globals array
- `server/internal/system-globals.ts` - Added `appearanceSettings` to `SystemGlobals` type and fetch logic
- `server/contexts/global-context.ts` - Updated `SystemGlobals` type and added `isAdminAppearance` to `PageInfo`
- `app/routes.ts` - Added `admin/appearance` route
- `app/root.tsx` - Added `isAdminAppearance` detection, CSS injection in `<head>`, and loader data
- `server/index.ts` - Added default `appearanceSettings` and `isAdminAppearance` initialization
- `app/layouts/server-admin-layout.tsx` - Added appearance page tab detection
- `app/routes/admin/index.tsx` - Added "Additional CSS" link in appearance section
- `src/migrations/20251111_220007.ts` - Added data migration to create initial global record

## Future Enhancements

Potential improvements for future iterations:
- Preview stylesheet before adding (fetch and validate)
- Test stylesheet loading (verify URL is accessible)
- Stylesheet grouping/categorization
- Conditional loading (e.g., only on specific pages)
- Inline CSS editor (not just external URLs)
- Stylesheet versioning/pinning
- Import/export stylesheet configurations
- Stylesheet performance monitoring
- Dark mode specific stylesheets

