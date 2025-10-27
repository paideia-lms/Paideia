# 0013 - Dashboard Page with Interactive Curriculum Map

**Date**: 2025-10-27  
**Type**: Feature

## Summary

Implemented a comprehensive dashboard page for the index route (`/`) with different views for authenticated and public users. The authenticated view includes a personalized greeting, program information, an interactive curriculum map with 44 courses using React Flow, recent courses with progress tracking, calendar widget with due dates, and recent notes.

## Features

### For Authenticated Users

#### 1. Personalized Greeting Header
- Dynamic greeting based on time of day (Good morning/afternoon/evening)
- Displays user's first name
- Shows current date in readable format (e.g., "Monday, October 27, 2025")
- Quick action buttons to "My Courses" and "Profile"

#### 2. Program Card
- Displays current academic program (e.g., "Bachelor in Business Administration")
- Shows program description
- Uses Mantine ThemeIcon with school icon

#### 3. Interactive Curriculum Map
The centerpiece of the dashboard - a visual curriculum map built with `@xyflow/react` showing the entire 4-year program structure.

**Layout:**
- 8 vertical columns representing semesters (left to right)
- Each semester labeled with "Semester X" and "Year Y - Fall/Spring"
- 44 courses total organized across 8 semesters
- ~5-6 courses per semester

**Course Nodes:**
- Display course code (e.g., "COMP 101", "MATH 140")
- Display course title
- Status badge (completed/active/inactive)
- Color-coded by status:
  - Green for completed courses
  - Blue for active courses
  - Gray for future/inactive courses

**Prerequisite Connections:**
- Smooth bezier curves connecting prerequisite courses
- Connections flow left to right (earlier → later semesters)
- Connection points on left and right sides of nodes (not top/bottom)
- Animated edges for active courses
- Color-coded edges matching course status
- Minimal line overlap due to horizontal flow

**Interactive Features:**
- Pan and zoom controls
- Drag to navigate
- Background grid for reference
- fitView on load to show entire curriculum

**Course Organization:**
```
Semester 1 (Year 1 - Fall): 5 foundation courses
Semester 2 (Year 1 - Spring): 5 courses
Semester 3 (Year 2 - Fall): 5 courses  
Semester 4 (Year 2 - Spring): 5 courses
Semester 5 (Year 3 - Fall): 6 courses
Semester 6 (Year 3 - Spring): 6 courses
Semester 7 (Year 4 - Fall): 6 courses
Semester 8 (Year 4 - Spring): 6 courses (includes capstones)
```

**Department Codes:**
- COMP: Computer Science
- MATH: Mathematics
- COMM: Communication
- ECON: Economics
- ACCT: Accounting
- STAT: Statistics
- FINC: Finance
- MKTG: Marketing
- MGMT: Management
- RSRH: Research

#### 4. Recent Courses Grid
- Card-based layout showing up to 6 recent courses
- Each card displays:
  - Course thumbnail placeholder
  - Course title
  - Category badge
  - Enrollment status badge (active/completed/dropped)
  - Completion progress bar with percentage
- Responsive grid (1 column on mobile, 2 on tablet, 3 on desktop)
- Links to individual course pages
- Empty state when no courses are enrolled

#### 5. Calendar Widget (Sidebar)
- Shows "Today's Schedule" with items due today
- Displays:
  - Assignment titles with due times
  - Quiz due dates
  - Discussion deadlines
- Color-coded badges by type:
  - Blue for assignments
  - Green for quizzes
  - Orange for discussions
- Shows course title for each item
- Empty state message when nothing is due

#### 6. Recent Notes (Sidebar)
- Shows last 5 notes created by the user
- Displays note title and creation date
- "View All" button linking to notes page
- Empty state when no notes exist

### For Public Users

#### 1. Hero Section
- Large welcome message: "Welcome to Paideia LMS"
- Platform tagline
- Gradient theme icon
- Call-to-action buttons:
  - Login button
  - Register button (placeholder link)

#### 2. Featured Courses
- Grid of 6 featured courses
- Each course shows:
  - Title and description
  - Category badge
  - Course slug
  - Thumbnail placeholder
- Responsive grid layout

#### 3. Platform Features Showcase
- 8 feature cards in grid layout highlighting:
  - Course Management
  - Grade Tracking
  - Discussions
  - Rich Content
  - User Management
  - Personal Notes
  - Program Tracking
  - Calendar & Scheduling
- Each card has:
  - Colored icon
  - Feature title
  - Brief description

## Technical Implementation

### Data Structure

All data is mocked in the loader to avoid database queries on the index route:

**Authenticated User Data:**
```typescript
{
  isAuthenticated: true,
  user: { firstName, lastName },
  program: { id, name, description },
  curriculumCourses: Array<{
    id, code, title, status, semester, prerequisites[]
  }>,
  recentCourses: Array<{
    id, title, slug, category, status, role, completionPercentage
  }>,
  recentNotes: Array<{
    id, title, createdAt
  }>,
  todaysDueItems: Array<{
    id, title, type, dueDate, courseTitle, courseId
  }>
}
```

