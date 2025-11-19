# Direction Support (RTL/LTR)

**Date:** 2025-11-19  
**Type:** Feature Enhancement  
**Impact:** Medium - Adds right-to-left (RTL) and left-to-right (LTR) text direction support for internationalization

## Overview

This changelog documents the addition of text direction support, allowing users to choose between left-to-right (LTR) and right-to-left (RTL) text direction for the entire application. This feature is essential for supporting languages that read from right to left, such as Arabic, Hebrew, and Persian. The implementation leverages Mantine's built-in RTL support and integrates seamlessly with the existing user preference system.

## Key Changes

### User Direction Preference

#### Direction Field in Users Collection
- Added `direction` field to `Users` collection
- Field type: `select` with two options:
  - "Left to Right" (ltr) - Default value
  - "Right to Left" (rtl)
- Field is required with default value "ltr"
- Field is saved to JWT for quick access during authentication
- Users can update their direction preference in the preferences page

#### User Type Updates
- Updated `User` interface in `server/contexts/user-context.ts` to include `direction: "ltr" | "rtl"`
- Updated `tryGetUserContext` to include direction when creating user objects
- Updated impersonation handling to include direction field
- Ensures direction is always available in user context throughout the application

### User Preferences Page

#### Direction Selection UI
- Added direction selection to user preferences page (`/user/preference`)
- New `Radio.Group` component for direction selection
- Options: "Left to Right" and "Right to Left"
- Positioned below theme selection in the preferences form
- Uses Mantine's uncontrolled form mode for state management

#### Form Schema Updates
- Updated `actionSchema` to include `direction: z.enum(["ltr", "rtl"])`
- Updated loader to include `direction` in returned user data
- Updated action handler to process direction updates
- Updated `useUpdateUserPreference` hook to accept and submit direction

#### Preference Updates
- Direction preference is saved alongside theme preference
- Both preferences are updated in a single form submission
- Success/error notifications reflect preference updates (not just theme)
- Form validation ensures only valid direction values are accepted

### Root Component Integration

#### DirectionProvider Setup
- Added `DirectionProvider` from `@mantine/core` to root component
- Wrapped entire application with `DirectionProvider`
- Configured with `initialDirection` from user preference
- Set `detectDirection={false}` to prevent automatic detection (uses user preference instead)
- Also added to error boundary for consistent behavior

#### HTML Direction Attribute
- Added `dir` attribute to `<html>` element in root component
- Value is dynamically set based on user's direction preference
- Defaults to "ltr" if user preference is not available
- Ensures proper text direction for entire page

#### Loader Updates
- Root loader retrieves user's direction preference
- Falls back to "ltr" if user is not authenticated or preference is missing
- Passes direction to root component via loader data
- Direction is available throughout the application

### Internal Functions

#### User Management Updates
- Updated `CreateUserArgs` interface to include optional `direction?: "ltr" | "rtl"`
- Updated `UpdateUserArgs` interface to include optional `direction?: "ltr" | "rtl"`
- Updated `tryCreateUser` to set default direction "ltr" if not provided
- Updated `tryRegisterFirstUser` to set direction "ltr" for first user
- Updated `tryRegisterUser` to set direction "ltr" for new users
- All user creation functions now properly handle direction field

## Technical Details

### Files Modified

1. **`server/collections/users.ts`**
   - Added `direction` select field to users collection
   - Field configuration: required, default "ltr", saved to JWT

2. **`server/contexts/user-context.ts`**
   - Added `direction: "ltr" | "rtl"` to `User` interface
   - Updated `tryGetUserContext` to include direction in user objects
   - Updated impersonation handling to preserve direction

3. **`server/internal/user-management.ts`**
   - Updated `CreateUserArgs` and `UpdateUserArgs` interfaces
   - Updated all user creation functions to handle direction
   - Set default direction "ltr" for all new users

4. **`app/routes/user/preference.tsx`**
   - Added direction field to loader return data
   - Added direction to form schema and validation
   - Added direction Radio.Group to preferences form
   - Updated action handler to process direction updates
   - Updated `useUpdateUserPreference` hook

5. **`app/root.tsx`**
   - Added `DirectionProvider` import from `@mantine/core`
   - Added direction retrieval in loader
   - Added `dir` attribute to `<html>` element
   - Wrapped application with `DirectionProvider`
   - Added direction to error boundary

### Mantine RTL Integration

#### DirectionProvider Configuration
- Uses Mantine's `DirectionProvider` component
- Automatically handles RTL layout for all Mantine components
- Supports dynamic direction changes
- Provides `useDirection` hook for programmatic direction control

#### Component Support
- All Mantine components automatically support RTL when wrapped in `DirectionProvider`
- Components automatically flip layout, spacing, and positioning
- Icons and text alignment adjust automatically
- No additional component-level changes needed

### Data Flow

