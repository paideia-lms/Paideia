---
name: media-picker
description: Use MediaPickerModal for selecting existing media or uploading new files. Use when adding avatar, logo, or other media selection UI.
---

# Media Picker

## When to Use

- User needs to select an existing file from their media drive
- User needs to upload a new file and use it immediately (e.g. avatar, logo)
- Replacing a raw Dropzone with "choose from drive OR upload" flow

## Component

`MediaPickerModal` from `app/components/media-picker.tsx`

## Usage Pattern

```tsx
import {
  MediaPickerModal,
  type MediaPickerModalHandle,
} from "app/components/media-picker";

// 1. Create ref
const mediaPickerRef = useRef<MediaPickerModalHandle>(null);

// 2. Trigger button
<Button onClick={() => mediaPickerRef.current?.open()}>
  Choose
</Button>

// 3. Modal + handler
<MediaPickerModal
  ref={mediaPickerRef}
  userId={currentUserId}
  onSelect={(mediaId) => {
    // Update form, call action, etc.
    form.setFieldValue("avatar", mediaId);
  }}
  imagesOnly  // for avatar/logo; omit for all file types
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | `number` | Yes | User whose media drive to show |
| `onSelect` | `(mediaId: number) => void` | Yes | Called when user selects file or upload completes |
| `imagesOnly` | `boolean` | No | When true, only show/accept images (default: false) |
| `accept` | `string[]` | No | Override MIME types; when set, `imagesOnly` is ignored for accept |

## Ref API

```tsx
mediaPickerRef.current?.open();  // Opens the modal
```

## Data Source

- Fetches from `/api/media-picker/:userId` when modal opens
- Uses `useFetcher().load()` — no route navigation
- Upload uses `useUploadMedia(userId)` from user media route; on success, `onSelect(mediaId)` is called and modal closes

## Examples

- **Avatar**: `apps/paideia/app/routes/user/overview.tsx` — `imagesOnly`, form field `avatar`
- **Logo**: `apps/paideia/app/routes/admin/appearance/logo.tsx` — `imagesOnly`, `uploadLogo(mediaId)` per field

## Changelog

- `changelogs/0101-2026-03-10-media-picker-component.md`
