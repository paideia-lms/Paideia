# Changelog: Course Module-Specific Settings

**Date**: October 28, 2025  
**Type**: Feature Enhancement  
**Status**: Implemented

## Overview

Added support for course module-specific settings, allowing the same user module to be added multiple times to a course with different configurations (e.g., different names, due dates, and time restrictions).

## Problem Statement

Previously, when a user module (e.g., a learning journal assignment) was added to a course, there was no way to customize the settings for each instance. If a course wanted to use the same assignment template 5 times with different due dates and titles, this wasn't possible.

## Solution

Implemented a versioned JSON settings system for course-activity-module-links that allows each course module instance to have its own configuration.

## Technical Implementation

### 1. Versioned JSON Schema

Created a versioned schema system similar to the quiz config:

**Files Created**:
- `server/json/course-module-settings.types.ts` - Type definitions for v1 settings
- `server/json/course-module-settings-version-resolver.ts` - Version migration resolver

**Schema Structure** (v1):
```typescript
{
  version: "v1",
  settings: {
    type: "page" | "whiteboard" | "assignment" | "quiz" | "discussion",
    name?: string, // Course-specific override name
    // Type-specific fields...
  }
}
```

### 2. Module Type Settings

**Page & Whiteboard**:
- `name` - Optional custom name for the course module

**Assignment**:
- `name` - Optional custom name
- `allowSubmissionsFrom` - ISO date string for when submissions open
- `dueDate` - ISO date string for assignment due date
- `cutoffDate` - ISO date string for latest possible submission

**Quiz**:
- `name` - Optional custom name
- `openingTime` - ISO date string for when quiz becomes available
- `closingTime` - ISO date string for when quiz closes

**Discussion**:
- `name` - Optional custom name
- `dueDate` - ISO date string for discussion due date
- `cutoffDate` - ISO date string for discussion cutoff

### 3. Database Changes

**Collection**: `course-activity-module-links`

Added field:
```typescript
{
  name: "settings",
  type: "json",
  label: "Course Module Settings",
  hooks: {
    afterRead: [
      ({ value }) => {
        if (!value) return null;
        return tryResolveCourseModuleSettingsToLatest(value);
      },
    ],
  },
}
```

**Migration**: `src/migrations/20251028_215931.ts`
- Adds `settings` JSONB column to `course_activity_module_links` table

### 4. Internal Functions

**File**: `server/internal/course-activity-module-link-management.ts`

**New Functions**:

1. `tryUpdateCourseModuleSettings(payload, request, linkId, settings, transactionID?)`
   - Updates settings for a course module link
   - Validates date logic (e.g., due date before cutoff, opening before closing)
   - Returns type-safe result with proper error handling
   - Supports transactions

2. `tryGetCourseModuleSettings(payload, linkId)`
   - Retrieves settings for a course module link
   - Returns null if no settings configured
   - Proper type narrowing for all fields

**Updated Functions**:

1. `tryCreateCourseActivityModuleLink` - Now accepts optional `settings` parameter
   - Can set initial settings when creating a link

**File**: `server/internal/course-section-management.ts`

**Updated Functions**:

1. `tryGetCourseStructure` - Now respects custom module names from settings
   - Reads `link.settings` as `CourseModuleSettingsV1 | null`
   - Uses `linkSettings?.settings?.name ?? activityModule.title` for display
   - Backward compatible: Falls back to original module title if no custom name set
   - Automatically propagates custom names through entire course structure tree

### 5. UI Components & Layouts

**New Layout**: `app/layouts/course-module-layout.tsx`
- Created dedicated layout for course module pages with tab navigation
- Shows "Preview" and "Setting" tabs
- Displays custom module name in header if configured
- Uses `canSeeCourseModuleSettings` permission check for Settings tab visibility
- Integrates with `course-module-context` to access settings

**Updated Routes**: `app/routes.ts`
- Wrapped module routes in `course-module-layout.tsx`
- Both preview and edit pages now use consistent layout

