# Incident Report: Vite SPA Fallback Intercepts OpenAPI Routes

**Date**: March 3, 2026  
**Severity**: Medium (blocks OpenAPI in dev)  
**Affected**: `apps/paideia` dev server, `/openapi/*` routes  
**Status**: Resolved  
**Incident ID**: INC-2026-03-03-004

## Summary

In development, requests to `/openapi/spec.json` and `/openapi/*` returned `index.html` (SPA fallback) instead of the OpenAPI spec or oRPC handler responses. React Router reported "No routes matched location" because the request never reached Elysia's OpenAPI handler.

## Impact

**Symptoms**:
- `GET /openapi/spec.json` returns HTML instead of JSON
- Scalar docs cannot load the spec
- oRPC procedures return 404 or HTML

**Root Cause**:
- Elysia uses `reactRouter` plugin, which in dev mode delegates to Vite middleware
- Vite serves the SPA and returns `index.html` for unmatched routes (SPA fallback)
- Vite middleware runs before Elysia route handlers for the same request
- `/openapi/*` is not a React Router route, so Vite treats it as unmatched and serves `index.html`

## Resolution

Use Elysia's `onRequest` lifecycle hook and **return** a Response for `/openapi` paths. Returning a value from `onRequest` short-circuits the pipeline (skips route matching), so the request never reaches the reactRouter catch-all or Vite.

**Note**: Connect middleware (`elysia-connect-middleware`) does NOT reliably short-circuit: it may set headers/status but Elysia still proceeds to route matching. Use native `onRequest` instead.

### Implementation

```typescript
// apps/paideia/server/index.ts
const frontend = new Elysia()
  .onRequest(async ({ request }) => {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith("/openapi")) return;

    const response = await handleOpenApiRequest(request);
    return response;  // Short-circuits: skips route matching
  })
  .use(reactRouter(...));
```

`handleOpenApiRequest` should serve `/openapi/spec.json`, `/openapi` (Scalar docs HTML), and delegate other `/openapi/*` to the oRPC handler.

## Prevention

1. **Middleware order**: When adding API routes that must not be served as SPA, register middleware **before** the React Router / Vite plugin.
2. **Path prefix**: Use a distinct prefix (e.g. `/openapi`) so a single middleware can intercept all API routes.
3. **Elysia + Vite**: Elysia's plugin order matters; Connect middleware runs in request order before downstream plugins.

## References

- Changelog: `changelogs/0097-2026-03-03-orpc-openapi-integration.md`
- Skill: `.cursor/skills/elysia-vite-openapi-middleware/SKILL.md`
- Server: `apps/paideia/server/index.ts`

## Status

✅ **RESOLVED** - OpenAPI and oRPC routes work in both dev and production.
