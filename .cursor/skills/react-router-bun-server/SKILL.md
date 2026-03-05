---
name: react-router-bun-server
description: Set up React Router SSR with Bun. Use when virtual:react-router/server-build fails, or when integrating React Router with Bun.serve / Vite dev server.
---

# React Router + Bun Server

## When to Use

- `virtual:react-router/server-build` error: "Does the file exist?"
- Setting up React Router SSR with Bun (no Elysia/Express)
- Vite dev server + React Router in same process

## Key Concepts

### 1. Virtual Module (Dev Only)

`virtual:react-router/server-build` is created by React Router's Vite plugin. It only exists when Vite is running. **Never** import it directly in production code.

```typescript
// server-build-access.ts
if (viteInstance) {
  return viteInstance.ssrLoadModule("virtual:react-router/server-build");
}
return import("../build/server/index.js");  // Prod
```

### 2. Dev vs Prod Server

| Mode | Server | Why |
|------|--------|-----|
| Dev | Node `http.createServer(connectApp)` | Vite middleware is Connect; Bun.serve cannot run Connect |
| Prod | `Bun.serve({ fetch })` | No Vite; simple fetch handler |

### 3. Connect Middleware Order (Dev)

1. OpenAPI/API routes (before Vite so they don't get SPA fallback)
2. `vite.middlewares`
3. Static files
4. React Router catch-all

### 4. Node ↔ Fetch Conversion

Use `@remix-run/node-fetch-server` (not `@mjackson/node-fetch-server` – renamed):

```typescript
import { createRequest, sendResponse } from "@remix-run/node-fetch-server";

const request = await createRequest(req, res);
const response = await handler(request);
await sendResponse(res, response);
```

## Checklist

1. Create Vite with `middlewareMode: true` before Connect app handles requests
2. Call `setVite(vite)` so `getServerBuild()` can use `ssrLoadModule` in dev
3. In prod, ensure `getServerBuild()` uses static import (no virtual module)
4. OpenAPI handler runs **before** Vite in dev
5. Use `@remix-run/node-fetch-server` for req/res conversion

## Reference

- Incident: `release-notes/incidents/2026-03-04-react-router-server-architecture.md`
- Server: `apps/paideia/server/index.ts`, `apps/paideia/server/dev-server.ts`
