# Changelog 0049: Site-Level Analytics Scripts

**Date**: November 13, 2025  
**Type**: Feature Addition  
**Impact**: Medium - Adds ability for administrators to configure multiple external JavaScript analytics scripts that are automatically injected into all pages, supporting popular analytics providers like Plausible, Umami, Google Analytics, and Fathom

## Overview

Implemented site-level analytics script management that allows administrators to configure multiple external JavaScript script tags with support for various analytics providers. Scripts are automatically injected into the HTML `<head>` of all pages, enabling site-wide analytics tracking without modifying core code. The feature includes comprehensive security validation to prevent malicious script injection, a dedicated admin page for managing scripts with add/remove/reorder functionality, and proper integration with the existing system globals architecture.

## Features Added

### 1. Analytics Settings Global Collection

**Features**:
- New `AnalyticsSettings` global collection for site-wide analytics configuration
- Array field for multiple script configurations
- Support for script attributes: `src`, `defer`, `async`
- Support for analytics provider-specific data attributes:
  - `dataWebsiteId` (Umami) → rendered as `data-website-id`
  - `dataDomain` (Plausible) → rendered as `data-domain`
  - `dataSite` (Fathom) → rendered as `data-site`
  - `dataMeasurementId` (Google Analytics) → rendered as `data-measurement-id`
- URL validation (HTTP/HTTPS only)
- Supports ordering of scripts for load sequence control

**Implementation**:
- Created `server/collections/globals.ts`:
  - **`AnalyticsSettings` global**:
    - `additionalJsScripts`: Array of script configuration objects
      - `src`: Required script URL (must be valid HTTP/HTTPS URL)
      - `defer`: Optional boolean for deferred script execution
      - `async`: Optional boolean for asynchronous script loading
      - `dataWebsiteId`: Optional string for Umami website ID
      - `dataDomain`: Optional string for Plausible domain
      - `dataSite`: Optional string for Fathom site ID
      - `dataMeasurementId`: Optional string for Google Analytics measurement ID
      - Default: empty array
      - Admin descriptions explain each field's purpose

- Updated `server/payload.config.ts`:
  - Added `AnalyticsSettings` to globals array
  - Imported from `./collections/globals`

**Benefits**:
- ✅ Centralized configuration for site analytics
- ✅ Type-safe with validation
- ✅ Easy to extend with more analytics providers in the future
- ✅ Supports multiple analytics providers simultaneously

### 2. Script Tag Validation System

**Features**:
- Comprehensive security validation using `cheerio` HTML parser
- Prevents malicious script injection
- Validates script tag structure and attributes
- Rejects inline scripts (only external scripts with `src` allowed)
- Validates URL protocol (HTTP/HTTPS only)
- Blocks dangerous attributes (`onerror`, `onload`, `onclick`, `integrity`, `crossorigin`)
- Allows only safe attributes (`src`, `defer`, `async`, `data-*`)

**Implementation**:
- Created `server/internal/utils/validate-script-tag.ts`:
  - **`tryValidateScriptTag` function**:
    - Parses HTML script tag using `cheerio`
    - Validates script tag structure (exactly one script tag)
    - Rejects inline scripts (no script content allowed)
    - Requires `src` attribute
    - Validates URL format and protocol (HTTP/HTTPS only)
    - Checks for dangerous attributes and blocks them
    - Allows only safe attributes: `src`, `defer`, `async`, and `data-*` attributes
    - Returns `Result<ScriptTagAttributes>` with validated attributes
    - Uses `ScriptValidationError` for specific error messages

- Created `server/internal/utils/validate-script-tag.test.ts`:
  - Comprehensive test suite with 30+ test cases
  - Tests valid script tags with various attributes
  - Tests invalid script tags (inline scripts, missing src, dangerous attributes)
  - Tests edge cases (empty strings, multiple scripts, invalid URLs)
  - Tests data attribute handling

