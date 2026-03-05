# Elysia Removal and Server Simplification

**Date:** March 4, 2026  
**Type:** Infrastructure / Developer Experience  
**Impact:** Medium - Simplifies server architecture, removes Elysia dependency

## Overview

Removed Elysia and replaced it with a simpler server setup: Bun.serve for production and Node's http.createServer with Connect for development. OpenAPI handling was moved into the Paideia backend class.

## Changes

### 1. Server Architecture

- **Production**: `Bun.serve` with a single fetch handler. Request flow: `/openapi` → Paideia.handleOpenApiRequest; static assets → serveFromVfs; otherwise → React Router.
- **Development**: Node's `http.createServer` with Connect app. Middleware order: OpenAPI → Vite → serve-static → React Router catch-all.

Vite requires Connect-style middleware; Bun.serve's fetch API cannot run Connect directly. Using Node's HTTP server (which Bun supports) is the simplest way to run Vite middleware in dev.

### 2. Removed Dependencies

- `elysia`
- `@elysiajs/static`
- `@elysiajs/eden`
- `@elysiajs/openapi`
- `elysia-connect-middleware`

### 3. Added Dependencies

- `connect` – Connect middleware for dev server
- `serve-static` – Static file serving in dev
- `@remix-run/node-fetch-server` – Node req/res ↔ Fetch conversion (replaces @mjackson/node-fetch-server)
- `@types/connect`, `@types/serve-static`

### 4. New Files

- `server/static/serve-vfs.ts` – Pure function to serve static assets from VFS in production
- `server/dev-server.ts` – Connect app + Node http server for development

### 5. Deleted Files

- `server/elysia-react-router.ts`
- `server/static/static-plugin.ts` (replaced by serve-vfs.ts)

### 6. Backend Encapsulation

- `handleOpenApiRequest` moved from `apps/paideia/server/index.ts` to `Paideia.handleOpenApiRequest()` in `packages/paideia-backend/src/paideia.ts`
- OpenAPI logic (spec, Scalar docs, oRPC handler) now lives in the backend package

## Technical Details

### virtual:react-router/server-build

The virtual module only exists when Vite is running. `server-build-access.ts` branches:
- Dev: `vite.ssrLoadModule("virtual:react-router/server-build")`
- Prod: `import("../build/server/index.js")`

### Node ↔ Fetch Conversion

`@remix-run/node-fetch-server` provides `createRequest(req, res)` and `sendResponse(res, response)` for converting between Node's IncomingMessage/ServerResponse and the Fetch API.

## References

- Incident: `release-notes/incidents/2026-03-04-react-router-server-architecture.md`
- Skill: `.cursor/skills/react-router-bun-server/SKILL.md`
