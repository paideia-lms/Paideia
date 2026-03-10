---
name: vite-openapi-middleware
description: Fix OpenAPI/API routes being served as SPA fallback when using React Router + Vite. Use when /openapi or other API paths return index.html instead of JSON in development.
---

# Vite + OpenAPI Middleware Order

## When to Use

- `/openapi/*` or other API paths return `index.html` instead of JSON in dev
- Scalar docs or API spec cannot load
- React Router reports "No routes matched location" for API requests

## Cause

In development, Vite serves the SPA and returns `index.html` for unmatched routes (SPA fallback). If the OpenAPI handler runs after Vite middleware, API paths get the SPA fallback.

## Solution

Register the OpenAPI handler **before** Vite middleware in the Connect app. In `dev-server.ts`, the order is:

1. OpenAPI middleware (pathname.startsWith("/openapi"))
2. Vite middlewares
3. Static files
4. React Router catch-all

### Implementation

```typescript
// In dev-server.ts - OpenAPI runs first
app.use(async (req, res, next) => {
  const pathname = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
  if (!pathname.startsWith("/openapi")) {
    next();
    return;
  }
  const request = await createRequest(req, res);
  const response = await handleOpenApiRequest(request);
  await sendResponse(res, response);
});
app.use(vite.middlewares);
// ...
```

`handleOpenApiRequest` should:
- Serve `/openapi/spec.json` → OpenAPI spec
- Serve `/openapi` or `/openapi/` → Scalar docs HTML
- Otherwise → oRPC handler with prefix `/openapi`

## Reference

- Incident: `release-notes/incidents/2026-03-03-vite-openapi-middleware-order.md`
- Server: `apps/paideia/server/dev-server.ts`, `apps/paideia/server/index.ts`