**Security Features**:
- ✅ No inline scripts allowed (prevents XSS attacks)
- ✅ Only external scripts with `src` attribute permitted
- ✅ URL protocol validation (HTTP/HTTPS only)
- ✅ Dangerous attribute blocking
- ✅ HTML entity encoding for attribute values

**Benefits**:
- ✅ Prevents malicious script injection
- ✅ Ensures only safe, external scripts are loaded
- ✅ Clear error messages for invalid scripts
- ✅ Comprehensive test coverage

### 3. Analytics Settings Internal Functions

**Features**:
- Functions to read and update analytics settings
- Script tag validation before saving
- Graceful error handling with defaults
- Follows TypeScript Result pattern
- Proper transaction support via `req` parameter

**Implementation**:
- Created `server/internal/analytics-settings.ts`:
  - **`GetAnalyticsSettingsArgs` interface**:
    - `payload: Payload`
    - `user?: User | null`
    - `req?: Partial<PayloadRequest>`
    - `overrideAccess?: boolean`

  - **`UpdateAnalyticsSettingsArgs` interface**:
    - `payload: Payload`
    - `user: User`
    - `data: { additionalJsScripts?: Array<...> }`
    - `req?: Partial<PayloadRequest>`
    - `overrideAccess?: boolean`

  - **`tryGetAnalyticsSettings` function**:
    - Reads analytics settings from global collection
    - Returns raw Payload global data
    - Defaults to empty array on error or missing data
    - Uses `overrideAccess: true` for system requests

  - **`tryUpdateAnalyticsSettings` function**:
    - Updates analytics settings in global collection
    - Accepts script configurations with camelCase data attributes
    - Passes `req` parameter for transaction support
    - Returns updated Payload global data
    - Note: Validation is performed in the route action, not in this function

**Benefits**:
- ✅ Consistent with other global settings functions
- ✅ Proper error handling and validation
- ✅ Type-safe operations
- ✅ Transaction support enabled

### 4. System Globals Integration

**Features**:
- Analytics settings included in unified system globals
- Fetched in parallel with other globals for efficiency
- Available throughout the application via context

**Implementation**:
- Updated `server/internal/system-globals.ts`:
  - Added `analyticsSettings` to `SystemGlobals` type:
    ```typescript
    analyticsSettings: {
      additionalJsScripts: Array<{
        src: string;
        defer?: boolean;
        async?: boolean;
        dataWebsiteId?: string;
        dataDomain?: string;
        dataSite?: string;
        dataMeasurementId?: string;
        [key: `data-${string}`]: string | undefined;
      }>;
    };
    ```
  - Updated `tryGetSystemGlobals` to fetch analytics settings in parallel:
    - Added `tryGetAnalyticsSettings` to `Promise.all` array
    - Defaults to empty array if fetch fails
  - All four globals (maintenance, site policies, appearance, analytics) now fetched together

- Updated `server/contexts/global-context.ts`:
  - Updated `SystemGlobals` type to include `analyticsSettings`
  - Ensures type consistency across the application

**Benefits**:
- ✅ Efficient parallel fetching
- ✅ Consistent with existing architecture
- ✅ Easy to access analytics settings anywhere in the app

### 5. Admin Analytics Management Page

**Features**:
- Dedicated admin page for managing analytics scripts
- Add/remove script configurations
- Reorder scripts (up/down buttons)
- URL validation with error messages
- Support for all script attributes (defer, async, data attributes)
- Empty state handling
- Form submission with loading states
- Reactive form updates using `useFormWatchForceUpdate`

