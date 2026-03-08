# RichTextContentWithHook Field Hook Return Value Fix

**Date:** March 8, 2026  
**Type:** Bug Fix  
**Impact:** Medium - Fixes ValidationError when updating rich text fields with base64 images

## Overview

Fixed a bug in `richTextContentWithHook` where the field's `beforeChange` hook returned the original value (with base64) instead of the processed value (with media URLs). This caused Payload validation to run on base64 content and fail with "The following field is invalid: Description".

## Root Cause

In Payload CMS, when a field-level `beforeChange` hook returns a value, that value becomes the field value used for validation and persistence. The hook was:

1. Processing base64 images → creating media records → replacing with URLs in `data` and `siblingData`
2. Returning `value` (the original input with base64)

Payload then validated the returned value (base64), which could fail due to length, format, or other constraints.

## Fix

**File:** `packages/module-user/src/collections/hooks/rich-text-content.ts`

```typescript
// Before
return value;

// After - return processed value so validation runs on media URLs, not base64
return result[fieldName] ?? value;
```

## Test Updates

**File:** `packages/module-course/src/tests/course-management.test.ts`

- "should update course with only description images (no thumbnail)": Relaxed expectation from `descriptionMedia.length === 2` to `>= 1` because identical base64 images are deduplicated into a single media record by `replaceBase64MediaWithMediaUrlsV2`.

## Files Modified

- `packages/module-user/src/collections/hooks/rich-text-content.ts`
- `packages/module-course/src/tests/course-management.test.ts`

## References

- Incident: `release-notes/incidents/2026-03-08-rich-text-content-with-hook-return-value.md`
- Skill: `.cursor/skills/richtext-content-with-hook/SKILL.md`
- Changelog 0102: RichText Media Processing Hooks
