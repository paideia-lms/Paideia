# Incident Report: Vite SPA Fallback Intercepts OpenAPI Routes

**Date**: March 3, 2026  
**Severity**: Medium (blocks OpenAPI in dev)  
**Affected**: `apps/paideia` dev server, `/openapi/*` routes  
**Status**: Resolved  
**Incident ID**: INC-2026-03-03-004

## Summary

In development, requests to `/openapi/spec.json` and `/openapi/*` returned `index.html` (SPA fallback) instead of the OpenAPI spec or oRPC handler responses. React Router reported "No routes matched location" because the request never reached the OpenAPI handler.

## Impact

**Symptoms**:
- `GET /openapi/spec.json` returns HTML instead of JSON
- Scalar docs cannot load the spec
- oRPC procedures return 404 or HTML

**Root Cause**:
- The dev server uses Connect + Vite middleware
- Vite serves the SPA and returns `index.html` for unmatched routes (SPA fallback)
- If the OpenAPI handler runs **after** Vite middleware, `/openapi/*` is treated as unmatched and gets `index.html`

## Resolution

Register the OpenAPI handler **before** Vite middleware in the Connect app. In `dev-server.ts`, the middleware order is:

1. OpenAPI middleware (pathname.startsWith("/openapi")) – must run first
2. Vite middlewares
3. Static files
4. React Router catch-all

### Implementation (Current)

```typescript
// apps/paideia/server/dev-server.ts
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

In production (Bun.serve), the fetch handler checks pathname first and short-circuits for `/openapi` before serving static or React Router.

## Prevention

1. **Middleware order**: When adding API routes that must not be served as SPA, register middleware **before** Vite.
2. **Path prefix**: Use a distinct prefix (e.g. `/openapi`) so a single middleware can intercept all API routes.
3. **Connect order**: Middleware runs in registration order; first match wins.

## References

- Changelog: `changelogs/0097-2026-03-03-orpc-openapi-integration.md`
- Skill: `.cursor/skills/vite-openapi-middleware/SKILL.md`
- Server: `apps/paideia/server/dev-server.ts`, `apps/paideia/server/index.ts`

## Status

✅ **RESOLVED** - OpenAPI and oRPC routes work in both dev and production.