**Updated Components**:

1. `app/routes/course/module.$id.tsx` (Preview Page)
   - Displays custom module name in page title
   - Falls back to original module title if no custom name
   - Uses `moduleSettings?.settings.name ?? module.title`

2. `app/routes/course/module.$id.edit.tsx` (Settings Page)
   - Form for editing module-specific settings
   - Uses Mantine `useForm` in uncontrolled mode
   - Displays custom name in page title
   - Dynamic fields based on module type (assignment/quiz/discussion/page/whiteboard)
   - Implements `useFetcher` for non-navigating form submission

3. `app/layouts/course-module-layout.tsx`
   - Header displays custom module name
   - Tab label shows module type (e.g., "Assignment", "Quiz")
   - Badge shows module status

**New Permission Function**: `server/utils/permissions.ts`
- `canSeeCourseModuleSettings(user, enrolment)` - Controls access to Settings tab
- Allows teachers, managers, admins, and content-managers

**Context Updates**:

1. `server/contexts/course-context.ts`
   - `CourseActivityModuleLink` type includes `settings?: CourseModuleSettingsV1 | null`
   - Settings automatically populated when fetching course context

2. `server/contexts/course-module-context.ts`
   - `CourseModuleContext` includes `moduleLinkSettings: CourseModuleSettingsV1 | null`
   - Settings available for individual module pages

3. `server/contexts/global-context.ts`
   - Added `isCourseModuleEdit` and `isInCourseModuleLayout` to `PageInfo` type

**Middleware Updates**: `app/root.tsx`
- Added detection for course module layout routes
- Sets appropriate page info flags for module edit pages

### 6. Date Validation

Built-in validation for date consistency:

**Assignment**:
- allowSubmissionsFrom < dueDate
- dueDate < cutoffDate
- allowSubmissionsFrom < cutoffDate

**Quiz**:
- openingTime < closingTime

**Discussion**:
- dueDate < cutoffDate

All validation happens in the internal function using `Result.wrap` pattern.

## Usage Example

```typescript
// Create a course module link with initial settings
const linkResult = await tryCreateCourseActivityModuleLink(
  payload,
  request,
  {
    course: 1,
    activityModule: 5, // Learning journal assignment
    section: 2,
    settings: {
      version: "v1",
      settings: {
        type: "assignment",
        name: "Learning Journal - Week 1",
        allowSubmissionsFrom: "2025-11-01T00:00:00Z",
        dueDate: "2025-11-07T23:59:59Z",
        cutoffDate: "2025-11-10T23:59:59Z",
      },
    },
  }
);

// Update settings later
const updateResult = await tryUpdateCourseModuleSettings(
  payload,
  request,
  linkId,
  {
    version: "v1",
    settings: {
      type: "assignment",
      name: "Learning Journal - Week 1 (Updated)",
      dueDate: "2025-11-08T23:59:59Z",
      cutoffDate: "2025-11-11T23:59:59Z",
    },
  }
);

// Retrieve settings
const settingsResult = await tryGetCourseModuleSettings(payload, linkId);
if (settingsResult.ok) {
  const { settings } = settingsResult.value;
  if (settings?.settings.type === "assignment") {
    console.log(settings.settings.dueDate);
  }
}
```

## Design Decisions

### Custom Module Name Display Strategy

**Decision**: Respect custom module names throughout the entire application

**Implementation**:
1. **Core Data Layer** (`tryGetCourseStructure`)
   - Read settings at the source when building course structure
   - Apply custom name during structure generation
   - Single point of transformation ensures consistency

2. **Backward Compatibility**
   - Always use fallback pattern: `customName ?? originalTitle`
   - Null settings are handled gracefully
   - No breaking changes for existing modules

3. **Type Safety**
   - Cast `link.settings` to `CourseModuleSettingsV1 | null`
   - Use optional chaining: `linkSettings?.settings?.name`
   - Avoid `any` type assertions

