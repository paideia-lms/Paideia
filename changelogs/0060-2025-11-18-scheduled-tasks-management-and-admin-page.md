# Scheduled Tasks Management and Admin Page

**Date:** 2025-11-18  
**Type:** Feature Addition  
**Impact:** Medium - Adds visibility and management for scheduled one-time jobs (e.g., auto-submit quiz)

## Overview

This changelog documents the addition of a scheduled tasks management system and admin page. This feature allows administrators to view and monitor all scheduled one-time jobs in the system, such as auto-submit quiz jobs that are scheduled when a student starts a quiz with a time limit. The implementation includes a new internal management function and a comprehensive admin page with statistics and detailed task information.

## Key Features

### 1. Scheduled Tasks Management Function

**Location**: `server/internal/scheduled-tasks-management.ts`

**Features**:
- Created `tryGetScheduledTasks()` function to retrieve all scheduled tasks from the database
- Created `tryGetPendingScheduledTasks()` helper function for pending tasks only
- Queries `payload_jobs` table for jobs with `waitUntil` timestamp (scheduled tasks)
- Determines task status: `pending`, `processing`, `completed`, `failed`, or `expired`
- Provides statistics: total pending, processing, completed, failed, and expired tasks
- Uses Drizzle ORM for efficient database queries

**Implementation Details**:
- Queries jobs where `waitUntil` is not null (identifies scheduled tasks)
- Orders results by `waitUntil` timestamp (upcoming tasks first)
- Status determination logic:
  - `completed`: Job has `completedAt` timestamp
  - `failed`: Job completed but has `hasError` flag
  - `processing`: Job is currently being processed (`processing` flag is true)
  - `expired`: Job's `waitUntil` time has passed but hasn't been completed or started
  - `pending`: Job is waiting for its scheduled time
- Returns comprehensive task information including task slug, queue, input, metadata, and error details

**Interfaces**:
```typescript
export interface ScheduledTaskInfo {
  id: number;
  taskSlug: string | null;
  queue: string | null;
  waitUntil: string | null;
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  createdAt: string;
  completedAt: string | null;
  processing: boolean | null;
  hasError: boolean | null;
  error: unknown | null;
  input: unknown;
  meta: unknown;
}

export interface GetScheduledTasksResult {
  scheduledTasks: ScheduledTaskInfo[];
  totalPending: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  totalExpired: number;
}
```

### 2. Admin Scheduled Tasks Page

**Location**: `app/routes/admin/scheduled-tasks.tsx`

**Features**:
- Displays all scheduled tasks in a comprehensive table
- Shows task statistics with color-coded badges
- Provides detailed task information including:
  - Task name (human-readable)
  - Task slug
  - Queue name
  - Scheduled execution time
  - Current status
  - Creation timestamp
  - Completion timestamp
- Color-coded status badges for quick visual identification
- Responsive design using Mantine components

**UI Components**:
- **Statistics Section**: Displays counts for each status type with color-coded badges
  - Blue: Pending
  - Yellow: Processing
  - Green: Completed
  - Red: Failed
  - Orange: Expired
- **Tasks Table**: Comprehensive table showing all scheduled tasks
  - Task name column (human-readable names like "Auto Submit Quiz")
  - Task slug column
  - Queue column
  - Scheduled For column (formatted timestamp)
  - Status column (color-coded badge)
  - Created At column
  - Completed At column
- **Auto-Refresh**: Page automatically refreshes every second using `useInterval` and `useRevalidator`
  - Real-time status updates without manual page refresh
  - Matches the behavior of the cron jobs page
  - Ensures administrators see the latest task status immediately

**Helper Functions**:
- `getStatusBadge()`: Returns appropriate badge component based on status (with tooltips)
- `formatDateString()`: Formats ISO timestamps for display
- `getTaskName()`: Converts task slug to human-readable name

**Auto-Refresh Implementation**:
- Uses `useInterval` hook from `@mantine/hooks` to trigger refresh every 1000ms
- Uses `useRevalidator` from `react-router` to revalidate loader data
- Automatically invokes on component mount (`autoInvoke: true`)
- Provides real-time updates for task status changes

### 3. Auto-Submit Quiz Job Scheduling

**Location**: `server/internal/quiz-submission-management.ts`

