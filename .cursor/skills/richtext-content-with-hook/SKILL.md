---
name: richtext-content-with-hook
description: Use richTextContentWithHook for Payload fields with base64 images. Use when adding rich text fields that process base64 images, or when debugging ValidationError on Description/Content fields.
---

# richTextContentWithHook - Payload Rich Text with Base64 Media

## When to Use

- Adding a textarea/rich text field that may contain base64 images (e.g. course description, note content)
- Field should auto-create media records from base64 and populate a `{fieldName}Media` relationship
- Debugging "The following field is invalid: Description" when updating with base64 images

## Key Fact

Payload field-level `beforeChange` hooks: **the returned value becomes the field value** used for validation and persistence. If the hook transforms the value (e.g. base64 → media URLs), it must return the transformed value, not the original.

## Usage

```typescript
import { UserModule } from "@paideia/module-user";
const richTextContentWithHook = UserModule.fieldHooks.richTextContentWithHook;

// In collection fields:
fields: [
  ...richTextContentWithHook(
    {
      name: "description",
      type: "textarea",
      label: "Description",
      required: true,
    },
    "Course description image",  // alt text for created media
  ).fields,
]
```

## Critical: Hook Return Value

When writing or debugging field hooks that transform content:

1. **Update `data` and `siblingData`** for the main field and related media field
2. **Return the transformed value** so validation runs on processed content
3. Use `result[fieldName] ?? value` to fall back when no processing occurred

```typescript
// ✅ Correct
return result[fieldName] ?? value;

// ❌ Wrong - validation runs on original base64
return value;
```

## Base64 Image Deduplication

`replaceBase64MediaWithMediaUrlsV2` deduplicates identical base64 images by prefix. Two identical base64 strings → one media record. For tests expecting N media IDs, use distinct images or `expect(length).toBeGreaterThanOrEqual(1)`.

## References

- Hook: `packages/module-user/src/collections/hooks/rich-text-content.ts`
- Incident: `release-notes/incidents/2026-03-08-rich-text-content-with-hook-return-value.md`
- Changelog 0102: RichText Media Processing Hooks
- Changelog 0104: RichTextContentWithHook Validation Fix
