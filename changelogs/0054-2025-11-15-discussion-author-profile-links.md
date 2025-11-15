# Discussion Author Profile Links

**Date:** 2025-11-15  
**Type:** Feature Enhancement  
**Impact:** Low - Adds clickable author links in discussion threads and replies

## Overview

This changelog documents the addition of clickable author names and avatars in discussion threads and replies, linking to the course user profile page. This enhancement improves user navigation and allows quick access to participant information within the discussion context.

## Key Changes

### Author Profile Links

#### Clickable Author Information
- Author names and avatars in discussion threads are now clickable links
- Author names and avatars in discussion replies are now clickable links
- Links navigate to `/course/:courseId/participants/profile?userId={authorId}`
- Visual feedback with pointer cursor on hover

#### AuthorInfo Component
- Created reusable `AuthorInfo` helper component for consistent author display
- Handles link generation based on `courseId` and `authorId` availability
- Supports both small (`sm`) and medium (`md`) avatar sizes
- Falls back to `#` link when data is unavailable (e.g., user module preview with fake data)

### Data Structure Updates

#### Interface Enhancements
- Added `authorId?: number | null` to `DiscussionThread` interface
- Added `authorId?: number | null` to `DiscussionReply` interface
- Added `courseId?: number | null` to `DiscussionPreviewProps` and `ThreadDetailViewProps`

#### Data Mapping
- Updated thread mapping in `module.$id.tsx` to include `authorId: student?.id ?? null`
- Updated reply mapping to include `authorId: student?.id ?? null`
- Updated `replyMap` type definition to include `authorId` field

### Component Updates

#### Discussion Preview Components
- `ReplyCard`: Now accepts and uses `courseId` prop, displays author info via `AuthorInfo` component
- `ThreadDetailView`: Accepts `courseId` prop, uses `AuthorInfo` for thread author display
- `DiscussionPreview`: Accepts and passes `courseId` to child components

#### Course Module Route Components
- `DiscussionThreadListView`: Added `courseId` prop, author links in thread cards
- `DiscussionThreadDetailView`: Added `courseId` prop, author links in thread header
- `ReplyCardWithUpvote`: Added `courseId` prop, author links in reply cards
- All components receive `courseId` from `loaderData.course.id`

### Preview Mode Support

#### User Module Preview
- `StatefulDiscussionPreview` in `edit.tsx` receives `courseId={null}`
- Author links use `#` for fake/mock data in preview mode
- Maintains visual consistency while preventing invalid navigation

## Technical Details

### Files Modified
- `app/components/activity-modules-preview/discussion-preview.tsx`: Added `AuthorInfo` component, updated interfaces and props
- `app/routes/course/module.$id.tsx`: Updated data mapping, added `courseId` props, implemented author links
- `app/routes/user/module/edit.tsx`: Added `courseId={null}` prop to `StatefulDiscussionPreview`

### Link Generation Logic
- Uses React Router's `href` helper for type-safe route generation
- Validates `courseId` and `authorId` are numbers before generating profile link
- Falls back to `#` when either value is missing or null
- Query parameter `userId` is appended to profile route

### Styling
- Links use `textDecoration: "none"` and `color: "inherit"` to maintain visual consistency
- Author name text has `cursor: "pointer"` for clear interaction feedback
- Links preserve existing Group and Stack layout structure

## User Impact

### For Students
- Can click on any author name or avatar in discussion threads to view their profile
- Quick access to participant information without leaving the discussion context
- Improved navigation and user experience

### For Instructors
- Easy access to student profiles from discussion threads
- Better ability to track participant engagement and identify contributors
- Seamless navigation between discussions and user management

### For All Users
- Consistent link behavior across all discussion views (list, detail, replies)
- Visual indication that author information is clickable
- No breaking changes - all existing functionality preserved

## Migration Notes

- No breaking changes - all changes are additive
- No data migration required
- Existing discussion threads and replies automatically gain author links
- Author links only work when `authorId` is available in the data

## Testing Considerations

- Verify author links work correctly in thread list view
- Verify author links work correctly in thread detail view
- Verify author links work correctly for nested replies
- Test with threads/replies that have missing `authorId` (should use `#` link)
- Verify user module preview uses `#` links for fake data
- Test navigation to profile page and back to discussion
- Verify link styling and hover states
- Test with different user roles and permissions

## Edge Cases Handled

- Missing `authorId`: Falls back to `#` link
- Missing `courseId`: Falls back to `#` link
- Null values: Type checking ensures only valid numbers generate profile links
- Preview mode: User module preview explicitly uses `courseId={null}` for fake data
- Nested replies: All reply levels (top-level and nested) have working author links

## Future Enhancements

- Add tooltip showing full user name on hover
- Show user role badge next to author name
- Add quick actions menu (message, view profile, etc.) on author hover
- Highlight current user's own posts differently
- Add author filtering/search functionality

## Conclusion

This enhancement improves the user experience by making author information in discussions easily accessible. The implementation is non-breaking and gracefully handles edge cases like missing data or preview mode. The reusable `AuthorInfo` component ensures consistency across all discussion views.