**Features**:
- Automatically schedules an `autoSubmitQuiz` job when a quiz attempt is started
- Calculates expiration time based on `startedAt` + `globalTimer` (in seconds)
- Schedules job using `payload.jobs.queue()` with `waitUntil` property
- Handles errors gracefully (logs warning but doesn't fail quiz start)
- Only schedules if quiz has a `globalTimer` > 0

**Implementation**:
```typescript
// Schedule auto-submit job if quiz has a time limit
if (quiz) {
  const rawConfig = quiz.rawQuizConfig as unknown as QuizConfig | null;
  const globalTimer = rawConfig?.globalTimer;

  if (globalTimer && globalTimer > 0) {
    const expirationTime = new Date(
      new Date(startedAt).getTime() + globalTimer * 1000,
    );

    if (req) {
      try {
        await payload.jobs.queue({
          task: "autoSubmitQuiz",
          input: {
            submissionId: submission.id,
          },
          waitUntil: expirationTime,
          queue: "default",
        });
      } catch (error) {
        payload.logger.warn(
          `Failed to schedule auto-submit job for submission ${submission.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }
}
```

**Fix Applied**:
- Added `req: request` parameter to `tryStartQuizAttempt()` call in `app/routes/course/module.$id/route.tsx`
- This ensures the job scheduling check (`if (req)`) passes and jobs are properly scheduled

### 4. Admin Integration

**Files Modified**:
- `app/routes.ts`: Added route for `admin/scheduled-tasks`
- `server/contexts/global-context.ts`: Added `isAdminScheduledTasks` to `PageInfo`
- `server/index.ts`: Initialized `isAdminScheduledTasks` in page info
- `app/root.tsx`: Added route detection for scheduled tasks page
- `app/layouts/server-admin-layout.tsx`: Added scheduled tasks to Server tab navigation
- `app/routes/admin/index.tsx`: Added link to scheduled tasks page under Server section

**Navigation**:
- Scheduled tasks page is accessible from the admin dashboard under the "Server" section
- Page is included in the Server tab navigation in the admin layout
- Route: `/admin/scheduled-tasks`

## Technical Details

### Database Query

**Query Structure**:
```typescript
const scheduledJobs = await drizzle
  .select({
    id: payload_jobs.id,
    taskSlug: payload_jobs.taskSlug,
    queue: payload_jobs.queue,
    waitUntil: payload_jobs.waitUntil,
    createdAt: payload_jobs.createdAt,
    completedAt: payload_jobs.completedAt,
    processing: payload_jobs.processing,
    hasError: payload_jobs.hasError,
    error: payload_jobs.error,
    input: payload_jobs.input,
    meta: payload_jobs.meta,
  })
  .from(payload_jobs)
  .where(isNotNull(payload_jobs.waitUntil))
  .orderBy(desc(payload_jobs.waitUntil));
