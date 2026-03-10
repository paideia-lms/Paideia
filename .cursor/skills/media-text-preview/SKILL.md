---
name: media-text-preview
description: Preview text-based files (.txt, .md, .json, etc.) in media drive. Use when adding or fixing text file preview in user/admin media pages.
---

# Media Text Preview

## When to Use

- Adding preview for text files in media drive (user or admin)
- Fixing garbled/broken text display in media preview
- Handling binary content mistakenly served as text

## Key Patterns

### 1. Fetch as ArrayBuffer, Not text()

Never use `response.text()` for user-uploaded files. Control decoding explicitly:

```typescript
const buffer = await response.arrayBuffer();
// 1. Check binary first
if (isBinaryBuffer(buffer)) {
  setError("This file appears to be binary...");
  return;
}
// 2. Decode with fallback
setContent(decodeText(buffer));
```

### 2. Binary Detection

Before decoding, check:
- **Magic bytes**: PNG (89 50 4E 47...), JPEG (FF D8 FF), GIF, PDF, ZIP
- **Control chars**: If >5% of first 8KB are control chars (excl. tab, LF, CR), treat as binary

Show a clear error instead of feeding binary to Monaco.

### 3. Encoding

- UTF-8 with `TextDecoder('utf-8', { fatal: false })` — invalid bytes become �
- Strip UTF-8 BOM (EF BB BF) if present
- If replacement count > 0.5% of length, try ISO-8859-1 (Latin-1)

### 4. Monaco Editor (Read-Only)

Use `@monaco-editor/react` with:
- `readOnly: true`
- `language` from `getTextPreviewLanguage(filename)` (map tsx → typescript for Monaco)
- `theme`: `colorScheme === "dark" ? "vs-dark" : "light"`
- `active` prop: only fetch when modal is open (avoids N fetches for N text files)

### 5. Media Helpers

- `isText(mimeType)` — text MIME types
- `getTextPreviewLanguage(filename)` — extension → language ID
- `canPreview(mimeType)` — includes text files

## File Location

- Component: `apps/paideia/app/components/media-preview-text.tsx`
- Helpers: `apps/paideia/app/utils/media-helpers.tsx`

## Incident

- `release-notes/incidents/2026-03-10-media-text-preview-binary-encoding.md`
