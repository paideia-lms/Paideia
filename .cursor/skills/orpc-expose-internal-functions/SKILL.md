---
name: orpc-expose-internal-functions
description: Add oRPC procedures to expose internal functions from paideia-backend as OpenAPI. Use when adding new API endpoints or exposing internal try* functions to the OpenAPI spec.
---

# oRPC: Exposing Internal Functions as OpenAPI

## When to Use

- Adding new OpenAPI endpoints to Paideia
- Exposing internal `try*` functions from `packages/paideia-backend/src/internal/` as REST procedures

## Pattern

1. Create or extend an API module in `packages/paideia-backend/src/modules/*/api/` or `packages/paideia-backend/src/orpc/routers/`.
2. Export procedures using `os.$context<OrpcContext>()`, `os.route()`, `input()`, `output()`, `handler()`.
3. Call the try* function **directly** with explicit args (no generic `run` wrapper).
4. Use `req: context.req` and `overrideAccess: false` for user-authenticated endpoints; `overrideAccess: true` for admin-only.
5. Merge procedures into `packages/paideia-backend/src/orpc/router.ts`.

## Handler Pattern (Required)

**Do not use a generic `run` or `handleResult` wrapper.** Passing `(args: object) => Promise<...>` causes type errors:

```
Argument of type '(args: CreateNoteArgs) => AsyncResult<...>' is not assignable to parameter of type '(args: object) => Promise<...>'.
  Types of parameters 'args' and 'args' are incompatible.
    Type '{}' is missing the following properties from type 'CreateNoteArgs': data, payload, req
```

Call the try* function directly with explicit args. Reference implementations: `modules/user/api/user-management.ts`, `modules/user/api/media-management.ts`, `modules/note/api/note-management.ts`, `modules/infrastructure/api/cron-jobs-management.ts`.

```typescript
.handler(async ({ input, context }) => {
  const result = await tryFindUserById({
    payload: context.payload,
    userId: input.userId,
    req: context.req,
    overrideAccess: false,
  });
  if (!result.ok) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: result.error.message,
      cause: result.error,
    });
  }
  return result.value;
});
```

## Procedures Needing S3Client or userId

If the try* function requires `s3Client` or `userId`, check context and pass them:

```typescript
.handler(async ({ input, context }) => {
  if (!context.s3Client) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "S3 client not configured" });
  }
  if (!context.user) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "User not authenticated" });
  }
  const result = await tryRenameMedia({
    payload: context.payload,
    s3Client: context.s3Client,
    id: input.id,
    newFilename: input.newFilename,
    userId: context.user.id,
    req: context.req,
    overrideAccess: false,
  });
  // ...
});
```

## Example

```typescript
// modules/user/api/user-management.ts
import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { tryFindUserById } from "../services/user-management";
import type { OrpcContext } from "../../../orpc/context";

const userIdSchema = z.object({
  userId: z.coerce.number().int().min(1),
});

export const findUserById = os
  .$context<OrpcContext>()
  .route({ method: "GET", path: "/users/{userId}" })
  .input(userIdSchema)
  .output(z.any())
  .handler(async ({ input, context }) => {
    const result = await tryFindUserById({
      payload: context.payload,
      userId: input.userId,
      req: context.req,
      overrideAccess: false,
    });
    if (!result.ok) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: result.error.message,
        cause: result.error,
      });
    }
    return result.value;
  });
```

## Router Registration

```typescript
// router.ts
import { findCourseById } from "./routers/course-management";

export const orpcRouter = {
  courses: {
    findById: findCourseById,
  },
};
```

## Notes

- Use Zod v4 via `@orpc/zod/zod4` (already configured in openapi-handler).
- Path params use `{paramName}` in path; input schema must include that key.
- Query params: `input(schema.optional())` for optional query params.
- `context.payload` is the Payload instance.

## Schema Gotchas (OpenAPI spec generation)

**`schema._zod` error**: If OpenAPI spec generation fails with `undefined is not an object (evaluating 'schema._zod')`, the cause is often `z.record(z.unknown())`. The Zod v4 OpenAPI converter does not handle it. Fix:

```typescript
// ❌ Causes schema._zod error
where: z.record(z.unknown()).optional()
settings: z.record(z.unknown()).optional()

// ✅ Works - use explicit key and value schemas
where: z.record(z.string(), z.any()).optional()
settings: z.record(z.string(), z.any()).optional()
```

Use `z.record(z.string(), z.any())` for arbitrary key-value objects. `z.any()` alone in single-arg form may still fail; the two-arg form is required.

## Reference

- Internal modules: `packages/paideia-backend/src/internal/`
- API modules: `packages/paideia-backend/src/modules/*/api/` (e.g. `user-management.ts`, `media-management.ts`)
- Routers: `packages/paideia-backend/src/orpc/routers/`
- Incident (incomplete coverage): `release-notes/incidents/2026-03-03-openapi-incomplete-internal-functions.md`
- Incident (schema._zod / z.record): `release-notes/incidents/2026-03-03-orpc-schema-zod-record.md`
