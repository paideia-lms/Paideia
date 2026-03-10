# Incident Report: Media Text Preview Shows Garbled/Binary Content

**Date**: March 10, 2026  
**Severity**: Medium (poor UX, confusing output)  
**Affected**: `MediaPreviewText` component, user/admin media preview modal  
**Status**: Resolved  
**Incident ID**: INC-2026-03-10-001

## Summary

When previewing a text file (e.g. `job-logs.txt`) in the media drive, the content displayed as "random broken string" with control characters (NUL, ETX, SOH, etc.), mojibake, and Monaco's "This document contains many ambiguous unicode characters" warning. In some cases, PNG/IHDR headers appeared in the output, indicating binary data was being decoded as text.

## Root Causes

### 1. Wrong Content Served (Binary as Text)

The media API (`/api/media/file/:mediaId`) may return a different file than expected—e.g. a PNG image when the media record is named `job-logs.txt`. This can happen if:
- The media record points to the wrong file in storage
- The same media ID is used for different files
- Storage/DB inconsistency

**Symptom**: PNG magic bytes (`%PNG`, `IHDR`), control characters, mojibake.

### 2. Encoding Mismatch

Using `response.text()` assumes UTF-8. If the file is Latin-1/ISO-8859-1 or has invalid UTF-8 sequences, the decoded string is garbled.

**Symptom**: Mojibake (e.g. `Ã©` instead of `é`), replacement characters (�).

### 3. No Binary Detection

Binary content was passed directly to Monaco, which tried to render it as text, triggering the "ambiguous unicode" warning and displaying control-character labels.

## Resolution

### 1. Fetch as ArrayBuffer, Decode Explicitly

```typescript
// ❌ Wrong - browser may misdecode
const text = await response.text();
```

```typescript
// ✅ Correct - control decoding
const buffer = await response.arrayBuffer();
const text = decodeText(buffer);  // UTF-8 with fallback to ISO-8859-1
```

### 2. Binary Detection Before Decode

Check magic bytes for PNG, JPEG, GIF, PDF, ZIP. If matched, show error instead of decoding:

```
"This file appears to be binary (e.g. an image or PDF) and cannot be previewed as text. The file extension may not match the actual content."
```

Also use a heuristic: if >5% of the first 8KB are control characters (excluding tab, LF, CR), treat as binary.

### 3. Robust Decoding

- `TextDecoder('utf-8', { fatal: false })` — invalid UTF-8 becomes � instead of throwing
- Strip UTF-8 BOM if present
- If replacement count > 0.5% of length, try `TextDecoder('iso-8859-1')` (accepts all bytes)

## Prevention

- **Text preview**: Always fetch as `arrayBuffer()`, run binary detection, then decode with explicit encoding
- **Backend**: Ensure media records point to the correct file in storage; validate file type matches extension when possible
- See skill: `.cursor/skills/media-text-preview/SKILL.md`

## References

- `apps/paideia/app/components/media-preview-text.tsx` — `isBinaryBuffer()`, `decodeText()`
- Changelog: `changelogs/0100-2026-03-10-media-text-preview-with-monaco.md`

## Status

✅ **RESOLVED** — Binary detection and robust encoding in `MediaPreviewText`; clear error for binary files.
