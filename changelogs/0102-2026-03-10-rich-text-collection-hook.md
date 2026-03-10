# Rich Text Collection Hook

**Date:** March 10, 2026  
**Type:** Refactor / Feature  
**Impact:** Low - Standardizes rich text media processing via collection-level hooks; no user-facing changes

## Overview

Rich text fields (textarea with embedded images) now use a **collection-level** `beforeChange` hook instead of field-level hooks. This centralizes base64-to-media conversion and media ID extraction in one place per collection, improving maintainability and performance.

## Changes

### 1. `packages/paideia-backend/src/collections/utils/rich-text-content.ts`

**Added**:
- `RichTextFieldConfig` — `{ key: string; alt: string }` for field config
- `RichTextHookConfig` — `{ fields: RichTextFieldConfig[] }` for hook config
- `extractUserIdAndPayload()` — Resolves userId from `req.user`, `data.createdBy`, or `originalDoc.createdBy` (for updates)
- `createRichTextHookHandler()` — Processes rich text fields: replaces base64 images with media URLs, extracts media IDs
- `createRichTextBeforeChangeHook(config)` — Returns a collection-level `beforeChange` hook

**Unchanged**:
- `richTextContent(o)` — Still returns `[textareaField, relationshipField]`; no hooks on the field itself
- `processRichTextMediaV2`, `tryExtractMediaIdsFromRichText` — Internal helpers unchanged

### 2. Collections Updated to Use Collection Hook

| Collection | Rich Text Field | Alt Text |
|------------|-----------------|----------|
| `courses` | `description` | "Course description image" |
| `notes` | `content` | "Note content image" |
| `pages` | `content` | "Page content image" |

**Pattern**:
```typescript
hooks: {
  beforeChange: [
    createRichTextBeforeChangeHook({
      fields: [{ key: "content", alt: "Note content image" }],
    }),
  ],
},
fields: [
  ...richTextContent({ name: "content", type: "textarea", label: "Content" }),
  // ...
]
```

## Why Collection Hook Over Field Hook

- **Single hook per collection** — One `beforeChange` call processes all rich text fields
- **Easier maintenance** — Update logic in one place
- **Better performance** — Fewer hook invocations
- **Works with any create/update** — No need to attach hooks to each field

## References

- Skill: `.cursor/skills/rich-text-content/SKILL.md`
- Media picker (insert image): `changelogs/0101-2026-03-10-media-picker-component.md`