4. **Data Flow**
   - `tryGetCourseStructure` → `CourseContext` → `CourseStructureTree` → UI
   - Custom names automatically propagate to all views
   - No need to update individual UI components reading from context

**Why This Approach**:
- ✅ Single source of truth for custom names
- ✅ Minimal code changes required
- ✅ Automatic propagation through data flow
- ✅ Type-safe with proper null handling
- ✅ Backward compatible by design

### Transaction Handling

All settings updates use Payload's default transaction behavior:
- `tryUpdateCourseModuleSettings` uses request object for transaction ID
- Date validation errors automatically roll back
- No manual transaction management in UI layer

## Architecture Benefits

### Versioned Schema
- Future-proof: Easy to add new fields or module types
- Migration support built-in via version resolver
- Similar pattern to quiz config for consistency

### Type Safety
- Discriminated union based on module type
- Proper TypeScript types throughout
- Zod validation for runtime type checking

### Clean Schema
- No sparse columns in database
- Single JSON field instead of dozens of optional columns
- Easy to query and update

### Flexible
- Can add new module types without migrations
- Can add new fields to existing types in v2
- Settings are optional - modules work without them

### Systematic Display Logic
- Custom names applied at data layer, not UI layer
- Consistent display across all views automatically
- Course structure tree, breadcrumbs, navigation all updated in one place
- Reduces maintenance burden

## Database Migration

To apply this change:

```bash
bun run payload migrate
```

After migration, regenerate Payload types if needed:

```bash
bun run payload generate:types
```

## Testing Recommendations

1. Create course module links with initial settings
2. Update settings for existing links
3. Retrieve and display settings in UI
4. Validate date logic errors are properly thrown
5. Test transaction rollback on validation errors
6. Test with null/undefined settings (optional case)
7. Test each module type's specific fields

## Future Enhancements

This architecture supports:
- Adding more module types (e.g., video, embed, resource)
- Adding more settings per module type
- Implementing time-based access control
- Course-level default settings
- Template settings for quick configuration
- Settings inheritance or cloning

## Breaking Changes

None. This is a purely additive change. Existing course module links without settings will continue to work normally.

## Related Files

### Schema & Types
- `server/json/course-module-settings.types.ts`
- `server/json/course-module-settings-version-resolver.ts`

### Database
- `server/collections/course-activity-module-links.ts`
- `src/migrations/20251028_215931.ts`

### Internal Functions
- `server/internal/course-activity-module-link-management.ts`
- `server/internal/course-section-management.ts`

### Contexts
- `server/contexts/course-context.ts`
- `server/contexts/course-module-context.ts`
- `server/contexts/global-context.ts`

### Permissions
- `server/utils/permissions.ts`

### UI Components & Layouts
- `app/layouts/course-module-layout.tsx` (new)
- `app/routes/course/module.$id.tsx`
- `app/routes/course/module.$id.edit.tsx`
- `app/routes.ts`
- `app/root.tsx`
- `server/index.ts`

## Implementation Status

✅ **Completed**:
1. Database schema and migration
2. Internal functions with date validation
3. UI layout with tab navigation
4. Settings edit form with dynamic fields
5. Custom name display throughout application
6. Permission system for settings access
7. Context integration for settings data
8. Backward compatibility maintained

## Next Steps

1. ✅ ~~Run database migration~~ → `bun run payload migrate`
2. ✅ ~~Create UI components for editing settings~~ → Completed
3. ✅ ~~Create API endpoints to update settings~~ → Using Remix actions
4. ✅ ~~Implement frontend forms~~ → Mantine form with dynamic fields
5. 🔲 Add visual indicators for time-based restrictions in module preview
6. 🔲 Implement time-based access control based on settings (future feature)
7. 🔲 Add bulk settings update for multiple module instances
8. 🔲 Create settings templates for quick configuration

