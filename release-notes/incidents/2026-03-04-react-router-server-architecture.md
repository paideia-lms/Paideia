# Incident Report: React Router Server Architecture (Elysia Removed)

**Date**: March 4, 2026  
**Severity**: Medium (blocks dev/prod server setup)  
**Affected**: `apps/paideia` server, React Router SSR, Vite dev  
**Status**: Resolved  
**Incident ID**: INC-2026-03-04-001

## Summary

Elysia was removed in favor of a simpler server setup. Key learnings for future agents:

1. **virtual:react-router/server-build** – Virtual module only exists when Vite is running; production must use static import.
2. **Vite + Bun.serve** – Vite uses Connect middleware; Bun.serve's fetch API cannot run Connect directly.
3. **@mjackson/node-fetch-server** – Renamed to `@remix-run/node-fetch-server`.

## Impact

**Symptoms**:
- `Failed to load url virtual:react-router/server-build. Does the file exist?` when loading the virtual module in production or without Vite
- Need to run Vite middleware in dev but Bun.serve in prod

**Root Cause**:
- `virtual:react-router/server-build` is created by React Router's Vite plugin during development
- In production, the build outputs a physical file at `build/server/index.js`
- Bun.serve only accepts a fetch handler; Vite's `vite.middlewares` is a Connect app

## Resolution

### 1. Server Build Access (server-build-access.ts)

Use environment detection:

```typescript
// Dev: Vite must be created and setVite() called before any request
if (viteInstance) {
  return viteInstance.ssrLoadModule("virtual:react-router/server-build");
}
// Prod: static import
return import("../build/server/index.js");
```

### 2. Dual Server Architecture

- **Production**: `Bun.serve({ fetch })` – single fetch handler. Order: `/openapi` → VFS static → React Router.
- **Development**: Node's `http.createServer(connectApp)` – Connect app with: OpenAPI middleware → Vite middlewares → serve-static → React Router catch-all.

Vite requires Connect-style middleware; Node's HTTP server (which Bun supports) runs Connect.

### 3. Node req/res ↔ Fetch Conversion

Use `@remix-run/node-fetch-server` (formerly `@mjackson/node-fetch-server`):

```typescript
import { createRequest, sendResponse } from "@remix-run/node-fetch-server";

// Node req → Request
const request = await createRequest(req, res);

// Response → Node res
await sendResponse(res, response);
```

### 4. VFS Static Serving (Production)

Created `server/static/serve-vfs.ts` – pure function `serveFromVfs(request, vfs): Promise<Response | null>`. Replaces the Elysia static plugin for production binary.

## Prevention

1. **virtual module**: Never import `virtual:react-router/server-build` directly; always use `getServerBuild()` which branches on env.
2. **Connect in dev**: When using Vite middleware mode, the main server must be Connect-compatible (Node http or Express).
3. **Package rename**: Use `@remix-run/node-fetch-server` for Node ↔ Fetch conversion.

## References

- Skill: `.cursor/skills/react-router-bun-server/SKILL.md`
- Server: `apps/paideia/server/index.ts`, `apps/paideia/server/dev-server.ts`, `apps/paideia/server/server-build-access.ts`
- VFS: `apps/paideia/server/static/serve-vfs.ts`

## Status

✅ **RESOLVED** – Elysia removed; Bun.serve (prod) and Connect (dev) in place.