**Implementation**:
- Created `app/routes/admin/analytics.tsx`:
  - **Loader**:
    - Fetches current analytics settings
    - Requires admin authentication
    - Transforms raw Payload data to form format
    - Returns settings for form initialization

  - **Action**:
    - Handles form submission
    - Parses JSON data from request
    - Validates input using Zod schema
    - Validates each script tag using `tryValidateScriptTag`
    - Constructs script tag HTML for validation
    - Converts camelCase data attributes to kebab-case for validation
    - Updates analytics settings via `tryUpdateAnalyticsSettings`
    - Passes `req` parameter for transaction support
    - Returns success/error response

  - **Client Action**:
    - Shows success/error notifications
    - Handles form submission feedback

  - **Component**:
    - Uses Mantine `useForm` in uncontrolled mode
    - Dynamic list of script configuration cards
    - `AnalyticsScriptCard` component for individual script configuration
    - Add button to insert new script
    - Remove button for each script
    - Up/Down buttons for reordering
    - URL validation with visual feedback
    - Fields for all script attributes:
      - Script URL (required)
      - Defer checkbox
      - Async checkbox
      - Data Website ID (for Umami)
      - Data Domain (for Plausible)
      - Data Site (for Fathom)
      - Data Measurement ID (for Google Analytics)
    - Empty state message when no scripts
    - Save button with loading state

**UI Features**:
- `AnalyticsScriptCard` component:
  - Card layout with border and padding
  - Script number indicator
  - Action buttons (up, down, delete) in header
  - Text input for script URL with validation
  - Checkboxes for defer and async
  - Text inputs for data attributes with placeholders
  - Disabled state for up button on first item
  - Disabled state for down button on last item
  - Visual feedback for invalid URLs

**Benefits**:
- ✅ Intuitive interface for managing analytics scripts
- ✅ Order control for script load sequence
- ✅ Real-time validation feedback
- ✅ Consistent with other admin pages
- ✅ Supports multiple analytics providers

### 6. Script Injection in Root Layout

**Features**:
- Automatic injection of configured scripts into all pages
- Scripts loaded in configured order
- Placed in HTML `<head>` section
- Proper attribute conversion (camelCase → kebab-case)
- Graceful handling when no scripts configured
- Extracted into reusable `AnalyticsScripts` component

**Implementation**:
- Updated `app/root.tsx`:
  - **Loader**:
    - Extracts `additionalJsScripts` from `systemGlobals`
    - Passes to component via loader data
    - Available in both early return and normal return paths

  - **App Component**:
    - Reads `additionalJsScripts` from loader data
    - Uses `AnalyticsScripts` component to render scripts
    - Component handles attribute conversion and rendering

  - **AnalyticsScripts Component**:
    - Accepts `scripts` array prop
    - Maps over array to render `<script>` tags
    - Converts camelCase data attributes to kebab-case HTML attributes:
      - `dataWebsiteId` → `data-website-id`
      - `dataDomain` → `data-domain`
      - `dataSite` → `data-site`
      - `dataMeasurementId` → `data-measurement-id`
    - Handles `defer` and `async` boolean attributes
    - Supports any other `data-*` attributes
    - Each script gets unique `key` prop (`${script.src}-${index}`)
    - Places scripts after CSS stylesheets but before development scripts

**Script Loading Order**:
1. Mantine core styles
2. Highlight.js stylesheet
3. Additional CSS stylesheets (in configured order)
4. **Additional JavaScript scripts (in configured order)** ← New
5. Development scripts (if in development mode)
6. Meta/Links components

**Benefits**:
- ✅ Scripts load in correct order
- ✅ Proper HTML attribute format
- ✅ No code changes needed to add scripts
- ✅ Works on all pages automatically
- ✅ Clean component separation

### 7. Route and Navigation Integration

**Features**:
- New admin route for analytics page
- Integrated with admin layout tabs
- Added to admin dashboard index
- Page info detection for proper tab highlighting

**Implementation**:
- Updated `app/routes.ts`:
  - Added route: `route("admin/analytics", "routes/admin/analytics.tsx")`
  - Placed within `server-admin-layout` layout

- Updated `app/root.tsx` middleware:
  - Added `isAdminAnalytics` flag detection
  - Checks for route ID: `"routes/admin/analytics"`
  - Added to `pageInfo` object

- Updated `server/contexts/global-context.ts`:
  - Added `isAdminAnalytics: boolean` to `PageInfo` interface

