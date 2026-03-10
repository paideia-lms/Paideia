# Incident Report: OpenAPI Spec Generation Fails with schema._zod for z.record(z.unknown())

**Date**: March 3, 2026  
**Severity**: Medium (blocks OpenAPI spec generation)  
**Affected**: `packages/paideia-backend` OpenAPI spec at `/openapi/spec.json`  
**Status**: Resolved  
**Incident ID**: INC-2026-03-03-007

## Summary

When generating the OpenAPI spec (e.g. visiting `/openapi/spec.json` or running `openapi-handler.test.ts`), the process throws:

```
undefined is not an object (evaluating 'schema._zod')
```

The `ZodToJsonSchemaConverter` from `@orpc/zod/zod4` fails when processing certain Zod schemas.

## Impact

**Symptoms**:
- `/openapi/spec.json` returns an error or 500
- Scalar docs at `/openapi` show "Document could not be loaded"
- `bun test src/orpc/openapi-handler.test.ts` fails for full router

**Root Cause**:
- Procedures using `z.record(z.unknown())` in their input schema trigger the error
- The converter recursively processes the value schema of `z.record()`; `z.unknown()` in Zod v4 has a different internal structure that the converter does not handle
- Affected procedures: `media.getAll` (where), `courseActivityModuleLinks.create` (settings)

## Resolution

Replace `z.record(z.unknown())` with `z.record(z.string(), z.any())`:

```typescript
// ❌ Causes schema._zod
where: z.record(z.unknown()).optional()
settings: z.record(z.unknown()).optional()

// ✅ Works
where: z.record(z.string(), z.any()).optional()
settings: z.record(z.string(), z.any()).optional()
```

The explicit two-argument form `z.record(keySchema, valueSchema)` is required. Using `z.record(z.any())` (single arg) alone did not fix it; `z.record(z.string(), z.any())` works.

## Troubleshooting

To find which procedure causes the error, add a test that adds routers one by one and checks `openApiGenerator.generate(router, opts)` for each. The failing router/procedure will throw.

## Prevention

- Use `z.record(z.string(), z.any())` for arbitrary key-value objects in oRPC input schemas
- Avoid `z.record(z.unknown())` when the schema is used for OpenAPI generation

## References

- oRPC skill: `.cursor/skills/orpc-expose-internal-functions/SKILL.md`
- Routers: `packages/paideia-backend/src/orpc/routers/media-management.ts`, `course-activity-module-link-management.ts`
- Test: `packages/paideia-backend/src/orpc/openapi-handler.test.ts`

## Status

✅ **RESOLVED** - Use `z.record(z.string(), z.any())` for record schemas in oRPC procedures.
