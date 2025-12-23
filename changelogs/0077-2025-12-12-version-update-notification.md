# Changelog 0077: Version Update Notification in System Information Page

**Date**: December 12, 2025  
**Type**: Feature Addition  
**Impact**: Low - Adds automatic version checking and update notifications for administrators

## Overview

Added automatic version checking functionality that compares the current application version with the latest version available on Docker Hub. When a newer version is available, administrators are notified with clear update instructions in the system information page.

## Features Added

### 1. Version Management Internal Function

**Features**:
- Fetches latest semantic version tags from Docker Hub API
- Filters and validates semantic versions using semver
- Compares current version with latest available version
- Returns structured result with update availability status

**Implementation**:
- Created `server/internal/version-management.ts`:
  - `tryGetLatestVersion` function that fetches tags from Docker Hub
  - Filters tags to only include valid semantic versions
  - Uses `semver.rsort` to find the highest version
  - Compares with current version using `semver.gt`
  - Returns `LatestVersionResult` with latest version and update availability

**Benefits**:
- ✅ Centralized version checking logic
- ✅ Follows internal function patterns with Result type
- ✅ Handles errors gracefully
- ✅ Reusable across the application

### 2. Version Update Alert in System Page

**Features**:
- Automatic version check on system information page load
- Visual alert notification when update is available
- Clear update instructions for Docker and non-Docker deployments
- Displays current and latest version numbers

**Implementation**:
- Updated `app/routes/admin/system.tsx`:
  - Added version check in loader using `tryGetLatestVersion`
  - Added `versionInfo` to loader return data
  - Created Mantine `Alert` component to display update notification
  - Includes Docker-specific update commands
  - Links to upgrade documentation for other deployment methods

**Update Instructions**:
- **Docker users**: Quick commands provided inline
  ```bash
  docker compose pull
  docker compose up -d
  docker image prune -f
  ```
- **Other deployments**: Link to upgrade documentation at https://docs.paideialms.com/en/upgrade/

**Benefits**:
- ✅ Proactive update notifications for administrators
- ✅ Clear, actionable update instructions
- ✅ Differentiated instructions for Docker vs. other deployments
- ✅ Non-intrusive alert that doesn't block page usage

### 3. Error Handling

**Features**:
- Graceful error handling for version check failures
- New `VersionCheckError` class for version-related errors
- Silent failure - page still loads even if version check fails

**Implementation**:
- Added `VersionCheckError` to `app/utils/error.ts`
- Added error to `transformError` function
- Version check failures don't prevent page from loading
- Errors are logged but don't interrupt user experience

**Benefits**:
- ✅ Resilient to network or API failures
- ✅ System information page remains functional even if version check fails
- ✅ Proper error classification for debugging

## Technical Details

### Version Check Process

1. **API Request**: Fetches up to 100 tags from Docker Hub API
2. **Version Filtering**: Filters tags to only include valid semantic versions
3. **Version Sorting**: Sorts versions from highest to lowest using semver
4. **Comparison**: Compares latest version with current package version
5. **Result**: Returns update availability status

### Docker Hub API

- **Endpoint**: `https://hub.docker.com/v2/repositories/hananoshikayomaru/paideia/tags/`
- **Page Size**: 100 tags (covers extensive version history)
- **Repository**: `hananoshikayomaru/paideia`

### Version Comparison

- Uses `semver` library for semantic version comparison
- Only considers valid semantic version tags (e.g., `0.7.4`)
- Filters out non-version tags like `latest`, `dev`, `stable`
- Handles version prefixes automatically

## Files Changed

### New Files
- `server/internal/version-management.ts` - Version checking internal function

### Modified Files
- `app/routes/admin/system.tsx` - Added version check and update alert
- `app/utils/error.ts` - Added `VersionCheckError` class

## User Experience

### For Administrators

When a newer version is available:
1. Visit the System Information page (`/admin/system`)
2. See a blue alert at the top of the page indicating an update is available
3. View current and latest version numbers
4. Follow provided update instructions based on deployment method

### Update Instructions Display

The alert shows:
- Current version number
- Latest available version number
- Docker-specific commands (for Docker deployments)
- Link to upgrade documentation (for other deployments)

## Future Enhancements

Potential improvements for future iterations:
- Add version check caching to reduce API calls
- Add manual "Check for Updates" button
- Show changelog link for new version
- Add update history tracking
- Support for different update channels (stable, beta, dev)
- Email notifications for critical updates
- Version check scheduling/automation

