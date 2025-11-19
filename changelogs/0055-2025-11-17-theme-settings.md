# Theme Settings

**Date:** 2025-11-17  
**Type:** Feature Enhancement  
**Impact:** Medium - Adds customizable theme settings (primary color and border radius) for the entire application

## Overview

This changelog documents the addition of theme customization settings that allow administrators to configure the primary color and border radius for the entire application. These settings are dynamically applied to all Mantine components throughout the system, providing a consistent and customizable visual experience. A dedicated theme settings page has been created under the admin appearance section, separate from the CSS stylesheets configuration.

## Key Changes

### Theme Settings Configuration

#### Primary Color Selection
- Added `color` field to `AppearanceSettings` global collection
- Supports 13 color options: blue, pink, indigo, green, orange, gray, grape, cyan, lime, red, violet, teal, yellow
- Default color is "blue"
- Color selection affects buttons, links, and all interactive Mantine components

#### Border Radius Selection
- Added `radius` field to `AppearanceSettings` global collection
- Supports 5 size options: xs (Extra Small), sm (Small), md (Medium), lg (Large), xl (Extra Large)
- Default radius is "sm"
- Border radius affects buttons, cards, inputs, and all Mantine components with rounded corners

### Dedicated Theme Settings Page

#### New Admin Route
- Created `/admin/appearance/theme` route for theme configuration
- Separated from CSS stylesheets configuration for better organization
- Accessible only to administrators
- Added to admin index page navigation links

#### Theme Settings UI
- Primary color selection using color-coded buttons
- Each color button displays in its respective color for visual preview
- Selected color is highlighted with filled variant
- Border radius selection using dropdown (Select component)
- Real-time form state management using Mantine's uncontrolled form mode
- Success/error notifications on save

#### Form Management
- Created `useUpdateTheme` hook for theme updates
- Uses React Router's `useFetcher` for form submission
- Client action handles success/error notifications
- Server action validates input and updates global settings

### Dynamic Theme Application

#### Mantine Theme Configuration
- Theme is dynamically created in `root.tsx` using `createTheme`
- Primary color and default radius are retrieved from system globals
- Theme is applied to `MantineProvider` for application-wide styling
- Changes take effect immediately after save (requires page refresh)

#### System Globals Integration
- Added `color` and `radius` to `SystemGlobals.appearanceSettings` type
- Updated `tryGetSystemGlobals` to include theme settings
- Default values provided in middleware fallback (color: "blue", radius: "sm")
- Theme settings are available throughout the application via global context

### Data Structure Updates

#### Global Collection Schema
- Added `color` select field to `AppearanceSettings` global
- Added `radius` select field to `AppearanceSettings` global
- Both fields are optional with sensible defaults
- Validation ensures only valid color and radius values are accepted

#### Type Definitions
- Updated `AppearanceSettings` type to include `color: string` and `radius: "xs" | "sm" | "md" | "lg" | "xl"`
- Updated `UpdateAppearanceSettingsArgs` to accept color and radius in data object
- Added `validColors` and `validRadius` constants for validation
- Updated `appearanceSettingsSchema` Zod schema to validate color and radius enums

#### Context Updates
- Added `isAdminTheme: boolean` to `PageInfo` type in global context
- Enables proper tab highlighting in admin layout when on theme page
- Updated `server-admin-layout.tsx` to recognize theme page route

### Internal Functions

#### Appearance Settings Management
- Updated `tryGetAppearanceSettings` to retrieve and validate color and radius
- Falls back to defaults ("blue" and "sm") if values are missing or invalid
- Validates color against allowed list before returning
- Validates radius against allowed list before returning

#### Update Functionality
- Updated `tryUpdateAppearanceSettings` to handle color and radius updates
- Validates color and radius values before saving
- Returns error if invalid color or radius is provided
- Supports partial updates (can update color or radius independently)

### Database Migration

#### Schema Changes
- Created migration `20251116_235727` to add color and radius columns
- Added `appearance_settings_color` enum type with 13 color values
- Added `appearance_settings_radius` enum type with 5 radius values
- Added `color` column to `appearance_settings` table with default "blue"
- Added `radius` column to `appearance_settings` table with default "sm"
- Migration includes proper down function for rollback support

