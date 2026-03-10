# Server Refactor: Elysia to Connect + Bun.serve

**Date:** March 9, 2026  
**Type:** Infrastructure & Developer Experience  
**Impact:** High - Replaces Elysia with Connect (dev) and Bun.serve (production) for a simpler, more standard server stack

## Overview

Refactored the Paideia frontend server to remove Elysia and use Connect for development and `Bun.serve` for production. This streamlines dependencies, aligns with common Node.js patterns, and centralizes OpenAPI handling in the Paideia backend class.

## Changes

### 1. Dependencies

**Removed**:
- `@elysiajs/eden`
- `@elysiajs/openapi`
- `@elysiajs/static`
- `elysia`
- `elysia-connect-middleware`

**Added**:
- `@remix-run/node-fetch-server` - Convert Node req/res to Fetch API
- `@vitejs/plugin-rsc` - For future RSC support (commented out)
- `connect` - Middleware framework for dev server
- `serve-static` - Static file serving in dev
- `@types/connect`
- `@types/serve-static`

### 2. Development Server (`server/dev-server.ts`)

**New file** - Connect-based dev server with middleware order:

1. **OpenAPI** - Handles `/openapi/*` before Vite (prevents SPA fallback)
2. **Vite** - HMR, asset serving, React Router
3. **serve-static** - Static files from current directory
4. **React Router catch-all** - SSR for unmatched routes

Uses `createRequest` and `sendResponse` from `@remix-run/node-fetch-server` to bridge Node HTTP to Fetch API.

### 3. Production Server (`server/index.ts`)

**Refactored** - Uses `Bun.serve()` with a single `fetch` handler:

1. **OpenAPI** - `pathname.startsWith("/openapi")` → `paideia.handleOpenApiRequest(request)`
2. **VFS static** - `serveFromVfs()` for built assets from virtual file system
3. **React Router** - `createRequestHandler()` for SSR

### 4. VFS Static Serving (`server/static/serve-vfs.ts`)

**New file** - Serves static assets from the VFS map (base64-encoded files) in production:

- Replaces the Elysia static plugin
- Indexes VFS by path for fast lookup
- Supports ETag and Cache-Control for 304 responses
- Uses `isCachedVfs()` (no `if-modified-since` for virtual paths)

### 5. OpenAPI Handling in Paideia

**Moved** - `handleOpenApiRequest()` is now a method on the Paideia class:

- Serves `/openapi/spec.json` - OpenAPI spec
- Serves `/openapi` and `/openapi/` - Scalar docs HTML
- Otherwise - oRPC handler with `/openapi` prefix

**Implementation**: `packages/paideia-backend/src/paideia.ts`

### 6. Deleted Files

- `server/elysia-react-router.ts` - Elysia plugin for React Router
- `server/static/static-plugin.ts` - Elysia static plugin (replaced by serve-vfs)

### 7. Cache Module (`server/static/cache.ts`)

**Added** - `isCachedVfs()` for VFS-specific cache validation (ETag and Cache-Control only; skips `if-modified-since` since VFS paths are virtual).

### 8. Skills

- **Removed**: `.cursor/skills/elysia-vite-openapi-middleware/SKILL.md`
- **Added**: `.cursor/skills/vite-openapi-middleware/SKILL.md` - Documents OpenAPI middleware order for Connect + Vite

### 9. Types (`server/types.ts`)

**Simplified** - Removed Elysia-specific types (`PluginOptions`, `StaticPluginOptions`). Kept `GetLoadContext` with updated signature: `(request, serverBuild) => T`.

## Benefits

- **Simpler stack**: Connect and Bun.serve are standard, well-understood patterns
- **Fewer dependencies**: No Elysia ecosystem packages
- **Centralized OpenAPI**: Single `handleOpenApiRequest` in Paideia, reusable by any server
- **Consistent dev/prod**: Same request flow (OpenAPI → static → React Router) in both modes
- **Future RSC**: `@vitejs/plugin-rsc` added for when React Server Components are enabled

## Migration Notes

- No database changes
- No breaking changes to application routes or loaders
- `ENV=production` uses `Bun.serve`; development uses Connect + Vite
- VFS is still generated at build time and served via `serveFromVfs` in production
