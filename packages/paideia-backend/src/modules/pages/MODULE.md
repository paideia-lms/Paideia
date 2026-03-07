# Page Management Module

Page module adds a page resource to Paideia.

## Module Structure

### Services
- **Location**: `src/modules/pages/services/page-management.ts`
- **Functions**: CRUD operations for pages
  - `tryCreatePage` - Create a new page
  - `tryUpdatePage` - Update an existing page
  - `tryFindPageById` - Find page by ID
  - `trySearchPages` - Search pages with filters
  - `tryDeletePage` - Delete a page
  - `tryFindPagesByUser` - Find pages by user

### API Endpoints
- **Location**: `src/modules/pages/api/page-management.ts`
- **Endpoints**: ORPC routes for page management
  - `POST /pages` - Create a page
  - `PATCH /pages/{pageId}` - Update a page
  - `GET /pages/{pageId}` - Get page by ID
  - `GET /pages/search` - Search pages
  - `DELETE /pages/{pageId}` - Delete a page
  - `GET /pages/by-user/{userId}` - Get pages by user

### Seeding
- **Location**: `src/modules/pages/seeding/`
- **Files**:
  - `page-seed-schema.ts` - Zod schema for page seed data
  - `pages-builder.ts` - SeedBuilder implementation
  - `predefined-page-seed-data.ts` - Predefined seed data for development/testing
  - `page-management-test-seed-data.ts` - Test-specific seed data

### Testing
- **Location**: `src/modules/pages/tests/`
- **Files**:
  - `page-management.test.ts` - Comprehensive CRUD tests
  - `openapi-generation.test.ts` - OpenAPI spec generation tests

## Seeding Pattern

Follows the SeedBuilder pattern from `note` and `user` modules:

### Seed Schema (Zod)
```typescript
const pageSeedInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  content: z.string().optional(),
  userEmail: z.email(),
});

const pageSeedDataSchema = z.object({
  pages: z.array(pageSeedInputSchema),
});
```

### SeedBuilder Implementation
- Extends `SeedBuilder<InputType, EntityType>` base class
- Takes `usersByEmail` Map in constructor for user resolution
- Uses `tryCreatePage` service function
- Implements `seedEntities()` method
- Wraps result in `trySeedPages()` function

### Usage Example
```typescript
import { trySeedPages } from "./seeding/pages-builder";

const result = await trySeedPages({
  payload,
  data: {
    pages: [
      {
        title: "Getting Started",
        description: "A guide",
        content: "Welcome content",
        userEmail: "user@example.com",
      },
    ],
  },
  usersByEmail: userMap,
  req: undefined,
  overrideAccess: true,
}).getOrThrow();
```

## Test Coverage

### Test Results
```
✓ 38 pass
✓ 0 fail
✓ 106 expect() calls
✓ Duration: ~1.7s
```

### Test Categories

#### 1. **tryCreatePage** (9 tests)
- ✅ Create page with all fields
- ✅ Create page with only required fields
- ✅ Trim whitespace from title
- ✅ Trim whitespace from description and content
- ✅ Fail with empty title
- ✅ Fail with whitespace-only title
- ✅ Fail with title exceeding 500 characters
- ✅ Accept title with exactly 500 characters
- ✅ Fail with non-existent user

#### 2. **tryUpdatePage** (7 tests)
- ✅ Update page title successfully
- ✅ Update multiple fields
- ✅ Trim whitespace from updated fields
- ✅ Fail with empty title
- ✅ Fail with whitespace-only title
- ✅ Fail with title exceeding 500 characters
- ✅ Fail with non-existent page

#### 3. **tryFindPageById** (2 tests)
- ✅ Find page by ID successfully
- ✅ Fail with non-existent page

#### 4. **trySearchPages** (5 tests)
- ✅ Search pages by user
- ✅ Search pages by title
- ✅ Search pages by content
- ✅ Return paginated results
- ✅ Return empty results for non-matching search

#### 5. **tryFindPagesByUser** (3 tests)
- ✅ Find pages by user ID
- ✅ Respect limit parameter
- ✅ Return empty array for user with no pages

#### 6. **tryDeletePage** (2 tests)
- ✅ Delete page successfully
- ✅ Fail with non-existent page

#### 7. **Basic Functionality Tests** (4 tests)
- ✅ Read any page with overrideAccess
- ✅ Update any page with overrideAccess
- ✅ Delete any page with overrideAccess
- ✅ Search all pages with overrideAccess

#### 8. **Access Control Tests** (6 tests)
- ✅ User can read their own page
- ✅ Unauthenticated request fails to read pages
- ✅ Unauthenticated request fails to update pages
- ✅ Unauthenticated request fails to delete pages
- ✅ Unauthenticated search fails
- ✅ Unauthenticated request fails to create pages

## Test Structure

Follows the same pattern as `note-management.test.ts`:
- Uses Payload local API with test database
- Seeds users and media before tests
- Migrates database fresh for each test run
- Cleans up S3 bucket after tests
- Tests both success and failure scenarios
- Validates access control with and without `overrideAccess`

## Key Features Tested

1. **Validation**:
   - Title not empty
   - Title max 500 characters
   - Whitespace trimming

2. **CRUD Operations**:
   - Create, Read, Update, Delete
   - Search with filters
   - Pagination

3. **Access Control**:
   - Unauthenticated requests blocked
   - Authenticated users can access own resources
   - Admin override access works

4. **Edge Cases**:
   - Non-existent IDs
   - Empty results
   - Foreign key constraints

## Module Exports

The `PagesModule` class exports all services and API functions:
```typescript
export { PagesModule } from "./index";

// Use in application code
const pagesModule = new PagesModule(payload);

// Instance methods (wraps service functions)
await pagesModule.createPage({ data: {... } });
await pagesModule.updatePage({ pageId: 1, data: {... } });
await pagesModule.findPageById({ pageId: 1 });
await pagesModule.searchPages({ filters: {... } });
await pagesModule.deletePage({ pageId: 1 });
await pagesModule.findPagesByUser({ userId: 1 });

// Static properties
PagesModule.api.createPage // ORPC endpoint
PagesModule.api.updatePage
PagesModule.api.findPageById
PagesModule.api.searchPages
PagesModule.api.deletePage
PagesModule.api.findPagesByUser
```
