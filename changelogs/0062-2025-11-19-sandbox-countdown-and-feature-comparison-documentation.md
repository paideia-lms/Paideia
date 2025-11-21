# Sandbox Countdown and Feature Comparison Documentation

**Date:** 2025-11-19  
**Type:** Feature Addition & Documentation  
**Impact:** Low - UI enhancement for sandbox mode and documentation for feature comparison

## Overview

This changelog documents the addition of a sandbox countdown component that displays the time remaining until the next scheduled sandbox reset, and the creation of comprehensive Moodle feature comparison documentation for tracking feature parity between Paideia LMS and Moodle LMS.

## Key Changes

### 1. Sandbox Countdown Component

#### New Component: `SandboxCountdown`
- **Location**: `app/components/sandbox-countdown.tsx`
- **Purpose**: Displays a countdown timer showing time remaining until the next sandbox reset
- **Features**:
  - Real-time countdown that updates every second
  - Calculates time until next midnight (00:00:00)
  - Formats time display as hours, minutes, and seconds
  - Positioned as an affix at the bottom-right of the screen
  - Only displays when sandbox mode is enabled
  - Automatically stops updating when countdown reaches zero

**Implementation Details**:
- Uses `@mantine/hooks` `useInterval` for automatic updates
- Uses `@mantine/core` `Affix` component for fixed positioning
- Calculates time difference between current time and next midnight
- Formats time as:
  - `Xh Ym Zs` when hours > 0
  - `Ym Zs` when only minutes > 0
  - `Zs` when only seconds remain
- Styled with dimmed text color and dark background for visibility

**Visual Design**:
- Fixed position at bottom-right (20px from right edge)
- Small text size with dimmed color
- Dark background for contrast
- Padding: 8px vertical, 12px horizontal
- Displays: "This site will be reset in {formattedTime}"

### 2. Root Component Integration

#### Sandbox Countdown Integration in Root Layout
- **Location**: `app/root.tsx`
- **Changes**:
  - Added sandbox mode detection in loader
  - Calculates next reset time (next midnight) when sandbox mode is enabled
  - Passes `isSandboxMode` and `nextResetTime` to root component
  - Conditionally renders `SandboxCountdown` component when sandbox mode is active

**Loader Updates**:
```typescript
// Check if sandbox mode is enabled and calculate next reset time
const isSandboxMode = envVars.SANDBOX_MODE.enabled;
let nextResetTime: string | null = null;
if (isSandboxMode) {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0); // Set to next midnight
  nextResetTime = nextMidnight.toISOString();
}
```

**Component Updates**:
- Added `isSandboxMode` and `nextResetTime` to loader data return
- Conditionally renders `<SandboxCountdown>` component:
  ```tsx
  {isSandboxMode && nextResetTime && (
    <SandboxCountdown nextResetTime={nextResetTime} />
  )}
  ```

### 3. Moodle Feature Comparison Documentation

#### New Documentation: Moodle Features Comparison
- **Location**: `doc/moodle-features-comparison.md`
- **Purpose**: Comprehensive feature list for comparing Moodle LMS and Paideia LMS feature parity
- **Content**:
  - Complete feature list organized by category:
    - Site Features (60+ features)
    - User Features (10+ features)
    - Course Features (15+ features)
    - Resources and Activities Features (100+ features)
    - Blocks (30+ features)
  - Comparison table format showing:
    - Feature name
    - Moodle LMS (web) support status
    - Paideia LMS support status
  - Notes section with links to Moodle plugins
  - Feature summary statistics

**Documentation Structure**:
- Each feature category has its own section
- Features presented in markdown tables
- Status indicators:
  - ✔ = Supported
  - X = Not Supported
  - (empty) = Not yet evaluated
- Includes notes about premium features and plugin support
- Based on Moodle's official feature comparison documentation (April 2025)

**Use Cases**:
- Track feature parity between Paideia LMS and Moodle LMS
- Identify gaps in feature coverage
- Plan feature development priorities
- Reference for migration from Moodle to Paideia
- Documentation for stakeholders and developers

## Technical Implementation

### Sandbox Countdown Component

**Time Calculation**:
- Calculates milliseconds difference between current time and next midnight
- Converts to seconds and ensures non-negative value
- Updates every second using `useInterval` hook

**State Management**:
- Uses `useState` to track remaining seconds
- `useInterval` automatically updates state every second
- Stops interval when countdown reaches zero

**Styling**:
- Uses Mantine's `Affix` component for fixed positioning
- Text styling: small size, dimmed color
- Background: dark theme for visibility
- Responsive positioning at bottom-right corner

