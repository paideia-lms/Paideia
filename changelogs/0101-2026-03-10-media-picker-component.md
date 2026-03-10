# Media Picker Component

**Date:** March 10, 2026  
**Type:** Feature Enhancement  
**Impact:** Medium - Moodle-style media picker for selecting existing media or uploading new files; used for avatar, logo, and other media selection

## Overview

The Media Picker is a modal component that lets users select existing media from their drive or upload new files. It displays storage usage, supports MIME filtering (e.g. images only for avatars), and integrates with the user media upload flow. Used in user overview (avatar) and admin appearance (logo) pages.

## Component

### MediaPickerModal (`app/components/media-picker.tsx`)

**Props**:
- `userId: number` — User whose media drive to show (current user or admin viewing another user)
- `onSelect: (mediaId: number) => void` — Called when user selects a file or upload completes
- `imagesOnly?: boolean` — When true, only show and accept image files (e.g. avatar, logo)
- `accept?: string[]` — Optional MIME types to accept; overrides `imagesOnly` when set

**Ref API**:
- `MediaPickerModalHandle` — `open(): void` to open the modal programmatically

**Usage pattern**:
```tsx
const mediaPickerRef = useRef<MediaPickerModalHandle>(null);

<Button onClick={() => mediaPickerRef.current?.open()}>Choose</Button>
<MediaPickerModal
  ref={mediaPickerRef}
  userId={currentUserId}
  onSelect={(mediaId) => handleSelect(mediaId)}
  imagesOnly  // for avatar/logo
/>
```

## API

### `/api/media-picker/:id` (`app/routes/api/media-picker.$id.tsx`)

**Loader** — Returns:
- `media` — User's media files (first 50, with delete permissions)
- `stats` — `{ totalSize }` from `tryGetUserMediaStats`
- `storageLimit` — From `systemGlobals.sitePolicies.userMediaStorageTotal`
- `uploadLimit` — From `systemGlobals.sitePolicies.siteUploadLimit`

**Access**: Authenticated users can access their own media; admins can access any user's media.

**Hook**: `useMediaPickerData` — Loader RPC hook (used internally by the component via `useFetcher().load()`).

## UI Structure

- **Left sidebar**: Tabs (Private files, Upload a file), storage usage progress
- **Main area**:
  - **Private files**: Grid of existing media; click to select and close
  - **Upload**: Mantine Dropzone; on upload success, calls `onSelect(mediaId)` and closes modal

## Current Usage

### 1. User Overview — Avatar Selection (`app/routes/user/overview.tsx`)

- "Choose avatar" opens MediaPicker with `imagesOnly`
- `onSelect` updates form with `avatar: mediaId` (or `null` to clear)
- Form submit sends `avatar` to update action

### 2. Admin Appearance — Logo Selection (`app/routes/admin/appearance/logo.tsx`)

- Each logo field (Logo Light, Logo Dark, Compact Logo Light, Compact Logo Dark, Favicon) has its own MediaPicker
- "Choose" opens MediaPicker with `imagesOnly`
- `onSelect` calls `uploadLogo(mediaId)` which submits the media ID for that field
- Form uses `inputSchema.partial()` for partial updates; only the selected field is sent

### 3. Course Settings — Thumbnail Selection (`app/routes/course.$id.settings.tsx`)

- `ThumbnailPicker` component uses MediaPicker for course thumbnail
- "Choose thumbnail" opens MediaPicker with `imagesOnly`
- `onSelect` sets form field `thumbnail: mediaId`; "Remove" clears it
- Backend `tryUpdateCourse` expects `thumbnail?: number | null` (media ID)

### 4. File Module — Add Files (`app/components/file-uploader.tsx`)

- `FileUploader` uses MediaPicker for adding files (replaces defer-upload Dropzone)
- "Add files" opens MediaPicker; user selects existing or uploads new (immediate)
- `onSelect` appends `mediaId` to linked list; remove button unlinks
- Form value: `{ mediaIds: number[] }`; backend expects `media: number[]`

### 5. Rich Text Editor — Insert Image Tool (`app/components/rich-text/rich-text-editor.tsx`)

- `AddImageFromMediaPickerControl` toolbar button (IconPhotoPlus) when `userId` prop provided
- Opens MediaPicker with `imagesOnly`; `onSelect` inserts image node with `src="/api/media/file/:mediaId"`
- Used in course description (`course.$id.settings.tsx`), notes (`note-edit.tsx`, `note-create.tsx`) when `userId` passed via `FormableRichTextEditor`

## Data Flow

1. User clicks "Choose" → `mediaPickerRef.current?.open()`
2. Modal opens → `fetcher.load(\`/api/media-picker/${userId}\`)`
3. User selects existing file or uploads new → `onSelect(mediaId)`
4. Parent handles selection (e.g. form set value, upload action)
5. Modal closes (on select or upload success)

## Upload Integration

- Uses `useUploadMedia(userId)` from `~/routes/user/media`
- On upload success, `uploadFetcher.data` contains `{ status, mediaId }`
- Component calls `onSelect(mediaId)` and `setOpened(false)` in `useEffect` when upload succeeds

## References

- Component: `apps/paideia/app/components/media-picker.tsx`
- API: `apps/paideia/app/routes/api/media-picker.$id.tsx`
- Skill: `.cursor/skills/media-picker/SKILL.md`