## Technical Details

### Files Modified
- `server/collections/globals.ts`: Added color and radius fields to AppearanceSettings
- `server/internal/appearance-settings.ts`: Updated types, validation, and get/update functions
- `server/contexts/global-context.ts`: Added color and radius to SystemGlobals type, added isAdminTheme to PageInfo
- `server/internal/system-globals.ts`: Updated to include color and radius in appearanceSettings
- `app/root.tsx`: Dynamic theme creation and application via MantineProvider
- `app/routes/admin/appearance/theme.tsx`: New dedicated theme settings page
- `app/routes/admin/appearance.tsx`: Reverted to only handle CSS stylesheets
- `app/routes/admin/index.tsx`: Added link to theme settings page
- `app/layouts/server-admin-layout.tsx`: Updated to recognize theme page route
- `app/routes.ts`: Added route for theme settings page
- `src/migrations/20251116_235727.ts`: Database migration for color and radius fields
- `src/migrations/index.ts`: Registered new migration

### Validation Logic
- Color validation: Checks against predefined list of 13 valid colors
- Radius validation: Checks against predefined list of 5 valid radius values
- Zod schema validation: Uses `z.enum` with spread operator for type-safe validation
- Server-side validation: Ensures data integrity before database updates
- Client-side validation: Provides immediate feedback on form submission

### Theme Application Flow
1. System globals are fetched in root loader
2. Primary color and default radius are extracted from appearanceSettings
3. Mantine theme is created dynamically using `createTheme`
4. Theme is passed to `MantineProvider` for application-wide application
5. All Mantine components automatically use the configured theme

### Route Structure
- Theme settings: `/admin/appearance/theme`
- CSS stylesheets: `/admin/appearance` (separate page)
- Both pages are under admin > appearance section
- Theme page is highlighted in admin layout tabs when active

## User Impact

### For Administrators
- Can customize the primary color theme for the entire application
- Can adjust border radius to match design preferences
- Changes apply globally to all Mantine components
- Easy-to-use interface with visual color preview
- Immediate feedback on save operations

### For All Users
- Consistent visual experience across the entire application
- Theme changes affect all interactive elements (buttons, links, inputs, etc.)
- No breaking changes - all existing functionality preserved
- Default theme (blue, sm radius) maintains current appearance if unchanged

## Migration Notes

- Database migration required: Run `bun run payload migrate` to apply schema changes
- Migration is non-breaking and backward compatible
- Existing installations will use default values (blue, sm) until explicitly changed
- No data migration needed - defaults are applied automatically
- Theme settings are stored in `appearance_settings` global collection

## Testing Considerations

- Verify theme settings page is accessible only to administrators
- Test color selection with all 13 available colors
- Test radius selection with all 5 available sizes
- Verify theme is applied correctly to Mantine components
- Test form validation with invalid color/radius values
- Verify default values are used when settings are unset
- Test page refresh after theme update to see changes
- Verify admin layout tab highlighting on theme page
- Test that CSS stylesheets page is separate and unaffected
- Verify theme settings persist after server restart

## Edge Cases Handled

- Missing color value: Falls back to "blue" default
- Missing radius value: Falls back to "sm" default
- Invalid color value: Validated and rejected with error message
- Invalid radius value: Validated and rejected with error message
- Partial updates: Can update color or radius independently
- Database errors: Graceful error handling with user-friendly messages
- Unauthenticated access: Redirected with forbidden response
- Non-admin access: Blocked with appropriate error message

## Future Enhancements

- Add live preview of theme changes without page refresh
- Support for custom color values (hex codes)
- Additional theme customization options (font family, spacing, etc.)
- Theme presets (light/dark mode, color schemes)
- Export/import theme configurations
- Per-course theme customization
- User-level theme preferences (if desired)

## Conclusion

This enhancement provides administrators with powerful theme customization capabilities, allowing them to tailor the visual appearance of the application to match their branding or design preferences. The implementation is clean, type-safe, and follows existing patterns in the codebase. The separation of theme settings from CSS stylesheets improves organization and maintainability.