### Root Component Integration

**Sandbox Mode Detection**:
- Checks `envVars.SANDBOX_MODE.enabled` from global context
- Only calculates next reset time if sandbox mode is enabled
- Passes ISO string timestamp to countdown component

**Conditional Rendering**:
- Only renders countdown when both conditions are met:
  1. `isSandboxMode` is true
  2. `nextResetTime` is not null
- Component is lightweight and doesn't impact performance when not displayed

## User Experience

### Sandbox Countdown

**Benefits**:
- ✅ Users are aware of when the system will reset
- ✅ Clear visual indication of time remaining
- ✅ Non-intrusive positioning (bottom-right corner)
- ✅ Real-time updates for accurate countdown
- ✅ Automatically hides when countdown completes

**Visual Feedback**:
- Countdown updates smoothly every second
- Time format adapts based on remaining duration
- Dark background ensures visibility on light themes
- Small text size doesn't obstruct main content

### Feature Comparison Documentation

**Benefits**:
- ✅ Comprehensive reference for feature comparison
- ✅ Easy to track feature parity progress
- ✅ Helps prioritize feature development
- ✅ Useful for migration planning
- ✅ Clear status indicators for each feature

## Files Changed

### New Files

1. **`app/components/sandbox-countdown.tsx`**
   - New component for displaying sandbox reset countdown
   - 56 lines
   - Uses Mantine components and hooks

2. **`doc/moodle-features-comparison.md`**
   - Comprehensive Moodle feature comparison documentation
   - 543 lines
   - Organized by feature categories

### Modified Files

1. **`app/root.tsx`**
   - Added sandbox mode detection in loader
   - Added next reset time calculation
   - Added conditional rendering of `SandboxCountdown` component
   - Updated loader data to include `isSandboxMode` and `nextResetTime`

## Dependencies

No new dependencies added. Uses existing Mantine components and hooks:
- `@mantine/core` - `Affix`, `Text`
- `@mantine/hooks` - `useInterval`

## Testing

### Sandbox Countdown Component

**Manual Testing**:
- ✅ Countdown displays when sandbox mode is enabled
- ✅ Countdown updates every second
- ✅ Time format changes based on remaining duration
- ✅ Countdown stops at zero
- ✅ Component doesn't render when sandbox mode is disabled
- ✅ Positioned correctly at bottom-right corner
- ✅ Visible on both light and dark themes

**Edge Cases**:
- ✅ Handles timezone changes correctly
- ✅ Handles browser tab switching (continues counting)
- ✅ Handles page refresh (recalculates time)

### Feature Comparison Documentation

**Verification**:
- ✅ All Moodle features from official documentation included
- ✅ Paideia LMS status accurately reflects current implementation
- ✅ Tables properly formatted in markdown
- ✅ All categories properly organized
- ✅ Notes and links are accurate

## Future Work

### Sandbox Countdown

**Potential Enhancements**:
- Add warning when countdown is below a certain threshold (e.g., 1 hour)
- Add option to dismiss countdown temporarily
- Add sound notification before reset (configurable)
- Show reset history or last reset time
- Add admin setting to customize countdown position

### Feature Comparison Documentation

**Potential Enhancements**:
- Add feature priority indicators
- Add implementation roadmap
- Add migration guides for specific features
- Add feature request tracking
- Add automated feature detection from codebase
- Regular updates as new features are implemented

## Migration Guide

### No Migration Required

This update is **backward compatible**. Existing installations will continue to work:

- ✅ Sandbox mode continues to work as before
- ✅ Countdown only appears when sandbox mode is enabled
- ✅ No configuration changes needed
- ✅ Documentation is informational only

### Behavior Changes

**Sandbox Mode Display**:

**Before**:
- Sandbox mode warning alert displayed (from previous implementation)
- No countdown timer

**After**:
- Sandbox mode warning alert still displayed (unchanged)
- Additional countdown timer at bottom-right showing time until reset
- Countdown automatically calculates next midnight reset time

## Breaking Changes

None. All changes are backward compatible.

## Related Changelogs

- **0027-2025-11-01-sandbox-mode.md**: Initial sandbox mode implementation
- **0036-2025-11-08-sandbox-reset-preserve-system-tables.md**: Sandbox reset improvements

---

**Summary**: Added a visual countdown timer for sandbox resets and created comprehensive Moodle feature comparison documentation to track feature parity between Paideia LMS and Moodle LMS.

