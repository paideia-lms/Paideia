# Changelog 0047: Package Version Display in System Information Page

**Date**: November 12, 2025  
**Type**: Feature Addition  
**Impact**: Low - Adds package version display to the admin system information page for better version tracking and debugging

## Overview

Added package version display to the admin system information page. The version is now read from `package.json` and displayed in a dedicated "Application" section, making it easier for administrators to identify the current application version at a glance.

## Features Added

### 1. Package Version in Global Context

**Features**:
- Reads package version from `package.json` at server startup
- Stores version in global context for access throughout the application
- Automatically updates when package version changes

**Implementation**:
- Updated `server/index.ts`:
  - Added `packageVersion` constant reading from `packageJson.version`
  - Added `packageVersion` to global context initialization
- Updated `server/contexts/global-context.ts`:
  - Added `packageVersion: string` to global context type definition

**Benefits**:
- ✅ Centralized version management
- ✅ Single source of truth for application version
- ✅ Easy to access from any route or component

### 2. Package Version Display in System Page

**Features**:
- New "Application" section in admin system information page
- Displays current package version prominently
- Consistent styling with other system information sections

**Implementation**:
- Updated `app/routes/admin/system.tsx`:
  - Added `packageVersion` to loader data extraction from global context
  - Added `packageVersion` to component props destructuring
  - Created new `Paper` component with "Application" title
  - Added version display with consistent styling (dimmed label, bold value)

**Benefits**:
- ✅ Quick version identification for administrators
- ✅ Useful for debugging and support purposes
- ✅ Consistent UI with existing system information sections

## Technical Details

### Version Source

The package version is read from `package.json` at server startup:
- Version: `0.6.0`
- Stored in global context for application-wide access
- Available in all routes through React Router context

### UI Layout

The version is displayed in a new "Application" section:
- Located after the "Runtime" section
- Uses Mantine's `Paper` component for consistent styling
- Follows the same layout pattern as other system information sections
- Displays version with a dimmed label and bold value for readability

## Files Changed

### Modified Files
- `server/index.ts` - Added `packageVersion` to global context initialization
- `server/contexts/global-context.ts` - Added `packageVersion` to type definition
- `app/routes/admin/system.tsx` - Added version display in UI and loader data

## Future Enhancements

Potential improvements for future iterations:
- Add version comparison with latest release
- Add changelog link for current version
- Add build date/time information
- Add git commit hash for development builds
- Add version update notifications