1. User selects direction preference in preferences page
2. Form submission updates user record in database
3. User context includes direction in JWT and session
4. Root loader retrieves direction from user context
5. Direction is passed to root component via loader data
6. `DirectionProvider` receives direction and applies it
7. HTML `dir` attribute is set for semantic correctness
8. All Mantine components automatically adapt to direction

## User Impact

### For All Users

#### Direction Selection
- Users can choose their preferred text direction (LTR or RTL)
- Preference is saved and persists across sessions
- Direction applies to entire application interface
- All Mantine components automatically adapt to selected direction

#### Internationalization Support
- Enables support for RTL languages (Arabic, Hebrew, Persian, etc.)
- Improves accessibility for RTL language speakers
- Maintains LTR as default for existing users
- No breaking changes for LTR users

### For Administrators

#### User Management
- Can view user direction preferences (if needed in future)
- Direction is part of user profile data
- No special configuration needed
- Works out of the box with existing user management

## Migration Notes

### Database Migration Required

- **Migration Command**: `bun run payload migrate:create`
- Creates migration to add `direction` column to `users` table
- Migration will:
  - Add `direction` column with type `text` or enum
  - Set default value to "ltr" for existing users
  - Make column required (with default)
  - Add constraint to ensure only "ltr" or "rtl" values

### Backward Compatibility

- ✅ Existing users will automatically get "ltr" direction (default)
- ✅ No data loss or breaking changes
- ✅ All existing functionality preserved
- ✅ Migration is non-breaking and safe to apply

### Post-Migration Steps

1. Run database migration: `bun run payload migrate`
2. Regenerate Payload types: `bun run payload generate:types`
3. Existing users will have "ltr" direction by default
4. Users can change direction in preferences page
5. New users will default to "ltr" direction

## Testing Considerations

### Functional Testing

- ✅ Verify direction selection appears in preferences page
- ✅ Test saving direction preference (both LTR and RTL)
- ✅ Verify direction persists after page refresh
- ✅ Test direction change updates entire UI
- ✅ Verify HTML `dir` attribute is set correctly
- ✅ Test with authenticated and unauthenticated users
- ✅ Verify default direction "ltr" for new users
- ✅ Test direction in error boundary

### UI/UX Testing

- ✅ Verify all Mantine components adapt to RTL direction
- ✅ Test form layouts in RTL mode
- ✅ Verify navigation and menus in RTL
- ✅ Test button and icon positioning in RTL
- ✅ Verify text alignment in RTL mode
- ✅ Test responsive layouts in both directions
- ✅ Verify accessibility in RTL mode

### Edge Cases

- ✅ Missing direction preference: Falls back to "ltr"
- ✅ Invalid direction value: Validated and rejected
- ✅ Unauthenticated user: Uses "ltr" default
- ✅ User context missing: Uses "ltr" default
- ✅ Error boundary: Uses "ltr" default
- ✅ New user registration: Sets "ltr" by default

## Internationalization Impact

### RTL Language Support

This feature enables proper support for:
- **Arabic** (العربية)
- **Hebrew** (עברית)
- **Persian/Farsi** (فارسی)
- **Urdu** (اردو)
- **Yiddish** (ייִדיש)
- And other RTL languages

### Future i18n Enhancements

With direction support in place, the foundation is set for:
- Full internationalization (i18n) with language selection
- Locale-specific formatting (dates, numbers, etc.)
- Language-specific content translation
- Multi-language course content support

## Future Enhancements

### Potential Improvements

- **Auto-detection**: Detect direction from browser language settings
- **Per-page direction**: Allow different directions for different pages
- **Language selection**: Combine direction with language selection
- **Admin override**: Allow admins to set default direction for site
- **Course-level direction**: Allow courses to have their own direction
- **Content direction**: Allow individual content blocks to override direction
- **Direction toggle**: Quick toggle button in navigation for testing

### Mantine RTL Features

- Use `rtl` mixin in CSS for custom RTL styles
- Leverage `useDirection` hook for programmatic direction control
- Use `DirectionProvider`'s `toggleDirection` for testing
- Implement direction-aware custom components

## Related Features

### Theme Settings
- Direction works seamlessly with theme settings (light/dark)
- Both preferences are managed in the same preferences page
- Direction and theme are independent settings

### User Preferences
- Direction is part of the unified user preferences system
- Follows same patterns as theme preference
- Uses same form submission and update mechanisms

## Conclusion

The addition of direction support (RTL/LTR) significantly enhances the internationalization capabilities of Paideia LMS. This feature enables proper support for right-to-left languages and provides a foundation for future internationalization efforts. The implementation leverages Mantine's built-in RTL support, ensuring all components automatically adapt to the selected direction. The feature is user-friendly, well-integrated with existing systems, and maintains full backward compatibility.

---

**Summary**: Added right-to-left (RTL) and left-to-right (LTR) text direction support, allowing users to choose their preferred text direction. The feature integrates with Mantine's DirectionProvider and applies direction to the entire application interface, enabling proper support for RTL languages like Arabic, Hebrew, and Persian.