- Updated `server/index.ts`:
  - Added `isAdminAnalytics: false` to initial `pageInfo`
  - Added default `analyticsSettings` with empty array

- Updated `app/layouts/server-admin-layout.tsx`:
  - Added `isAdminAnalytics` check in `getCurrentTab()`
  - Maps to `AdminTab.General` tab
  - Ensures correct tab is highlighted when on analytics page

- Updated `app/routes/admin/index.tsx`:
  - Added "Analytics settings" link in analytics section
  - Link: `href("/admin/analytics")`
  - Placed under "General" tab → "Analytics" section

**Benefits**:
- ✅ Properly integrated into admin navigation
- ✅ Easy to discover and access
- ✅ Consistent with other admin pages
- ✅ Correct tab highlighting

## Technical Details

### Script Tag Validation

The system validates script tags at multiple levels:

1. **Client-side validation** (Form):
   - Real-time URL format validation using regex
   - Checks for HTTP/HTTPS protocol
   - Shows error message below input
   - Prevents form submission with invalid URLs

2. **Server-side validation** (`tryValidateScriptTag`):
   - Parses script tag HTML using `cheerio`
   - Validates script tag structure (exactly one script tag)
   - Rejects inline scripts (no script content allowed)
   - Requires `src` attribute
   - Validates URL format and protocol (HTTP/HTTPS only)
   - Checks for dangerous attributes (`onerror`, `onload`, `onclick`, `integrity`, `crossorigin`)
   - Allows only safe attributes (`src`, `defer`, `async`, `data-*`)
   - Returns descriptive error messages

3. **Action-level validation** (`app/routes/admin/analytics.tsx`):
   - Validates each script before saving
   - Constructs script tag HTML from form data
   - Converts camelCase data attributes to kebab-case
   - Calls `tryValidateScriptTag` for each script
   - Returns error with script index if validation fails

### Attribute Conversion

The system converts camelCase field names to kebab-case HTML attributes:

- `dataWebsiteId` → `data-website-id` (for Umami)
- `dataDomain` → `data-domain` (for Plausible)
- `dataSite` → `data-site` (for Fathom)
- `dataMeasurementId` → `data-measurement-id` (for Google Analytics)

This conversion happens:
1. In the route action when validating scripts (camelCase → kebab-case for validation)
2. In the `AnalyticsScripts` component when rendering (camelCase → kebab-case for HTML)

### Supported Analytics Providers

The feature supports configuration for popular analytics providers:

1. **Umami**:
   - Script URL: `https://cloud.umami.is/script.js`
   - Data attribute: `data-website-id` (e.g., `63b7582a-1ce5-46fd-8635-612cbba6cd1c`)

2. **Plausible**:
   - Script URL: `https://plausible.io/js/script.js`
   - Data attribute: `data-domain` (e.g., `example.com`)

3. **Google Analytics**:
   - Script URL: `https://www.googletagmanager.com/gtag/js`
   - Data attribute: `data-measurement-id` (e.g., `G-XXXXXXXXXX`)

4. **Fathom**:
   - Script URL: `https://cdn.usefathom.com/script.js`
   - Data attribute: `data-site` (e.g., `ABCDEFGH`)

### Form Data Handling

The admin page uses JSON serialization:
- Scripts array serialized as JSON string in FormData
- Server parses JSON string back to array
- Handles both string and already-parsed data
- Uses `getDataAndContentTypeFromRequest` utility

### Error Handling

All operations use TypeScript Result pattern:
- `tryGetAnalyticsSettings` returns `Result<AnalyticsGlobal>`
- `tryUpdateAnalyticsSettings` returns `Result<AnalyticsGlobal>`
- `tryValidateScriptTag` returns `Result<ScriptTagAttributes>`
- Errors are properly typed and transformed
- Client receives clear error messages via notifications

### Default Behavior

When analytics settings cannot be loaded:
- Defaults to empty array (no scripts)
- System continues to function normally
- No errors thrown to user
- Fail-open approach for resilience

## Security Considerations

### Script Injection Prevention

