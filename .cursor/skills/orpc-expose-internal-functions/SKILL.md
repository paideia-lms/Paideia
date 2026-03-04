---
name: orpc-expose-internal-functions
description: Add oRPC procedures to expose internal functions from paideia-backend as OpenAPI. Use when adding new API endpoints or exposing internal try* functions to the OpenAPI spec.
---

# oRPC: Exposing Internal Functions as OpenAPI

## When to Use

- Adding new OpenAPI endpoints to Paideia
- Exposing internal `try*` functions from `packages/paideia-backend/src/internal/` as REST procedures

## Pattern

1. Create or extend a router in `packages/paideia-backend/src/orpc/routers/`.
2. Export procedures using `os.$context<OrpcContext>()`, `os.route()`, `input()`, `output()`, `handler()`.
3. Call internal function with `overrideAccess: true`.
4. Merge router into `packages/paideia-backend/src/orpc/router.ts`.

## Example

```typescript
// routers/course-management.ts
import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { tryFindCourseById } from "../../internal/course-management";
import type { OrpcContext } from "../context";

const courseIdSchema = z.object({
  courseId: z.coerce.number().int().min(1),
});

export const findCourseById = os
  .$context<OrpcContext>()
  .route({ method: "GET", path: "/courses/{courseId}" })
  .input(courseIdSchema)
  .output(z.any())
  .handler(async ({ input, context }) => {
    const result = await tryFindCourseById({
      payload: context.payload,
      courseId: input.courseId,
      req: undefined,
      overrideAccess: true,
    });
    if (!result.ok) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: result.error.message,
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
- Existing routers: `packages/paideia-backend/src/orpc/routers/`
- Incident (incomplete coverage): `release-notes/incidents/2026-03-03-openapi-incomplete-internal-functions.md`
- Incident (schema._zod / z.record): `release-notes/incidents/2026-03-03-orpc-schema-zod-record.md`