**Public User Data:**
```typescript
{
  isAuthenticated: false,
  featuredCourses: Array<{
    id, title, description, slug, category, thumbnailUrl
  }>
}
```

### React Flow Curriculum Map

**Key Technical Decisions:**

1. **Semester-based Layout Algorithm:**
   - Groups courses by semester property
   - Calculates column positions (300px apart)
   - Stacks courses vertically within each semester (140px apart)
   - Adds 60px space at top for semester labels

2. **Node Configuration:**
   - Semester label nodes (non-interactive)
   - Course nodes with left/right connection points
   - Uses `Position.Right` for source, `Position.Left` for target
   - Ensures horizontal flow of prerequisite connections

3. **Edge Configuration:**
   - Type: "default" (bezier curves)
   - Animated edges for active courses
   - Color-coded by course status
   - 2px stroke width

4. **Component Structure:**
```typescript
function CurriculumMap({
  courses: Array<{
    id, code, title, status, semester, prerequisites
  }>
})
```

### Mantine Components Used

- `Container`, `Stack`, `Group`, `Grid` - Layout
- `Paper`, `Card` - Containers with borders
- `Title`, `Text` - Typography
- `Badge` - Status indicators
- `Button` - Navigation actions
- `ThemeIcon` - Decorative icons
- `Progress` - Completion bars
- `Box` - React Flow container
- `SimpleGrid` - Responsive grids

### Styling Approach

- **No Tailwind classes** (per workspace rules)
- Mantine design tokens only
- Inline styles for React Flow specific properties
- Consistent spacing with Mantine's gap system
- Color system using `var(--mantine-color-*)` variables

## Files Changed

- `app/routes/index.tsx`
  - Completely rewrote from basic placeholder to full dashboard
  - Added loader with authentication check
  - Created mock data for all dashboard sections
  - Implemented `CurriculumMap` component with React Flow
  - Implemented `AuthenticatedDashboard` component
  - Implemented `PublicDashboard` component
  - Added proper SEO meta tags
  - Imported icons from `@tabler/icons-react`
  - Imported React Flow components and styles

## Dependencies

All required packages were already installed:
- `@xyflow/react` (v12.9.0) - For curriculum map
- `@mantine/core` (v8.3.5) - UI components
- `@tabler/icons-react` (v3.35.0) - Icons
- `dayjs` (v1.11.18) - Date formatting
- `react-router` (v7.9.4) - Navigation

## Benefits

1. ✅ **Dual Purpose** - Single route serves both authenticated and public users
2. ✅ **Visual Curriculum** - Interactive map makes program structure immediately clear
3. ✅ **Progress Tracking** - Students can see completed, active, and upcoming courses
4. ✅ **Prerequisite Clarity** - Visual connections show course dependencies
5. ✅ **Quick Actions** - Easy access to recent courses, notes, and upcoming deadlines
6. ✅ **Responsive** - Works on mobile, tablet, and desktop
7. ✅ **No Database Load** - All data mocked, no queries on initial load
8. ✅ **Professional UX** - Clean, modern interface matching LMS standards
9. ✅ **Extensible** - Easy to replace mock data with real queries later

## Future Enhancements

Potential improvements for future iterations:

1. **Real Data Integration** - Replace mocked data with actual database queries
2. **Clickable Courses** - Click on curriculum map nodes to view course details
3. **Filter Controls** - Toggle between different program views
4. **Completion Tracking** - Real progress calculation based on completed modules
5. **Personalized Recommendations** - Suggest next courses to take
6. **Course Search** - Search within curriculum map
7. **Print View** - Export curriculum map as PDF
8. **Course Notes** - Add notes/comments to courses in the map
9. **Milestone Markers** - Highlight key program milestones
10. **Alternative Layouts** - Tree, force-directed, or hierarchical layouts

## Testing

To test the dashboard:

### Authenticated User View:
1. Log in as any user
2. Navigate to `/` (home page)
3. Verify greeting shows correct time-based message and user name
4. Check program card displays correctly
5. Test curriculum map:
   - Verify all 44 courses are visible
   - Test pan and zoom controls
   - Verify prerequisite connections flow left to right
   - Check color coding (green/blue/gray)
   - Verify semester labels at top
6. Check recent courses grid displays with progress bars
7. Verify calendar shows mocked due items
8. Check recent notes section
9. Test navigation buttons (My Courses, Profile)

### Public User View:
1. Log out or access site anonymously
2. Navigate to `/`
3. Verify hero section with welcome message displays
4. Check featured courses grid (6 courses)
5. Verify platform features showcase (8 features)
6. Test login and register button links

### Responsive Testing:
1. Test on mobile viewport (320px-767px)
2. Test on tablet viewport (768px-1023px)
3. Test on desktop viewport (1024px+)
4. Verify curriculum map is scrollable/zoomable on small screens
5. Check grid layouts collapse appropriately

## Notes

- This is the first version with mocked data - a foundation for future enhancement
- The curriculum map can be easily adapted for different program structures
- The 44-course, 8-semester structure represents a typical 4-year undergraduate program
- Course prerequisites are realistic but simplified for demo purposes
- The layout supports programs with varying courses per semester (4-6 is common)

