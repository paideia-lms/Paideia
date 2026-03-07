# Pages Module Implementation with CRUD Services, API, Tests, and Seeders

**Date:** March 7, 2026  
**Type:** Feature / Developer Experience  
**Impact:** Medium - Adds complete pages module with services, API, tests, and seeders

## Overview

Created a complete page management module for Paideia following established patterns from the note module. This implementation includes CRUD services, ORPC API endpoints, comprehensive test coverage, and a SeedBuilder-compliant seeder. The module demonstrates the standard pattern for adding new resource modules to the codebase.

## Features Added

### 1. Service Layer (`services/page-management.ts`)

**CRUD Functions**:
- `tryCreatePage` - Create page with title, description, content, createdBy
- `tryUpdatePage` - Update page fields
- `tryFindPageById` - Find page by ID
- `trySearchPages` - Search with filters (createdBy, title, content, pagination)
- `tryDeletePage` - Delete page by ID
- `tryFindPagesByUser` - Find all pages by user ID

**Validation**:
- Title: not empty, max 500 characters
- Whitespace trimming for all text fields
- Foreign key validation (createdBy must exist)

**Pattern Compliance**:
- Uses `Result.try()` from `typescript-result`
- Transaction handling with `handleTransactionId()`
- Error transformation with `transformError()`
- Follows `BaseInternalFunctionArgs` pattern
- Uses `stripDepth()` for type safety

### 2. API Layer (`api/page-management.ts`)

**ORPC Endpoints**:
- `POST /pages` - createPage
- `PATCH /pages/{pageId}` - updatePage
- `GET /pages/{pageId}` - findPageById
- `GET /pages/search` - searchPages
- `DELETE /pages/{pageId}` - deletePage
- `GET /pages/by-user/{userId}` - findPagesByUser

**Zod Validation**:
- Title: `z.string().min(1).max(500)`
- User IDs: `z.coerce.number().int().min(1)`
- Pagination: `z.coerce.number().int().min(1).max(100)`

### 3. Seeding Layer

**Files Created**:
- `seeding/page-seed-schema.ts` - Zod schema for seed data
- `seeding/pages-builder.ts` - SeedBuilder implementation
- `seeding/predefined-page-seed-data.ts` - Development/test seed data
- `seeding/page-management-test-seed-data.ts` - Test-specific seed data

**SeedBuilder Pattern**:
```typescript
class PagesSeedBuilder extends SeedBuilder<PageSeedData["pages"][number], Page> {
  readonly entityName = "page";
  private usersByEmail: Map<string, User>;

  protected async seedEntities(inputs, context): Promise<Page[]> {
    // Domain logic: resolve user, create page
  }
}

export function trySeedPages(args: TrySeedPagesArgs) {
  const builder = new PagesSeedBuilder(args.usersByEmail);
  return builder.trySeed({ ...args, data: { inputs: args.data.pages } })
    .map(pages => ({ pages }));
}
```

### 4. Test Coverage

**Test Files**:
1. `tests/page-management.test.ts` - 38 tests for CRUD operations
2. `tests/openapi-generation.test.ts` - 7 tests for OpenAPI spec
3. `tests/pages-builder.test.ts` - 9 tests for seed builder

**Total: 54 tests passing**

**Test Categories**:
- CRUD operations (create, read, update, delete, search)
- Validation (empty title, max length, whitespace)
- Access control (authenticated vs overrideAccess)
- Pagination and filtering
- User associations
- Database relationships

### 5. Module Index (`index.ts`)

**Exports**:
- Instance methods wrapping service functions
- Static `api` property with ORPC endpoints
- Static `collections` array with Pages collection

## Technical Details

### File Structure

```
packages/paideia-backend/src/modules/pages/
├── api/
│   └── page-management.ts (NEW - 180 lines)
├── collections/
│   └── pages.ts (EXISTING)
├── seeding/
│   ├── page-seed-schema.ts (NEW - 14 lines)
│   ├── pages-builder.ts (NEW - 68 lines)
│   ├── predefined-page-seed-data.ts (NEW - 33 lines)
│   └── page-management-test-seed-data.ts (NEW - 61 lines)
├── services/
│   └── page-management.ts (NEW - 291 lines)
├── tests/
│   ├── page-management.test.ts (NEW - 959 lines)
│   ├── openapi-generation.test.ts (EXISTING - 166 lines)
│   └── pages-builder.test.ts (NEW - 142 lines)
├── index.ts (MODIFIED - 95 lines)
└── MODULE.md (UPDATED - comprehensive documentation)
```

### Module Pattern

**Service Layer**:
```typescript
export function tryCreatePage(args: CreatePageArgs) {
  return Result.try(
    async () => {
      // Validation
      if (!title || title.trim().length === 0) {
        throw new InvalidArgumentError("Page title cannot be empty");
      }

      // Transaction
      const transactionInfo = await handleTransactionId(payload, req);
      return transactionInfo.tx(async (txInfo) => {
        const newPage = await payload.create({
          collection: "pages",
          data: { ... } as any,
          req: txInfo.reqWithTransaction,
          overrideAccess,
          depth: 0,
        }).then(stripDepth<0, "create">());
        return newPage;
      });
    },
    (error) => transformError(error) ?? new UnknownError("Failed to create page", { cause: error })
  );
}
```

