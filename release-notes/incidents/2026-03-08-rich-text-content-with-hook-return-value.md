# Incident Report: richTextContentWithHook Field Hook Return Value Causes ValidationError

**Date**: March 8, 2026  
**Severity**: Medium (breaks course/note updates with base64 images)  
**Affected**: Collections using `richTextContentWithHook` (courses, notes, pages)  
**Status**: Resolved  
**Incident ID**: INC-2026-03-08-001

## Summary

Tests for `tryUpdateCourse` with description containing base64 images failed with:

```
ValidationError: The following field is invalid: Description
```

The hook correctly processed base64 → media URLs and updated `data` and `siblingData`, but returned the original `value` (with base64). Payload uses the hook's return value as the field value for validation and persistence.

## Impact

**Symptoms**:
- `tryUpdateCourse` / `tryUpdateNote` with base64 images in rich text fails
- ValidationError on the Description/Content field
- Works for create (when `data.createdBy` provides user context) but fails on update with base64

**Root Cause**:
- Payload field-level `beforeChange` hooks: the returned value becomes the field value
- Hook returned `value` (original input) instead of `result[fieldName]` (processed output)
- Validation ran on base64 content (long strings, potential format issues) instead of processed HTML with media URLs

## Resolution

Return the processed value from the hook so validation receives media URLs:

```typescript
// ❌ Wrong - validation runs on base64
if (result !== data) {
  data[fieldName] = result[fieldName];
  siblingData[mediaFieldName] = result[mediaFieldName];
}
return value;  // Original base64 content!
```

```typescript
// ✅ Correct - validation runs on processed content
if (result !== data) {
  data[fieldName] = result[fieldName];
  siblingData[mediaFieldName] = result[mediaFieldName];
}
return result[fieldName] ?? value;  // Processed content with media URLs
```

## Pattern

When writing Payload field-level `beforeChange` hooks that transform the value:

1. **Update `data` and `siblingData`** for related fields (e.g. media relationships)
2. **Return the transformed value** so validation and persistence use the processed content
3. Use `result[fieldName] ?? value` to fall back to original when no processing occurred

## Prevention

- Field hooks that transform input must return the transformed value, not the original
- See skill: `.cursor/skills/richtext-content-with-hook/SKILL.md`

## Related: Base64 Image Deduplication

When testing with multiple identical base64 images in one field, `replaceBase64MediaWithMediaUrlsV2` deduplicates by base64 prefix → one media record. Tests expecting `descriptionMedia.length === N` for N identical images should use `toBeGreaterThanOrEqual(1)` or use distinct images.

## References

- Hook: `packages/module-user/src/collections/hooks/rich-text-content.ts`
- Changelog: `changelogs/0104-2026-03-08-rich-text-content-with-hook-validation-fix.md`
- Skill: `.cursor/skills/richtext-content-with-hook/SKILL.md`

## Status

✅ **RESOLVED** – Hook returns `result[fieldName] ?? value` so validation receives processed content.
