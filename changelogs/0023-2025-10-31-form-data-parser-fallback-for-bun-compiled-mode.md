# Changelog 0023: Form Data Parser Fallback for Bun Compiled Mode

**Date**: October 31, 2025

## Overview

Implemented automatic fallback mechanism for form data parsing to support Bun's compiled binary mode. The `@remix-run/form-data-parser` library works correctly in development mode but fails in production/compiled mode due to missing stream APIs. This change adds a fallback that automatically detects when `parseFormData` fails and uses Bun's native FormData API instead.

## Issue

In Bun's compiled binary mode (production builds), `@remix-run/form-data-parser` fails with a `TypeError: undefined is not a function` error at `readStream`. This occurs because certain Node.js stream APIs that `parseFormData` relies on are not available in Bun's compiled binary.

The error was:
```
Note creation error: TypeError: undefined is not a function
      at unknown:1:11
      at readStream (../node_modules/.pnpm/@remix-run+form-data-parser@0.11.0/node_modules/@remix-run/form-data-parser/dist/index.js:1612:12)
```

This issue only manifests in production/compiled mode, not in development mode where `parseFormData` works correctly.

## Solution

Created a fallback mechanism that automatically detects if `parseFormData` works and falls back to Bun's native FormData API when it doesn't.

## Features

### 1. Automatic Fallback Detection

The `parseFormDataWithFallback` utility automatically detects when `parseFormData` fails:
- Tests `parseFormData` on the first real request (not a synthetic test)
- Caches the result after first test to avoid repeated testing
- Only falls back on specific stream-related errors (`TypeError` with "undefined is not a function", "readStream", or "stream" in message)
- Re-throws other errors to maintain proper error handling

### 2. FileUpload Adapter

Created a FileUpload-like adapter to maintain backward compatibility:
- Wraps native `File` objects with all required FileUpload properties
- Implements all FileUpload methods (`arrayBuffer`, `stream`, `text`, `slice`, `bytes`, `json`, `formData`)
- Ensures existing upload handlers work without modification

### 3. Memory Efficient Implementation

Optimized to minimize memory overhead:
- Only clones request once on first test
- Subsequent requests use original request directly (no cloning needed)
- Cached result prevents repeated testing

## Implementation

1. **Created `parseFormDataWithFallback` utility** (`app/utils/parse-form-data-with-fallback.ts`):
   - Tests `parseFormData` on the first request and caches the result
   - If `parseFormData` works (dev mode), uses it directly
   - If `parseFormData` fails with stream-related errors (compiled mode), falls back to Bun's native `request.formData()` API
   - Creates a FileUpload-like adapter to maintain backward compatibility with existing upload handlers

2. **Updated all file upload routes** to use the fallback:
   - `app/routes/user/note-create.tsx`
   - `app/routes/user/note-edit.tsx`
   - `app/routes/course.$id.settings.tsx`
   - `app/routes/admin/new.tsx`
   - `app/routes/course/module.$id.tsx`
   - `app/routes/user/overview.tsx`

### Key Features

- **Automatic detection**: Tests `parseFormData` on the first real request (not a synthetic test)
- **Caching**: Results are cached after first test, so subsequent requests use the appropriate method without testing
- **Backward compatible**: No changes needed to existing upload handler code
- **Memory efficient**: Only clones request once on first test, then uses original request for subsequent requests
- **Error handling**: Only falls back on specific stream-related errors, re-throws other errors

### How It Works

1. **First request**:
   - Clones the request before testing
   - Tries `parseFormData` on the cloned request
   - If successful: caches `true` and returns result
   - If fails with stream error: caches `false`, uses original request with native FormData API

2. **Subsequent requests**:
   - If cached as `true`: uses `parseFormData` directly on original request
   - If cached as `false`: skips `parseFormData` and uses native FormData API directly

### Technical Details

The fallback processes files manually:
- Iterates through FormData entries
- Detects File objects by checking for `name`, `size`, and `type` properties
- Creates a FileUpload-like adapter object with all required properties and methods
- Calls the existing upload handler with the adapter
- Replaces file entries with returned IDs (as strings) in the FormData

## Files Changed

- `app/utils/parse-form-data-with-fallback.ts` (new file)
- `app/routes/user/note-create.tsx`
- `app/routes/user/note-edit.tsx`
- `app/routes/course.$id.settings.tsx`
- `app/routes/admin/new.tsx`
- `app/routes/course/module.$id.tsx`
- `app/routes/user/overview.tsx`

## Testing

Test in both environments:
- **Development mode**: Should use `parseFormData` (works as before)
- **Production/compiled mode**: Should fall back to native FormData API (fixes the stream error)

All file upload functionality should work identically in both modes.

