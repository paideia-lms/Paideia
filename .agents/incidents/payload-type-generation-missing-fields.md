# Payload Type Generation Missing Fields

**Date:** March 7, 2026  
**Severity:** Medium  
**Status:** Resolved  

## Problem

When creating new collection fields, the generated TypeScript types in `payload-types.ts` do not include newly added fields, causing TypeScript errors when accessing those fields in service functions and tests.

### Symptoms

```typescript
// Collection definition with new fields
export const Pages = {
  slug: "pages",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "description", type: "textarea" },
    { name: "content", type: "textarea" },
    { name: "createdBy", type: "relationship", relationTo: "users" },
  ],
} as const satisfies CollectionConfig;

// Generated type missing new fields
export interface Page {
  id: number;
  createdBy: number | User;
  content?: string | null;
  contentMedia?: (number | Media)[] | null;
  updatedAt: string;
  createdAt: string;
  // ❌ Missing: title, description
}
```

### Error Messages

```
ERROR [111:25] Property 'title' does not exist on type '{ id: number; createdBy: number; ... }'.
ERROR [112:25] Property 'description' does not exist on type '{ id: number; createdBy: number; ... }'.
```

## Root Cause

1. **Type Generation Script Fails**: The `bun run typegen` command fails with file extension errors:
   ```
   TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".png"
   ```

2. **Types Out of Sync**: Without successful type generation, `payload-types.ts` doesn't reflect the actual collection schema.

3. **New Fields Missing**: Fields recently added to collections don't appear in generated types.

## Solution

### Immediate Workaround

Use type assertions to bypass TypeScript errors:

```typescript
// ❌ Without type assertion
expect(result.value.title).toBe("Test");

// ✅ With type assertion
const page = result.value as any;
expect(page.title).toBe("Test");

// ✅ Or use custom type
type TestPage = {
  id: number;
  title: string;
  description?: string;
  content?: string;
  createdBy: number | { id: number };
};

const page = result.value as TestPage;
expect(page.title).toBe("Test");
```

### For Service Functions

```typescript
// Create operation - use type assertion
const newPage = await payload.create({
  collection: "pages",
  data: {
    title: title.trim(),
    description: description?.trim(),
    content: content?.trim(),
    createdBy,
  } as any,  // ✅ Type assertion for new fields
  req: txInfo.reqWithTransaction,
  overrideAccess,
  depth: 0,
}).then(stripDepth<0, "create">());

// Update operation - use type assertion
const updatedPage = await payload.update({
  collection: "pages",
  id: pageId,
  data: {
    title: data.title?.trim(),
    description: data.description?.trim(),
  } as any,  // ✅ Type assertion for new fields
  req: txInfo.reqWithTransaction,
  overrideAccess,
  depth: 0,
}).then(stripDepth<0, "update">());
```

### For Tests

```typescript
// Option 1: Use 'as any'
const page = result.value as any;
expect(page.title).toBe("Test");

// Option 2: Define custom test type
type TestPage = {
  id: number;
  title: string;
  description?: string;
  content?: string;
  createdBy: number | { id: number };
  createdAt: string;
  updatedAt: string;
};

const page = result.value as TestPage;
expect(page.title).toBe("Test");
```

## Long-term Fix

### 1. Fix Type Generation Script

The `typegen` script in `package.json`:
```json
{
  "typegen": "PAYLOAD_CONFIG_PATH=src/payload.config.ts bun payload generate:types && PAYLOAD_CONFIG_PATH=src/payload.config.ts bun payload generate:db-schema"
}
```

**Issue**: Fails when encountering image files in fixture directories.

**Workaround**: Temporarily move or exclude fixture directories during type generation.

### 2. Run Type Generation After Schema Changes

After modifying collection schemas:
```bash
bun run typegen
```

### 3. Verify Type Sync

Check that `payload-types.ts` includes all fields:
```typescript
// Verify this interface has all fields
export interface Page {
  id: number;
  title: string;  // ✅ Should be present
  description?: string | null;  // ✅ Should be present
  content?: string | null;
  createdBy: number | User;
  updatedAt: string;
  createdAt: string;
}
```

## Prevention

### 1. Document Type Assertion Pattern

Add to coding standards:
- Use `as any` for create/update data objects with new fields
- Use custom test types for test assertions
- Run `bun run typegen` after adding new fields (when working)

### 2. Add Pre-commit Hook

Consider adding a pre-commit hook to check for type sync:
```bash
bun run typecheck && bun run typegen
```

### 3. Type Generation Checklist

When adding new collection fields:
- [ ] Add fields to collection definition
- [ ] Try running `bun run typegen`
- [ ] If typegen fails, use `as any` assertions
- [ ] Define custom test types if needed
- [ ] Document type generation issues in code comments

## Related Issues

- File extension error in type generation: `ERR_UNKNOWN_FILE_EXTENSION: .png`
- Payload types out of sync with schema
- Missing fields in generated interfaces

## References

- Payload Type Generation: https://payloadcms.com/docs/getting-started/field-types
- Related Code: `packages/paideia-backend/src/payload-types.ts`
- Collection Definition: `packages/paideia-backend/src/modules/pages/collections/pages.ts`
