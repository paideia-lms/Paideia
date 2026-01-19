# Course Schedule Management and Calendar View

**Date:** 2026-01-17  
**Type:** Feature, UI/UX Enhancement  
**Impact:** Medium - Significantly improves course scheduling and visibility

## Overview

This update introduces a comprehensive course schedule management system and a dedicated calendar view. Users can now define complex schedules including recurring patterns and specific dates, and view them in a clean, visual calendar format on the course information page.

## Key Features

### 1. Advanced Schedule Management
- **Unified Modal**: Combined recurring and specific date entry into a single, intuitive modal.
- **Recurring Patterns**: Support for selecting multiple days of the week with optional start and end date ranges.
- **Specific Dates**: Ability to add one-off sessions for specific dates.
- **Time Validation**: Ensures start times are before end times and handles all time-related logic via `dayjs`.

### 2. Course Calendar Section
- **Visual Schedule**: Integrated FullCalendar to display course sessions.
- **Supported Views**:
  - **Week View**: Detailed time-grid layout showing the weekly rhythm.
  - **Month View**: Bird's-eye view of all upcoming sessions.
- **Automatic Projection**: Recurring schedules are automatically projected 12 months into the future for long-term planning.
- **Responsive Design**: Calendar adapts its height and layout to maintain readability.

### 3. Formatted Schedule Strings
- New utility functions to generate human-readable schedule summaries (e.g., "Mon, Wed 09:00-12:00; Jan 20 14:00-16:00").
- Displayed in the course info card for quick reference.

## Technical Changes

### New Components & Utilities
- **`CourseCalendarView`** (`app/components/course-calendar-view.tsx`): A specialized component wrapping FullCalendar with custom event generation logic.
- **`CourseScheduleManager`** (`app/components/course-schedule-manager.tsx`): Integrated management UI for instructors.
- **Schedule Utilities** (`app/utils/schedule-utils.ts`): Shared logic for formatting and validating schedule data structures (V1).
- **Zod Schemas** (`app/utils/schedule-types.ts`): Strong typing and validation for schedule data.

### Page Integration
- Updated `app/routes/course.$id.tsx` to include the calendar section within a premium Mantine `Paper` wrapper.
- Integrated schedule management into course settings.

## Implementation Details

### Event Generation Logic
The calendar dynamically generates events from JSON-stored schedule data:
- **Recurring Events**: Iterates through the next 12 months, checking days of the week and applying date range filters.
- **Specific Events**: Maps one-off dates directly to calendar events.

### UI Consistency
- Uses Mantine's `SegmentedControl` and `DateInput` for a native, high-quality feel.
- Consistent color coding and icon usage (using `tabler-icons`).

## User Impact

### For Instructors
- Easier management of complex course schedules.
- Clear visual confirmation of scheduled sessions.
- Ability to quickly identify scheduling conflicts.

### For Students
- Clear understanding of when they need to be present.
- Visual rhythm of the course at a glance.
- Accurate information on one-off changes to the regular schedule.

---

**Summary**: Implemented a robust course schedule management system and a visual calendar view using FullCalendar. Support for recurring patterns and specific dates with automatic projection and formatted text summaries.