```

**Key Points**:
- Filters for jobs with `waitUntil` not null (scheduled tasks)
- Orders by `waitUntil` descending (upcoming tasks first)
- Retrieves all relevant job information in a single query

### Status Determination Logic

**Status Priority**:
1. **Completed**: If `completedAt` exists
   - If `hasError` is true → `failed`
   - Otherwise → `completed`
2. **Processing**: If `processing` flag is true
3. **Expired**: If `waitUntil` time has passed but job hasn't been completed or started
4. **Pending**: Default status for jobs waiting for their scheduled time

**Important Fix**:
- Fixed status determination bug where future scheduled tasks were incorrectly marked as "expired"
- Changed from string comparison (`job.waitUntil < now`) to Date object comparison
- Now properly converts `waitUntil` string to Date object before comparison: `new Date(job.waitUntil) < new Date()`
- This ensures accurate status determination for all scheduled tasks

### Error Handling

**Job Scheduling**:
- Errors during job scheduling are caught and logged as warnings
- Quiz start process continues even if job scheduling fails
- Prevents job scheduling failures from blocking quiz attempts

**Data Retrieval**:
- Uses Result pattern for error handling
- Transforms errors using `transformError()` utility
- Returns `UnknownError` if error transformation fails

## Files Created

### New Files

1. **`server/internal/scheduled-tasks-management.ts`** (158 lines)
   - `ScheduledTaskInfo` interface
   - `GetScheduledTasksResult` interface
   - `tryGetScheduledTasks()` function
   - `tryGetPendingScheduledTasks()` helper function

2. **`app/routes/admin/scheduled-tasks.tsx`** (240 lines)
   - Admin page component
   - Loader function with authentication and authorization checks
   - Statistics display
   - Tasks table with status badges
   - Helper functions for formatting and display
   - Auto-refresh functionality (updates every second)

3. **`server/internal/scheduled-tasks-management.test.ts`** (338 lines)
   - Comprehensive test suite for scheduled tasks management
   - Tests status determination logic (pending, expired, completed, failed, processing)
   - Tests statistics calculation
   - Verifies Date object comparison fix for status determination
   - 6 test cases covering all status scenarios

## Files Modified

1. **`app/routes/course/module.$id/route.tsx`**
   - Added `req: request` parameter to `tryStartQuizAttempt()` call
   - Ensures job scheduling works correctly

2. **`app/routes.ts`**
   - Added route: `route("admin/scheduled-tasks", "routes/admin/scheduled-tasks.tsx")`

3. **`server/contexts/global-context.ts`**
   - Added `isAdminScheduledTasks: boolean;` to `PageInfo` interface

4. **`server/index.ts`**
   - Initialized `isAdminScheduledTasks: false` in page info

5. **`app/root.tsx`**
   - Added route detection: `else if (route.id === "routes/admin/scheduled-tasks") isAdminScheduledTasks = true;`
   - Added `isAdminScheduledTasks` to pageInfo object

6. **`app/layouts/server-admin-layout.tsx`**
   - Added `pageInfo.isAdminScheduledTasks` to Server tab condition

7. **`app/routes/admin/index.tsx`**
   - Added link to scheduled tasks page under Server section

8. **`server/internal/scheduled-tasks-management.ts`**
   - Fixed status determination bug: Changed from string comparison to Date object comparison
   - Updated `tryGetScheduledTasks()` to use `new Date()` instead of `new Date().toISOString()` for `now`
   - Updated `tryGetPendingScheduledTasks()` with the same fix
   - Properly converts `waitUntil` string to Date object before comparison
   - Removed unused `lte` import from Drizzle ORM

9. **`app/routes/admin/scheduled-tasks.tsx`**
   - Added `useInterval` import from `@mantine/hooks`
   - Added `useRevalidator` import from `react-router`
   - Implemented auto-refresh functionality (updates every second)
   - Ensures real-time status updates for scheduled tasks

## User Impact

### Admin Benefits

**Visibility**:
- ✅ View all scheduled tasks in one place
- ✅ Monitor task status in real-time
- ✅ Identify failed or expired tasks
- ✅ Track task execution history

**Monitoring**:
- ✅ Quick overview with statistics badges
- ✅ Detailed task information in table format
- ✅ Easy identification of problematic tasks
- ✅ Better understanding of system job queue
- ✅ Real-time status updates (auto-refresh every second)
- ✅ Accurate status determination (pending vs expired)

**Debugging**:
- ✅ See which tasks are pending execution
- ✅ Identify tasks that failed to execute
- ✅ Monitor auto-submit quiz jobs
- ✅ Track task scheduling patterns

### Student Benefits

**Auto-Submit Feature**:
- ✅ Quizzes with time limits are automatically submitted when timer expires
- ✅ No manual intervention required
- ✅ Prevents students from exceeding time limits
- ✅ Ensures fair quiz completion

## Migration Notes

### No Breaking Changes

This update is **backward compatible**. All existing functionality continues to work:

- ✅ No database migrations required
- ✅ No configuration changes needed
- ✅ No API changes
- ✅ Existing jobs continue to work as before

### New Features Available

**Scheduled Tasks Page**:
- Accessible at `/admin/scheduled-tasks`
- Requires admin role
- Automatically displays all scheduled tasks
- Statistics update in real-time on page load

**Auto-Submit Jobs**:
- Automatically scheduled when quiz attempts start
- Only for quizzes with `globalTimer` > 0
- Jobs appear in scheduled tasks page
- Execute automatically when timer expires

## Testing Considerations

### Manual Testing Checklist

- [ ] Scheduled tasks page loads correctly
- [ ] Statistics display correct counts
- [ ] Task table displays all scheduled tasks
- [ ] Status badges show correct colors
- [ ] Task names are human-readable
- [ ] Timestamps format correctly
- [ ] Auto-submit jobs appear when quiz starts
- [ ] Job status updates correctly (pending → processing → completed)
- [ ] Failed jobs show correct status
- [ ] Expired jobs are identified correctly
- [ ] Page requires admin authentication
- [ ] Navigation links work correctly
- [ ] Page auto-refreshes every second
- [ ] Status updates appear in real-time without manual refresh
- [ ] Future scheduled tasks show as "pending" (not "expired")

### Integration Testing

- [ ] Quiz start creates auto-submit job
- [ ] Job appears in scheduled tasks page
- [ ] Job executes when timer expires
- [ ] Job status updates after execution
- [ ] Failed jobs show error information
- [ ] Multiple concurrent jobs are handled correctly

## Future Enhancements

### Potential Improvements

1. **Real-Time Updates**: ✅ **COMPLETED** - Auto-refresh implemented (updates every second)
2. **Filtering**: Add filters by status, task type, date range
3. **Pagination**: Add pagination for large task lists
4. **Search**: Add search functionality for specific tasks
5. **Actions**: Add ability to cancel pending tasks
6. **Retry**: Add ability to retry failed tasks
7. **Export**: Add export functionality (CSV, JSON)
8. **Details View**: Add detailed view for individual tasks
9. **Timeline**: Add timeline visualization for task execution
10. **Notifications**: Add notifications for failed or expired tasks

### Task Management

- Add ability to manually schedule tasks
- Add ability to reschedule tasks
- Add ability to view task input/output
- Add ability to view task execution logs
- Add task execution metrics and analytics

## Performance Considerations

### Query Optimization

- Uses indexed columns (`waitUntil`, `completedAt`, `processing`)
- Single query retrieves all necessary data
- Orders results efficiently
- No N+1 query problems

### Scalability

- Query can be optimized with pagination if needed
- Status calculation is done in-memory (efficient)
- Statistics calculation is O(n) where n is number of tasks
- Can be cached if needed for high-traffic scenarios

## Security Considerations

### Access Control

- Page requires admin authentication
- Uses `ForbiddenResponse` for unauthorized access
- Loader checks user role before allowing access
- Follows existing admin page security patterns

### Data Exposure

- Only admins can view scheduled tasks
- Task input may contain sensitive data (should be reviewed)
- Error messages may contain system information (admin-only access mitigates risk)

## Related Features

### Auto-Submit Quiz Task

**Location**: `server/tasks/auto-submit-quiz.ts`

**Integration**:
- Task is registered in `payload.config.ts`
- Handler automatically submits quiz when timer expires
- Uses `bypassTimeLimit: true` to allow submission after timer
- Returns success/failure status

**Workflow**:
1. Student starts quiz → `tryStartQuizAttempt()` called
2. Job scheduled with `waitUntil = startedAt + globalTimer`
3. Job appears in scheduled tasks page
4. When timer expires, job executes automatically
5. Quiz is submitted with `bypassTimeLimit: true`
6. Job status updates to `completed` or `failed`

## Bug Fixes

### Status Determination Fix

**Issue**: Future scheduled tasks were incorrectly marked as "expired" instead of "pending"

**Root Cause**: The code was comparing string timestamps directly (`job.waitUntil < now`), which doesn't work reliably for timestamp comparisons.

**Solution**:
- Changed `now` from `new Date().toISOString()` (string) to `new Date()` (Date object)
- Convert `waitUntil` string to Date object before comparison: `new Date(job.waitUntil) < new Date()`
- Applied fix to both `tryGetScheduledTasks()` and `tryGetPendingScheduledTasks()` functions

**Testing**:
- Created comprehensive test suite (`scheduled-tasks-management.test.ts`)
- Tests verify correct status determination for all scenarios:
  - Future tasks → "pending" ✓
  - Past tasks → "expired" ✓
  - Completed tasks → "completed" ✓
  - Failed tasks → "failed" ✓
  - Processing tasks → "processing" ✓
- All 6 tests pass successfully

## Conclusion

This feature adds comprehensive visibility and management for scheduled tasks in the system. Administrators can now monitor all scheduled one-time jobs, including auto-submit quiz jobs, through a dedicated admin page with real-time updates. The implementation follows existing patterns in the codebase and integrates seamlessly with the admin interface. The auto-submit quiz feature ensures fair quiz completion by automatically submitting quizzes when their time limits expire.

The scheduled tasks management system provides a solid foundation for future enhancements and makes it easier to monitor and debug job execution in the system. The bug fix ensures accurate status determination, and the auto-refresh feature provides real-time visibility into task status changes.

