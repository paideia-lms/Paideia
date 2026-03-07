# RichText Media Processing Hooks - Automatic Media Relationship Management

**Date:** March 7, 2026  
**Type:** Feature / Refactoring  
**Impact:** Medium - Eliminates manual media processing in service functions, centralizes hook logic

## Overview

Implemented automatic rich text media processing via Payload CMS `beforeChange` hooks. This feature automatically parses HTML content for media references, creates media records from base64 images, and populates media relationship fields - eliminating the need for manual `processRichTextMediaV2` calls in service functions.

## Features Added

### 1. Collection-Level Hook Infrastructure

**File:** `packages/paideia-backend/src/collections/utils/rich-text-content.ts`

**New exports:**
- `RichTextFieldConfig` - Interface for field configuration
- `RichTextHookConfig` - Interface for hook configuration  
- `RichTextHookHandlerArgs` - Interface for handler arguments
- `extractUserIdAndPayload()` - Extract user context from multiple sources
- `createRichTextHookHandler()` - Core processing logic (shared by both approaches)
- `createRichTextBeforeChangeHook()` - Collection hook factory

**Key features:**
- Supports multiple user context sources: `req.user`, `data.createdBy`, `originalDoc.createdBy`
- Processes multiple richtext fields in single hook call
- Handles empty/whitespace-only content gracefully
- Uses `overrideAccess: true` for internal processing

### 2. Field-Level Hook Support

**New function:** `richTextContentWithHook<T>(o: T, alt: string)`

This function provides a convenience wrapper that combines:
- The textarea field with hook defined ON THE FIELD
- The media relationship field

Similar to Payload's native field-level hooks:
```typescript
{
  name: 'title',
  type: 'text',
  hooks: {
    beforeChange: [{ value, siblingData, operation } => { ... }]
  }
}
```

### 3. Unit Tests

**File:** `packages/paideia-backend/src/collections/utils/rich-text-content.unit.test.ts`

**23 unit tests covering:**
- `richTextContent` - Field configuration
- `extractUserIdAndPayload` - 7 tests for different user contexts
- `createRichTextHookHandler` - 6 tests for edge cases
- `createRichTextBeforeChangeHook` - 3 tests for hook factory
- `richTextContentWithHook` - 5 tests for field configuration

## Collection Configurations Updated

### Notes Collection
**File:** `packages/paideia-backend/src/modules/note/collections/notes.ts`

Added collection-level hook:
```typescript
hooks: {
  beforeChange: [
    createRichTextBeforeChangeHook({
      fields: [{ key: "content", alt: "Note content image" }],
    }),
  ],
},
```

### Courses Collection
**File:** `packages/paideia-backend/src/modules/courses/collections/courses.ts`

Added collection-level hook:
```typescript
hooks: {
  beforeChange: [
    createRichTextBeforeChangeHook({
      fields: [{ key: "description", alt: "Course description image" }],
    }),
  ],
},
```

### Pages Collection
**File:** `packages/paideia-backend/src/modules/pages/collections/pages.ts`

Added collection-level hook:
```typescript
hooks: {
  beforeChange: [
    createRichTextBeforeChangeHook({
      fields: [{ key: "content", alt: "Page content image" }],
    }),
  ],
},
```

## Service Functions Simplified

### Course Management
**File:** `packages/paideia-backend/src/modules/courses/services/course-management.ts`

**Removed:**
- Import of `processRichTextMediaV2`
- Manual processing in `tryCreateCourse`
- Manual processing in `tryUpdateCourse`

### Note Management  
**File:** `packages/paideia-backend/src/modules/note/services/note-management.ts`

**Removed:**
- Import of `processRichTextMediaV2`
- Manual processing in `tryCreateNote`
- Manual processing in `tryUpdateNote`

## Technical Details

### Three Approaches Available

**Method 1: Collection Hook (recommended for multiple fields)**
```typescript
hooks: {
  beforeChange: [
    createRichTextBeforeChangeHook({
      fields: [
        { key: 'description', alt: 'Course description image' },
        { key: 'summary', alt: 'Course summary image' }
      ]
    })
  ]
},
fields: [
  ...richTextContent({ name: 'description', type: 'textarea' }),
  ...richTextContent({ name: 'summary', type: 'textarea' }),
]
```

**Method 2: Field Hook (richTextContentWithHook)**
```typescript
fields: [
  ...richTextContentWithHook(
    { name: 'content', type: 'textarea', label: 'Content' },
    "Note content image"
  )
]
// No collection-level hooks needed!
```

**Method 3: Manual Processing (legacy)**
```typescript
data: {
  ...(await processRichTextMediaV2({ ... }))
}
```

### Pros/Cons Comparison

| Aspect | Collection Hook | Field Hook | Manual |
|--------|----------------|------------|--------|
| Location | `collection.hooks` | `field.hooks` | Service function |
| Execution | Once per operation | Per field | Per call |
| Maintenance | Single place | Per field | Everywhere |
| Performance | Best | Good | Good |
| Granularity | Lower | Higher | Highest |

## Files Modified

**Added:**
- `packages/paideia-backend/src/collections/utils/rich-text-content.unit.test.ts`

**Modified:**
- `packages/paideia-backend/src/collections/utils/rich-text-content.ts`
- `packages/paideia-backend/src/modules/note/collections/notes.ts`
- `packages/paideia-backend/src/modules/courses/collections/courses.ts`
- `packages/paideia-backend/src/modules/pages/collections/pages.ts`
- `packages/paideia-backend/src/modules/courses/services/course-management.ts`
- `packages/paideia-backend/src/modules/note/services/note-management.ts`

## Testing

**Unit tests:** 23 pass, 0 fail  
**Integration tests:** 39 pass, 0 fail

### Tricky Issue Resolved

**Issue:** Tests failing when `req: undefined` was passed

**Root cause:** Hook was checking for `req.user.id` first, but tests pass `req: undefined` with `overrideAccess: true`. The original logic expected `req` to always have user context.

**Solution:** Extended user context detection to check multiple sources in order:
1. `req.user.id` + `req.payload` (normal API calls)
2. `data.createdBy` (when user ID is in the data being created)
3. `originalDoc.createdBy` (on updates, when user ID is in the existing document)

This allows the hook to work in all scenarios:
- Normal Payload API calls (with req.user)
- Internal function calls with `overrideAccess: true` (data.createdBy)
- Field-level hooks (different context structure)

## References

- [Payload CMS Collection Hooks Documentation](https://payloadcms.com/docs/hooks/collections)
- [Payload CMS Field Hooks Documentation](https://payloadcms.com/docs/hooks/fields)
