---
name: elysia-vite-openapi-middleware
description: Fix OpenAPI/API routes being served as SPA fallback when using Elysia + React Router + Vite. Use when /openapi or other API paths return index.html instead of JSON in development.
---

# Elysia + Vite OpenAPI Middleware Order

## When to Use

- `/openapi/*` or other API paths return `index.html` instead of JSON in dev
- Scalar docs or API spec cannot load
- React Router reports "No routes matched location" for API requests

## Cause

In development, Elysia's `reactRouter` plugin delegates to Vite. Vite serves the SPA and returns `index.html` for unmatched routes (SPA fallback). Vite middleware runs before Elysia route handlers, so API paths that are not React Router routes get the SPA fallback.

## Solution

Use Elysia's `onRequest` and **return** a Response for the API path prefix. Returning a value from `onRequest` short-circuits the pipeline (skips route matching), so the request never reaches the reactRouter catch-all or Vite.

**Avoid** Connect middleware (`elysia-connect-middleware`) for this—it does not reliably short-circuit; Elysia may still proceed to route matching.

### Implementation

```typescript
const frontend = new Elysia()
  .onRequest(async ({ request }) => {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith("/openapi")) return;

    const response = await handleOpenApiRequest(request);
    return response;  // Short-circuits: skips route matching
  })
  .use(reactRouter(...));
```

`handleOpenApiRequest` should:
- Serve `/openapi/spec.json` → OpenAPI spec
- Serve `/openapi` or `/openapi/` → Scalar docs HTML
- Otherwise → oRPC handler with prefix `/openapi`

## Checklist

1. Identify the API path prefix (e.g. `/openapi`)
2. Add Connect middleware that matches that prefix
3. Register middleware **before** `reactRouter`
4. Convert Node req/res to Fetch Request, call handler, write response
5. Verify: `curl http://localhost:3001/openapi/spec.json` returns JSON

## Reference

- Incident: `release-notes/incidents/2026-03-03-vite-openapi-middleware-order.md`
- Server: `apps/paideia/server/index.ts`
