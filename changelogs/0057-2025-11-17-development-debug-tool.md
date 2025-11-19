# Development Debug Tool

**Date:** 2025-11-17  
**Type:** Developer Tool  
**Impact:** Low - Adds development-only debugging tool for inspecting loader data

## Overview

This changelog documents the addition of a development debug tool that provides interactive inspection of loader data throughout the application. The tool is only visible in development environments and uses a JSON tree visualization to display all context data passed from server loaders to client components.

## Key Changes

### Development Debug Tool Component

#### Visual Interface
- Created `DevTool` component using Mantine's `Affix` and `Popover` components
- Fixed position button in bottom-right corner (20px from edges)
- Popover opens on click with 600px width
- Scrollable content area with 500px height for large data structures
- Uses `@gfazioli/mantine-json-tree` for interactive JSON visualization

#### JSON Tree Features
- **Default Expanded**: All nodes expanded by default for immediate visibility
- **Max Depth**: Limited to 3 levels deep to prevent overwhelming display
- **Indent Guides**: Visual guides showing nested structure hierarchy
- **Expand All**: Button to expand/collapse all nodes at once
- **Copy to Clipboard**: One-click copy of any JSON value for debugging
- **Title**: "Loader Data" label for context

#### Data Display
- Shows all context data from server loaders:
  - `userSession`: Current user session information
  - `courseContext`: Course-specific context data
  - `courseModuleContext`: Module-specific context data
  - `courseSectionContext`: Section-specific context data
  - `enrolmentContext`: Enrollment information
  - `userModuleContext`: User module context
  - `userProfileContext`: User profile data
  - `userAccessContext`: User access permissions
  - `userContext`: User context data
  - `systemGlobals`: System-wide global settings

### Environment Detection

#### Development-Only Visibility
- Tool only renders when `environment === "development"`
- `debugData` is only created in development mode
- Production builds have no performance impact from debug tool
- Conditional rendering prevents any debug code in production bundle

#### Data Collection
- `debugData` object is constructed in root loader
- Only includes data when environment is development
- Returns `null` in production to minimize data transfer
- All context data is collected from global context keys

### Integration Points

#### Root Loader Integration
- Added `debugData` to root loader return value
- Includes `isDevelopment` flag for conditional rendering
- Data collection happens after all middleware context setup
- No impact on production performance

#### App Component Integration
- `DevTool` component rendered conditionally in `App` component
- Only shown when `isDevelopment` is true
- Positioned after `Notifications` component
- Uses `NuqsAdapter` context for proper rendering

### Styling and Dependencies

#### Required Stylesheets
- Added `@gfazioli/mantine-json-tree/styles.css` import in `root.tsx`
- Ensures proper styling for JSON tree component
- Styles are only loaded when needed

#### Package Dependencies
- Uses `@gfazioli/mantine-json-tree` for JSON visualization
- Integrates seamlessly with Mantine component library
- No additional runtime dependencies

## Technical Details

### Files Modified
- `app/root.tsx`: Added debugData collection in loader, conditional DevTool rendering
- `app/components/dev-tool.tsx`: New component for debug tool UI

### Component Structure
```typescript
DevTool
├── Affix (fixed positioning)
│   └── Popover (interactive display)
│       ├── Popover.Target (button trigger)
│       └── Popover.Dropdown (content area)
│           └── ScrollArea (scrollable container)
│               └── JsonTree (JSON visualization)
```

### Data Flow
1. Root loader collects all context data
2. `debugData` object created only in development
3. Data passed to `App` component via loader data
4. `DevTool` receives data and renders JSON tree
5. User can interact with tree to inspect values

### Performance Considerations
- Zero impact in production (component not rendered)
- JSON tree uses virtualization for large datasets
- Max depth limit prevents performance issues
- ScrollArea handles large data structures efficiently

## User Impact

### For Developers
- Quick access to all loader data without console logging
- Visual representation of nested data structures
- Easy copying of values for debugging
- No need to add temporary console.log statements
- Helps understand data flow from server to client

### For End Users
- No visible impact (tool only in development)
- No performance impact in production builds
- No security concerns (not included in production)

## Migration Notes

- No database changes required
- No breaking changes
- Development tool automatically available in dev mode
- No configuration needed

## Testing Considerations

- Verify tool only appears in development environment
- Test JSON tree expansion/collapse functionality
- Verify copy to clipboard works correctly
- Test with various data structures (nested objects, arrays)
- Ensure tool doesn't impact production builds
- Verify all context data is displayed correctly

## Edge Cases Handled

- Missing context data: Tool gracefully handles undefined/null values
- Large data structures: ScrollArea and max depth prevent UI issues
- Circular references: JSON tree handles circular structures
- Production builds: Tool completely excluded from bundle

## Future Enhancements

- Filter/search functionality for large datasets
- Export data to file functionality
- History of previous loader data
- Comparison between different loader calls
- Network request inspection
- Performance metrics display
- Component tree visualization

## Conclusion

The development debug tool provides developers with a powerful, easy-to-use interface for inspecting loader data during development. The tool is completely isolated from production builds, ensuring zero performance impact for end users. The interactive JSON tree visualization makes it easy to understand complex nested data structures and debug data flow issues.