The validation system prevents common attack vectors:

1. **Inline Scripts Blocked**:
   - Only external scripts with `src` attribute allowed
   - Prevents XSS attacks via inline script content

2. **URL Protocol Validation**:
   - Only HTTP and HTTPS protocols allowed
   - Blocks `javascript:`, `data:`, `file:` protocols

3. **Dangerous Attributes Blocked**:
   - `onerror`, `onload`, `onclick` blocked (prevents event handler injection)
   - `integrity`, `crossorigin` blocked (prevents subresource integrity bypass)

4. **HTML Entity Encoding**:
   - Attribute values are properly encoded
   - Prevents attribute injection attacks

5. **Single Script Tag Validation**:
   - Only one script tag per configuration allowed
   - Prevents multiple script injection

### Access Control

- Admin-only access to analytics settings page
- Proper user authentication required
- Access control enforced via `overrideAccess: false` in update function
- System requests use `overrideAccess: true` for reading settings

## Testing

### Manual Testing Steps

1. **Access Admin Analytics Page**:
   - Log in as administrator
   - Navigate to Admin → General → Analytics → Analytics settings
   - Or directly visit `/admin/analytics`
   - Verify page loads correctly
   - Verify "General" tab is highlighted

2. **Add Analytics Scripts**:
   - Click "Add Script" button
   - Enter a valid script URL: `https://cloud.umami.is/script.js`
   - Enter data attribute: `dataWebsiteId` = `63b7582a-1ce5-46fd-8635-612cbba6cd1c`
   - Check "Defer" checkbox
   - Verify no validation errors appear
   - Add another script: `https://plausible.io/js/script.js` with `dataDomain` = `example.com`
   - Verify both scripts appear in list

3. **Reorder Scripts**:
   - Click "Up" button on second script
   - Verify it moves to first position
   - Click "Down" button
   - Verify it moves back to second position
   - Verify order persists after page reload

4. **URL Validation**:
   - Try entering invalid URL: `not-a-url`
   - Verify error message appears: "Must be a valid HTTP or HTTPS URL"
   - Try entering non-HTTP URL: `ftp://example.com/script.js`
   - Verify error message appears
   - Enter valid URL and verify error disappears

5. **Script Attributes**:
   - Add script with `defer` checked
   - Add script with `async` checked
   - Add script with both `defer` and `async` checked
   - Verify all attributes are saved correctly

6. **Data Attributes**:
   - Add Umami script with `dataWebsiteId`
   - Add Plausible script with `dataDomain`
   - Add Fathom script with `dataSite`
   - Add Google Analytics script with `dataMeasurementId`
   - Verify all data attributes are saved correctly

7. **Remove Scripts**:
   - Click delete (trash icon) on a script
   - Verify it is removed from list
   - Remove all scripts
   - Verify empty state message appears: "No scripts configured..."

8. **Save Changes**:
   - Add 2-3 valid scripts with various attributes
   - Click "Save changes" button
   - Verify success notification appears
   - Verify page reloads with saved scripts
   - Verify scripts persist after browser refresh

9. **Verify Script Injection**:
   - After saving scripts, navigate to any page (e.g., dashboard, course page)
   - Open browser DevTools → Elements tab
   - Inspect `<head>` section
   - Verify configured scripts are injected
   - Verify scripts have correct attributes (defer, async, data-*)
   - Verify data attributes are in kebab-case format
   - Verify scripts load in correct order

10. **Test Analytics Providers**:
    - Configure Umami script and verify tracking works
    - Configure Plausible script and verify tracking works
    - Configure Google Analytics script and verify tracking works
    - Configure Fathom script and verify tracking works
    - Configure multiple providers simultaneously

11. **Security Testing**:
    - Try to add inline script: `<script>alert('xss')</script>`
    - Verify validation error appears
    - Try to add script with `onerror` attribute
    - Verify validation error appears
    - Try to add script with `javascript:` protocol
    - Verify validation error appears