**API Layer**:
```typescript
export const createPage = os
  .$context<OrpcContext>()
  .route({ method: "POST", path: "/pages" })
  .input(createPageSchema)
  .output(outputSchema)
  .handler(async ({ input, context }) => {
    const result = await tryCreatePage({
      payload: context.payload,
      ...input,
      req: context.req,
      overrideAccess: false,
    });
    if (!result.ok) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: result.error.message,
        cause: result.error,
      });
    }
    return result.value;
  });
```

**Module Index**:
```typescript
export class PagesModule {
  private readonly payload: Payload;
  public static readonly collections = [Pages];
  public static readonly api = {
    createPage,
    updatePage,
    findPageById,
    searchPages,
    deletePage,
    findPagesByUser,
  };

  createPage(args: Omit<CreatePageArgs, "payload">) {
    return tryCreatePage({ payload: this.payload, ...args });
  }
  // ... other methods
}
```

## Key Learnings

### 1. Payload Type Generation Issue

**Problem**: After adding `title` and `description` fields to the Pages collection, the generated TypeScript types in `payload-types.ts` did not include these fields.

**Root Cause**: The Payload type generation script had an error when processing `.png` fixture files, preventing the types from being regenerated.

**Solution**: 
- Use type assertions (`as any`) in service functions when creating/updating
- Use type assertions in tests when accessing custom fields
- Document the need to regenerate types after schema changes

**Workaround**:
```typescript
// In service
const newPage = await payload.create({
  collection: "pages",
  data: { title, description, content, createdBy } as any,
  // ...
});

// In tests
const page = result.value as any;
expect(page.title).toBe("Expected Title");
```

### 2. Zod Schema Validation

**Issue**: `z.email()` is not a valid Zod method.

**Solution**: Use `z.string().email()` instead.

```typescript
// ❌ Wrong
userEmail: z.email()

// ✅ Correct
userEmail: z.string().email()
```

### 3. SeedBuilder Pattern Requirements

**Must Have**:
- Zod schema for input validation
- SeedBuilder class extending base class
- `entityName` readonly property
- `seedEntities()` protected method
- Constructor accepting dependency map (e.g., `usersByEmail`)
- Export function wrapping builder with backward-compatible signature

**Pattern**:
1. Define Zod schema with `userEmail` field for user resolution
2. Extend `SeedBuilder<InputType, EntityType>`
3. Inject dependency map in constructor
4. Implement `seedEntities()` with user resolution and entity creation
5. Export wrapper function that maps result

### 4. Test Structure Requirements

**Required Elements**:
- `beforeAll`: Seed prerequisites (users, media)
- `afterAll`: Clean up database and S3
- Both success and failure test cases
- Access control tests (with and without `overrideAccess`)
- Validation tests (empty values, max lengths, whitespace)
- Pagination and filtering tests
- Database relationship tests

## Files Modified

**Added**:
- `packages/paideia-backend/src/modules/pages/api/page-management.ts`
- `packages/paideia-backend/src/modules/pages/seeding/page-seed-schema.ts`
- `packages/paideia-backend/src/modules/pages/seeding/pages-builder.ts`
- `packages/paideia-backend/src/modules/pages/seeding/predefined-page-seed-data.ts`
- `packages/paideia-backend/src/modules/pages/seeding/page-management-test-seed-data.ts`
- `packages/paideia-backend/src/modules/pages/services/page-management.ts`
- `packages/paideia-backend/src/modules/pages/tests/page-management.test.ts`
- `packages/paideia-backend/src/modules/pages/tests/pages-builder.test.ts`

**Modified**:
- `packages/paideia-backend/src/modules/pages/index.ts`
- `packages/paideia-backend/src/modules/pages/MODULE.md`

## Pattern Benefits

### For Future Modules

To add a new module (e.g., "articles"):

1. **Collection**: Already exists in `collections/articles.ts`
2. **Services**: Copy `page-management.ts` pattern
3. **API**: Copy `page-management.ts` pattern
4. **Seeding**: 
   - Create Zod schema with `userEmail`
   - Extend SeedBuilder
   - Export wrapper function
5. **Tests**: Copy test files and adapt
6. **Index**: Expose services and API

**Time Estimate**: ~2-3 hours for complete module with tests

### Code Quality

- ✅ Consistent pattern across all resource modules
- ✅ Type-safe with Zod validation
- ✅ Transaction-safe operations
- ✅ Comprehensive test coverage (54 tests)
- ✅ Access control built-in
- ✅ Pagination and filtering standardized
- ✅ SeedBuilder pattern for test data

## References

- Skill: `.agents/skills/seed-builder-pattern/SKILL.md`
- Skill: `.agents/skills/payload/SKILL.md`
- Related: `packages/paideia-backend/src/modules/note/` (reference implementation)
- Related: `packages/paideia-backend/src/shared/seed-builder.ts` (base class)
- Related: `packages/paideia-backend/src/shared/internal-function-utils.ts` (BaseInternalFunctionArgs)
