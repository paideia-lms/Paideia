# Media Text Preview with Monaco Editor

**Date:** March 10, 2026  
**Type:** Feature Enhancement  
**Impact:** Medium - Adds text file preview for .txt, .md, .json, and other text-based files in user and admin media pages

## Overview

Added preview support for text-based files in the media drive (user and admin). Text files are now displayed in a read-only Monaco Editor with syntax highlighting, line numbers, and proper handling of encoding and binary content. This replaces the previous "Preview not available" message for text files.

## Changes

### 1. Media Helpers (`app/utils/media-helpers.tsx`)

**Added**:
- `isText(mimeType)` - Detects text-based MIME types (plain text, markdown, HTML, CSS, JS, JSON, XML, YAML, Python, shell, etc.)
- `getTextPreviewLanguage(filename)` - Maps file extension to Monaco/CodeHighlight language ID
- Updated `canPreview(mimeType)` to include text files so the Preview button appears for .txt, .md, etc.

### 2. Media Preview Text Component (`app/components/media-preview-text.tsx`)

**New component** - Shared by user and admin media routes:

- **Monaco Editor (read-only)**: Uses `@monaco-editor/react` with `readOnly: true`, same pattern as rich-text-editor source code mode
- **Theme**: Follows Mantine color scheme (`vs-dark` / `light`)
- **Encoding**: Fetches as `arrayBuffer()`, decodes with `TextDecoder`:
  - UTF-8 first (with BOM strip), `fatal: false` for invalid sequences
  - Falls back to ISO-8859-1 if UTF-8 produces many replacement characters (Latin-1 files)
- **Binary detection**: Before decoding, checks magic bytes (PNG, JPEG, GIF, PDF, ZIP) and control-character heuristic; shows clear error instead of garbled output
- **Size limit**: 5MB fetch limit (Monaco handles large content; limit avoids loading huge files)
- **Lazy fetch**: `active` prop skips fetch when modal is closed (avoids N simultaneous fetches for N text files on the page)

### 3. User Media Route (`app/routes/user/media.tsx`)

**Updated**:
- Import `MediaPreviewText` and `isText`
- In `MediaPreviewModal` `renderPreview()`, add branch for text files before fallback
- Pass `active={opened}` so fetch runs only when modal is open

### 4. Admin Media Route (`app/routes/admin/media.tsx`)

**Updated**:
- Same changes as user media route

## File Types Supported

| Extension | Language |
|-----------|----------|
| .txt | plaintext |
| .md | markdown |
| .json | json |
| .xml | xml |
| .yaml, .yml | yaml |
| .html, .htm | html |
| .css | css |
| .js, .mjs, .cjs | javascript |
| .ts, .mts, .cts | typescript |
| .tsx | typescript |
| .py | python |
| .sh, .bash | bash |

## Benefits

- **Readable preview**: Text files display with syntax highlighting and line numbers
- **Large files**: Monaco handles large content; 5MB limit for fetch avoids loading huge files
- **Robust encoding**: UTF-8 and Latin-1 files display correctly; binary files show a clear error
- **Consistent UX**: Same preview experience in user and admin media pages

## References

- Incident: `release-notes/incidents/2026-03-10-media-text-preview-binary-encoding.md`
- Skill: `.cursor/skills/media-text-preview/SKILL.md`
- Related: Media Picker (avatar, logo selection) — `changelogs/0101-2026-03-10-media-picker-component.md`