12. **Error Handling**:
    - Try saving with invalid URL
    - Verify error notification appears
    - Verify scripts are not saved
    - Verify form retains entered data

### Automated Testing

- ✅ Comprehensive unit tests for `tryValidateScriptTag` function (30+ test cases)
- ✅ Tests cover valid scripts, invalid scripts, edge cases
- ✅ Tests verify security validations
- ⚠️ Unit tests for `tryGetAnalyticsSettings` function (recommended)
- ⚠️ Unit tests for `tryUpdateAnalyticsSettings` function (recommended)
- ⚠️ Integration tests for admin page loader/action (recommended)
- ⚠️ E2E tests for script management workflow (recommended)

### Test Scenarios

1. **Multiple Scripts**:
   - Add 5+ scripts
   - Verify all load correctly
   - Verify order is maintained

2. **Very Long URLs**:
   - Add script with very long URL (200+ characters)
   - Verify it saves and loads correctly

3. **Special Characters in URLs**:
   - Add script with query parameters: `https://example.com/script.js?v=1.0&id=123`
   - Verify it saves and loads correctly

4. **CDN URLs**:
   - Add scripts from various CDNs
   - Verify all load correctly
   - Verify CORS headers don't block loading

5. **Performance**:
   - Add 10+ scripts
   - Verify page load performance
   - Verify scripts load in parallel (check Network tab)

6. **Multiple Analytics Providers**:
   - Configure all four supported providers simultaneously
   - Verify all scripts load correctly
   - Verify all tracking works independently

## Migration Notes

**Database migration required**: `20251113_192112`

The migration creates:
1. `analytics_settings` table - Main global table
2. `analytics_settings_additional_js_scripts` table - Array relationship table for script configurations
   - Fields: `src`, `defer`, `async`, `data_website_id`, `data_domain`, `data_site`, `data_measurement_id`
   - Ordering support via `_order` field
   - Foreign key relationship to `analytics_settings`

**To apply the migration**:
```bash
bun run payload migrate
```

The system will default to an empty array if the global doesn't exist, but the migration ensures proper initialization.

## Files Changed

### New Files
- `server/internal/analytics-settings.ts` - Internal functions for analytics settings
- `server/internal/utils/validate-script-tag.ts` - Script tag validation utility
- `server/internal/utils/validate-script-tag.test.ts` - Comprehensive test suite for script validation
- `app/routes/admin/analytics.tsx` - Admin page for managing analytics scripts
- `src/migrations/20251113_192112.ts` - Database migration for analytics settings

### Modified Files
- `server/collections/globals.ts` - Added `AnalyticsSettings` global collection
- `server/payload.config.ts` - Added `AnalyticsSettings` to globals array
- `server/internal/system-globals.ts` - Added `analyticsSettings` to `SystemGlobals` type and fetch logic
- `server/contexts/global-context.ts` - Updated `SystemGlobals` type and added `isAdminAnalytics` to `PageInfo`
- `app/utils/error.ts` - Added `ScriptValidationError` class and included in `transformError`
- `app/routes.ts` - Added `admin/analytics` route
- `app/root.tsx` - Added `isAdminAnalytics` detection, script injection in `<head>`, `AnalyticsScripts` component, and loader data
- `server/index.ts` - Added default `analyticsSettings` and `isAdminAnalytics` initialization
- `app/layouts/server-admin-layout.tsx` - Added analytics page tab detection
- `app/routes/admin/index.tsx` - Added "Analytics settings" link in analytics section

## Future Enhancements

Potential improvements for future iterations:
- Preview script before adding (fetch and validate script URL)
- Test script loading (verify URL is accessible)
- Script grouping/categorization (e.g., analytics, marketing, etc.)
- Conditional loading (e.g., only on specific pages or routes)
- Script versioning/pinning
- Import/export script configurations
- Script performance monitoring
- Script loading analytics (track which scripts load successfully)
- Support for script loading strategies (e.g., load on user interaction)
- Script dependency management
- Support for module scripts (`type="module"`)

