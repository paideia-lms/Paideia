---
name: rich-text-content
description: Use richTextContent() and createRichTextBeforeChangeHook() for textarea fields with embedded images. Use when adding or updating rich text fields in Payload collections.
---

# Rich Text Content (Collection Hook)

## When to Use

- Adding a textarea field that supports embedded images (base64 or media URLs)
- Creating a new collection with rich text content
- Migrating a collection to use the standard rich text + media pattern

## Pattern

Use **collection-level** `beforeChange` hook with `richTextContent()` for fields. Do **not** use field-level hooks.

### 1. Define Fields with richTextContent

```typescript
import {
  createRichTextBeforeChangeHook,
  richTextContent,
} from "./utils/rich-text-content";

fields: [
  ...richTextContent({
    name: "content",
    type: "textarea",
    label: "Content",
    required: true,
  }),
  // other fields...
]
```

`richTextContent(o)` returns:
- The textarea field (as given)
- A `{name}Media` relationship field (relationTo: "media", hasMany: true)

### 2. Add Collection Hook

```typescript
hooks: {
  beforeChange: [
    createRichTextBeforeChangeHook({
      fields: [
        { key: "content", alt: "Note content image" },
        // Add more if collection has multiple rich text fields
      ],
    }),
  ],
},
```

## Config

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Field name (must match the textarea `name`) |
| `alt` | `string` | Alt text for images created from base64 (e.g. "Note content image") |

## User ID Resolution

The hook resolves `userId` for media creation from (in order):
1. `req.user.id` (logged-in user)
2. `data.createdBy` (create operation)
3. `originalDoc.createdBy` (update operation)

Collections must have `createdBy` or `req.user` available for the hook to run.

## Current Usage

| Collection | Field | Alt |
|------------|-------|-----|
| `courses` | `description` | "Course description image" |
| `notes` | `content` | "Note content image" |
| `pages` | `content` | "Page content image" |

## Related

- **Media Picker** (insert image in editor): `.cursor/skills/media-picker/SKILL.md`
- **Replace base64**: `packages/paideia-backend/src/utils/replace-base64-images.ts`
- **Parse media from HTML**: `packages/paideia-backend/src/internal/utils/parse-media-from-html.ts`

## Changelog

- `changelogs/0102-2026-03-10-rich-text-collection-hook.md`
