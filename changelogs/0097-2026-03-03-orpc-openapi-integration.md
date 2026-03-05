# oRPC OpenAPI Integration

**Date:** March 3, 2026  
**Type:** API / Developer Experience  
**Impact:** Medium - Adds OpenAPI-compliant REST API surface with Scalar docs

## Overview

Integrated [oRPC](https://orpc.dev) into `packages/paideia-backend` to serve OpenAPI-compliant REST APIs. The API is exposed at `/openapi` with Scalar-powered documentation. All endpoints are public for now (no API key/auth).

## Features Added

### 1. oRPC Handler and Router

**Features**:
- OpenAPIHandler with CORS and ZodSmartCoercionPlugin
- REST-style procedures for health, system globals, version, courses, and users
- Handler exposed via `Paideia.getOpenApiHandler()`

**Implementation**:
- `packages/paideia-backend/src/orpc/` - router, context, openapi-handler, routers/
- Uses `@orpc/server`, `@orpc/openapi`, `@orpc/zod` (zod4 for Zod v4)
- Procedures wrap internal `try*` functions with `overrideAccess: true`

### 2. Scalar API Documentation

**Features**:
- OpenAPI spec at `/openapi/spec.json`
- Scalar docs UI at `/openapi` and `/openapi/`
- Spec generated via OpenAPIGenerator with ZodToJsonSchemaConverter

**Implementation**:
- `createOpenApiGenerator()` and `createScalarDocsHtml(specUrl)` in openapi-handler
- HTML page loads Scalar from CDN and fetches spec from same origin

### 3. Middleware Order Fix (Vite vs OpenAPI)

**Problem**: In development, Vite middleware runs before API routes. Requests to `/openapi/spec.json` were served `index.html` (SPA fallback), causing "No route matches" from React Router.

**Solution**: Add Connect middleware that handles `/openapi` paths **before** Vite. Requests to `/openapi/*` are intercepted and never reach Vite or React Router.

**Implementation** (updated March 2026 – Elysia removed):
- OpenAPI middleware runs first in `dev-server.ts` Connect app
- Uses `@remix-run/node-fetch-server` for Node req/res → Fetch conversion
- `handleOpenApiRequest` moved to `Paideia.handleOpenApiRequest()` in paideia-backend

## Technical Details

### File Structure

```
packages/paideia-backend/src/orpc/
├── context.ts
├── openapi-handler.ts
├── router.ts
└── routers/
    ├── health.ts
    ├── system-globals.ts
    ├── version-management.ts
    ├── course-management.ts
    └── user-management.ts
```

### Exposed Procedures (Initial Set)

- `GET /openapi/health` - Health check
- `GET /openapi/ping` - Ping
- `GET /openapi/system-globals` - System globals
- `GET /openapi/version/latest?currentVersion=...` - Version check
- `GET /openapi/courses/{courseId}` - Find course by ID
- `GET /openapi/courses/search` - Search courses
- `GET /openapi/courses/published` - Published courses
- `GET /openapi/users/{userId}` - Find user by ID
- `GET /openapi/users/by-email?email=...` - Find user by email
- `GET /openapi/users` - List users

### Dependencies Added

- `@orpc/server`
- `@orpc/openapi`
- `@orpc/zod`

## Files Added/Modified

**Added**:
- `packages/paideia-backend/src/orpc/context.ts`
- `packages/paideia-backend/src/orpc/openapi-handler.ts`
- `packages/paideia-backend/src/orpc/router.ts`
- `packages/paideia-backend/src/orpc/routers/health.ts`
- `packages/paideia-backend/src/orpc/routers/system-globals.ts`
- `packages/paideia-backend/src/orpc/routers/version-management.ts`
- `packages/paideia-backend/src/orpc/routers/course-management.ts`
- `packages/paideia-backend/src/orpc/routers/user-management.ts`

**Modified**:
- `packages/paideia-backend/package.json` - oRPC deps
- `packages/paideia-backend/src/paideia.ts` - `getOpenApiHandler()`
- `packages/paideia-backend/src/server.ts` - exports
- `apps/paideia/server/index.ts` - OpenAPI middleware and handler

## Remaining Work

**Not yet done**: All internal functions from `packages/paideia-backend/src/internal/` should be exposed as OpenAPI procedures. The plan defines ~250+ procedures across 26 modules. Only a subset (health, system-globals, version, courses, users) is implemented. Future work: add routers for enrollment-management, note-management, quiz-submission-management, etc.

See incident report: `release-notes/incidents/2026-03-03-openapi-incomplete-internal-functions.md`

## References

- Incident report (Vite middleware): `release-notes/incidents/2026-03-03-vite-openapi-middleware-order.md`
- Incident report (incomplete coverage): `release-notes/incidents/2026-03-03-openapi-incomplete-internal-functions.md`
- Skill: `.cursor/skills/elysia-vite-openapi-middleware/SKILL.md`
- oRPC docs: https://orpc.dev/docs/openapi/getting-started
