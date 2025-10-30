# Course Search with Advanced Query Filters

**Date**: October 31, 2025  
**Type**: Feature Addition  
**Impact**: Medium – Enhances course discovery and filtering capabilities for administrators

## Overview
This update introduces an advanced search system for the admin courses page, allowing administrators to search and filter courses using free text and structured query syntax. The search supports filtering by status and category with intuitive syntax, making it easier to find and manage courses at scale.

## Key Features

### 1. Course Search Input Component
- New reusable `CourseSearchInput` component with:
  - Debounced text input (500ms delay) for efficient querying
  - Real-time search that updates URL query parameters
  - Tooltip with comprehensive syntax guide
  - SEO meta tags for search functionality
- Supports free text search across course title, description, and slug

### 2. Advanced Query Syntax
Users can now search courses using:
- **Free text**: Matches title, description, and slug
- **Status filter**: `status:published`, `status:draft`, `status:archived`
- **Category filters**:
  - By ID: `category:123`
  - By name (partial match): `category:"computer science"`
  - Uncategorized: `category:none`, `category:null`, or `category:uncategorized`
- **Combined queries**: Mix free text with filters (e.g., `status:published category:123`)

### 3. Backend Search Implementation
- New `tryFindAllCourses` function in `server/internal/course-management.ts`
- Uses `search-query-parser` library to parse complex queries
- Supports:
  - Multi-field text search (title, description, slug) with OR conditions
  - Status filtering with multiple values support
  - Category filtering by ID, name (case-insensitive partial match), or uncategorized status
- Returns paginated results with proper type narrowing

## Technical Implementation

### New/Updated Routes
- `app/components/course-search-input.tsx` (NEW)
  - Reusable search component using Mantine `TextInput`
  - Integrates with `nuqs` for URL state management
  - Debounced callback using `@mantine/hooks`
  - Tooltip with syntax examples

- `app/routes/admin/courses.tsx` (UPDATED)
  - Integrated `CourseSearchInput` component
  - Loader updated to use `tryFindAllCourses` with query parsing
  - Search query passed via URL parameter `query`
  - Maintains existing pagination and batch update functionality

- `app/routes/admin/categories.tsx` (UPDATED)
  - Added "View courses" links that use category search syntax
  - Links to courses page with pre-filled category filters
  - Supports both category ID and name-based filtering

- `app/routes/api/category-reorder.tsx` (UPDATED)
  - Minor improvements to error handling

### Backend/Internal Functions
- `server/internal/course-management.ts` (UPDATED)
  - New `FindAllCoursesArgs` interface with `query?: string` parameter
  - New `tryFindAllCourses` function:
    - Parses search queries using `search-query-parser`
    - Builds dynamic `Where` conditions based on parsed query
    - Supports text search across title, description, and slug (OR conditions)
    - Handles status filtering with array support
    - Handles category filtering:
      - Numeric values treated as category IDs
      - String values matching "none"/"null"/"uncategorized" for uncategorized
      - Other strings treated as category name (case-insensitive partial match)
    - Returns paginated results with proper type narrowing for relationships

### Query Parsing Logic
The search query parser supports:
1. **Text extraction**: Free text tokens are extracted and searched across multiple fields
2. **Keyword parsing**: Recognizes `status:` and `category:` keywords
3. **Multiple values**: Supports arrays for status (e.g., `status:published,draft`)
4. **Category resolution**: 
   - Numeric values → direct ID lookup
   - Special keywords → `exists: false` for uncategorized
   - Text values → partial name match query, then ID resolution

## UI/UX Improvements
- Search input includes helpful placeholder text with syntax examples
- Tooltip provides comprehensive filtering guide accessible via info icon
- Search state persisted in URL for shareable/bookmarkable results
- Debounced input reduces unnecessary API calls
- Search preserves pagination state

## Integration Points
- Search seamlessly integrates with existing:
  - Course pagination
  - Batch update operations
  - Category management page (via "View courses" links)
  - Table selection and actions

## Performance Considerations
- Debounced input prevents excessive queries during typing
- Category name lookups are performed only when needed (non-numeric category filters)
- Multiple category matches use `in` operator for efficient filtering
- No matches return empty results without throwing errors

## Testing Considerations
Manual testing recommended for:
- Free text search across title, description, slug
- Status filtering (single and multiple values)
- Category filtering by ID, name, and uncategorized status
- Combined queries (text + filters)
- Pagination with search queries
- URL state persistence and shareability
- Category page "View courses" links with pre-filled filters

## Future Enhancements
1. Date range filtering (e.g., `created:2025-01-01,2025-12-31`)
2. Author/creator filtering (e.g., `author:123` or `author:"John Doe"`)
3. Tag-based filtering
4. Saved search presets
5. Search history
6. Advanced filters UI (dropdowns, checkboxes) alongside text input

## Migration Notes
- No database migrations required
- Backward compatible: existing course listing functionality remains unchanged
- New search is additive; old filtering methods still work

## Conclusion
This release significantly improves course discoverability for administrators by introducing an intuitive, powerful search system. The query syntax is flexible yet simple, and the implementation follows project conventions (Mantine UI, Result types, internal functions with proper access control). The reusable search component can be extended for other collections in the future.