# Changelog 0024: Notes Page Timezone Fix and Improvements

**Date**: October 31, 2025  
**Type**: Bug Fix & Feature Enhancement  
**Impact**: High - Fixes timezone discrepancies and improves user experience on the notes page

## Overview

This update fixes critical timezone-related bugs in the notes page where clicking dates on the calendar would display notes for the wrong day. The fix implements proper timezone handling using client hints, refactors the page into reusable components, and extracts shared utilities. Additionally, the page now includes interactive heatmap clicks and calendar tooltips showing note counts.

## Issues Fixed

### 1. Timezone Discrepancy Bug

**Problem**: When clicking a date on the calendar (e.g., Oct 31), the query state would become a different date (e.g., Oct 30), causing notes to be filtered incorrectly.

**Root Cause**: 
- JavaScript's `new Date("YYYY-MM-DD")` interprets date strings as UTC midnight
- When converting to local timezone (e.g., America/Vancouver UTC-7), UTC midnight becomes the previous day at 5 PM
- This caused date comparisons to fail, showing notes for the wrong day

**Solution**: 
- Implemented client hints using `@epic-web/client-hints` to detect user's timezone
- Created safe date parsing utilities that extract date components directly without timezone conversion
- Ensured all date formatting uses the client's detected timezone consistently

### 2. Date Parsing Inconsistencies

**Problem**: Different parts of the codebase parsed date strings inconsistently, leading to timezone-related bugs.

**Solution**:
- Created `parseDateString` helper that safely extracts year, month, and day components
- Avoids `new Date()` constructor for plain date strings to prevent UTC interpretation
- Handles both ISO format strings and plain date strings correctly

## Features Added

### 1. Client Hints Integration

- **Global Context Integration**: Client hints (timezone) are now available in the global context, accessible from any route
- **Server-Side Access**: Timezone is retrieved in `server/index.ts` and made available via `globalContextKey`
- **Client-Side Access**: Timezone is passed through loader data to React components

**Implementation**:
- Added `getHints` call in `server/index.ts` to extract timezone from request headers
- Updated `server/contexts/global-context.ts` to include `hints` property
- Client hints are automatically detected via `<ClientHintCheck>` script in `app/root.tsx`

### 2. Query State Management

- **URL-Based State**: Selected date is now stored in URL query parameters using `nuqs`
- **Server-Side Filtering**: Notes are filtered on the server based on the date query parameter
- **Navigation Integration**: Setting a date triggers navigation (shallow: false) for proper server-side revalidation

**Benefits**:
- Shareable URLs with date filter applied
- Browser back/forward button support
- Server-side filtering reduces client-side computation

### 3. Component Refactoring

The notes page was refactored into three main components for better organization and maintainability:

- **HeatmapSection**: Displays activity heatmap with year selector
- **CalendarSection**: Displays interactive calendar with date selection
- **NotesSection**: Displays filtered notes list with edit/delete actions

### 4. Calendar Enhancements

- **renderDay Prop**: Custom rendering for each calendar day with:
  - Blue indicator dot when notes exist on that day
  - Tooltip showing note count and date on hover
  - Proper styling with flexbox layout

- **Interactive Heatmap**: Clicking on heatmap rectangles now sets the selected date

### 5. Utility Extraction

- **Date Utility**: Extracted `formatDateInTimeZone` to `app/utils/date-utils.ts` for reuse
- **Centralized Logic**: All timezone-aware date formatting now uses the shared utility

## Technical Implementation

### Client Hints Setup

1. **Global Context** (`server/contexts/global-context.ts`):
   - Added `hints: { timeZone?: string }` to context type

2. **Server Middleware** (`server/index.ts`):
   - Call `getHints(request)` in `getLoadContext`
   - Store hints in `globalContextKey` for access across all routes

3. **Root Layout** (`app/root.tsx`):
   - Added `ClientHintCheck` component that renders client hint detection script
   - Passes hints through loader data

### Query State Implementation

1. **Search Params Schema** (`app/routes/user/notes.tsx`):
   ```typescript
   export const notesSearchParams = {
     date: parseAsString,
   };
   export const loadSearchParams = createLoader(notesSearchParams);
   ```

2. **Loader**:
   - Reads `date` parameter from request
   - Filters notes server-side using client timezone
   - Returns both all notes and filtered notes

3. **Component**:
   - Uses `useQueryState` with `shallow: false` for navigation
   - Date clicks update URL, triggering server-side revalidation

### Safe Date Parsing

Created `parseDateString` helper that handles both date formats:

```typescript
const parseDateString = (dateStr: string): { year: number; month: number; day: number } => {
  if (dateStr.includes("T")) {
    // ISO string - parse and use local components
    const date = new Date(dateStr);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  } else {
    // Plain date string - parse directly to avoid UTC interpretation
    const [year, month, day] = dateStr.split("-").map(Number);
    return { year, month, day };
  }
};
```

### Date Utility Function

```typescript
export function formatDateInTimeZone(date: string | Date, tz?: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (tz) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(dateObj);
  }
  return dayjs(dateObj).format("YYYY-MM-DD");
}
```

## Files Changed

- `app/routes/user/notes.tsx` - Main notes page with all improvements
- `server/contexts/global-context.ts` - Added hints to context type
- `server/index.ts` - Added getHints call in middleware
- `app/root.tsx` - Added ClientHintCheck component
- `app/utils/date-utils.ts` - New utility file for date formatting
- `app/utils/client-hints.ts` - Exports client hints utilities

## Best Practices for Future Development

### 1. Timezone Handling

**Always use client hints for timezone-aware operations**:
- Don't assume server timezone matches client timezone
- Use `@epic-web/client-hints` to detect user's timezone
- Pass timezone through global context for server-side operations

**Date parsing best practices**:
- **Avoid**: `new Date("YYYY-MM-DD")` - interprets as UTC midnight
- **Use**: Direct component extraction for plain date strings
  ```typescript
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day); // Local timezone
  ```
- **For ISO strings**: Parse and use local components (`getFullYear()`, `getMonth()`, `getDate()`)
- **For server timestamps**: Use `Intl.DateTimeFormat` with explicit timezone

### 2. Date Formatting

**Extract date utilities to shared files**:
- Create utilities in `app/utils/date-utils.ts` for reuse
- Document timezone behavior in function JSDoc
- Use consistent format strings across the codebase (YYYY-MM-DD for storage, user-friendly formats for display)

**Format dates consistently**:
- Server-side: Use client timezone from hints
- Client-side: Use detected timezone or local timezone
- Display: Use dayjs for formatting, Intl for timezone conversion

### 3. Query State Management

**Use nuqs for URL-based state**:
- Store filter/selection state in URL query parameters
- Use `shallow: false` when server-side filtering is needed
- Define search params schemas using `createLoader` for type safety

**Benefits**:
- Shareable URLs with filters applied
- Browser navigation support (back/forward)
- Server-side data fetching based on URL state

### 4. Component Organization

**Break down large pages into focused components**:
- Extract logical sections into separate component functions
- Keep components in the same file for related functionality
- Pass only necessary props to avoid prop drilling

**Component structure example**:
```typescript
// Section components
function SectionA({ ... }) { ... }
function SectionB({ ... }) { ... }

// Main page component
export default function Page({ loaderData }) {
  // Shared logic and state
  return (
    <Container>
      <SectionA {...props} />
      <SectionB {...props} />
    </Container>
  );
}
```

### 5. Date Comparisons

**Always compare dates in the same timezone**:
- Format both dates using the same timezone before comparison
- Use `YYYY-MM-DD` format for date-only comparisons
- Don't rely on Date object equality - format as strings first

**Example**:
```typescript
// Good: Format both dates in same timezone
const date1Str = formatDateInTimeZone(date1, timeZone);
const date2Str = formatDateInTimeZone(date2, timeZone);
const match = date1Str === date2Str;

// Bad: Direct Date comparison
const match = date1.getTime() === date2.getTime(); // May fail due to time components
```

### 6. Testing Timezone-Dependent Features

**Test in multiple timezones**:
- Test with different browser timezone settings
- Verify server-side filtering works correctly
- Check that date formatting displays correctly
- Ensure date selection matches displayed dates

**Common issues to watch for**:
- Date shifts when clicking calendar dates
- Wrong notes displayed after date selection
- Heatmap highlighting incorrect dates
- Tooltip dates not matching selected date

## Testing Checklist

- [x] Clicking calendar date sets correct query parameter
- [x] Notes are filtered correctly by selected date
- [x] Heatmap click sets correct date
- [x] Tooltip shows correct note count
- [x] Date formatting uses client timezone
- [x] Server-side filtering uses detected timezone
- [x] Calendar highlight matches selected date
- [x] Browser back/forward works with date filter
- [x] URL can be shared with date filter applied

## Migration Notes

No migration needed - this is a bug fix and enhancement. Existing notes data is unaffected. The change only affects how dates are displayed and filtered in the UI.

