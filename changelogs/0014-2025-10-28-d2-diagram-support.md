# Changelog 0014: D2 Diagram Support

**Date:** October 28, 2025

## Summary

Added support for D2 diagrams in the rich text editor and renderer. D2 is a modern diagram scripting language that compiles to SVG. This feature enables users to create diagrams directly in course content using D2 syntax.

## Changes

### Backend

#### New API Endpoint: `/api/d2-render`
- **File:** `app/routes/api/d2-render.tsx`
- Accepts POST requests with D2 code
- Compiles D2 code to SVG using the D2 CLI
- Returns rendered SVG or error messages
- Handles temporary file creation and cleanup
- Uses zod for input validation
- 10-second timeout for compilation

#### New Custom Hook: `useD2Diagram`
- **File:** `app/routes/api/d2-render.tsx`
- React hook for rendering D2 diagrams
- Uses `useFetcher` and `fetcher.submit` for API calls
- Returns `{ renderD2, svg, loading, error, state }`
- Supports optional callbacks: `onSuccess`, `onError`
- Example usage:
  ```tsx
  const { renderD2, svg, loading, error } = useD2Diagram();
  renderD2("x -> y: hello world");
  ```

### Frontend

#### Rich Text Editor (`app/components/rich-text-editor.tsx`)
- Registered D2 as a language in lowlight
- D2 now appears in the code block language selector dropdown
- Users can select "d2" as the language for code blocks

#### Rich Text Renderer (`app/components/rich-text-renderer.tsx`)
- Added D2 block extraction logic (similar to Mermaid)
- Detects `language-d2` code blocks before syntax highlighting
- Calls backend API to compile D2 code to SVG
- Replaces D2 code blocks with rendered SVG diagrams
- Error handling with user-friendly error messages
- Placeholder shown while diagrams are rendering

#### Styling (`app/app.css`)
- Added `.d2-wrapper` styles for diagram containers
- Dark mode support for D2 diagrams
- Consistent styling with Mermaid diagrams
- Responsive SVG rendering

## Dependencies

- **System Requirement:** D2 CLI (v0.7.1+) installed via Homebrew or other package manager
  - Install: `brew install d2` (macOS)
  - See [D2 Installation Guide](https://github.com/terrastruct/d2#install) for other platforms

## Usage

To create a D2 diagram in the rich text editor:

1. Insert a code block
2. Select "d2" as the language
3. Write D2 diagram syntax
4. The diagram will render as SVG when viewing the content

Example D2 syntax:
```d2
x -> y: hello world
```

## Technical Details

- **Rendering Method:** Server-side compilation via D2 CLI
- **Processing Flow:** 
  1. Frontend extracts D2 code blocks
  2. Backend receives code via API
  3. D2 CLI compiles code to SVG
  4. SVG returned to frontend
  5. SVG replaces code block placeholder
- **Error Handling:** Both compilation errors and API errors are displayed to users
- **Performance:** Async rendering doesn't block other content
- **Custom Hook:** `useD2Diagram` hook available for custom implementations beyond the rich text editor

## Notes

- D2 uses generic syntax highlighting (no specific grammar available)
- Diagrams are compiled on-demand (no caching yet)
- Temporary files are automatically cleaned up after compilation
- Compatible with both light and dark themes

