# Incident Report: Payload TaskConfig Type Incompatibility with outputSchema

**Date**: March 7, 2026  
**Severity**: Medium (blocks typecheck when module-infrastructure is imported)  
**Affected**: `packages/module-infrastructure/src/tasks/sandbox-reset.ts`  
**Status**: Resolved (workaround)  
**Incident ID**: INC-2026-03-07-002

## Summary

When `TaskConfig` is used with `outputSchema`, TypeScript reports:

```
Type 'string' does not satisfy the constraint 'TaskInputOutput'.
Type '{ state: "succeeded"; output: { message: string; }; }' is not assignable to type 'TaskHandlerResult<"sandboxReset">'.
  Type '{ message: string; }' is not assignable to type 'never'.
```

This occurs even when the handler return value matches the outputSchema. Payload has a known type incompatibility (GitHub #13681) where generated types from `inputSchema`/`outputSchema` do not align with `TaskHandler<T>`.

## Impact

**Symptoms**:
- `bun run typecheck` fails in packages that import `@paideia/module-infrastructure` (e.g. module-user)
- Error points to the task handler's return type and the `TaskConfig<"slug">` generic

**Root Cause**:
- Payload's `TaskConfig` and `TaskHandler` types do not correctly infer output shape from `outputSchema`
- The handler returns `{ state: "succeeded", output: { message: string } }` which matches the schema, but TypeScript infers `output: never`

## Resolution (Workaround)

Use a type assertion to bypass the strict check:

```typescript
import type { PayloadRequest, TaskConfig } from "payload";

export const sandboxReset = {
  slug: "sandboxReset" as const,
  schedule: [...],
  outputSchema: [{ name: "message", type: "text", required: true }],
  handler: async ({ req }: { req: PayloadRequest }) => {
    // ... implementation
    return { state: "succeeded", output: { message: "..." } };
  },
} as unknown as TaskConfig;
```

**Key points**:
1. Type the handler parameter explicitly: `{ req }: { req: PayloadRequest }` (avoids implicit `any`)
2. Use `as unknown as TaskConfig` (omit the slug generic to avoid `TaskInputOutput` constraint)
3. Do not use `satisfies TaskConfig<"sandboxReset">` — it still fails

## Prevention

When adding new Payload tasks with `outputSchema`:
1. Use the same pattern: type handler param, return matching shape, assert `as unknown as TaskConfig`
2. Monitor Payload releases for a fix to #13681

## References

- Payload issue: https://github.com/payloadcms/payload/issues/13681
- Affected file: `packages/module-infrastructure/src/tasks/sandbox-reset.ts`
- Working example: `packages/paideia-backend/src/tasks/auto-submit-quiz.ts` (may have different typing)
- Skill: `.cursor/skills/module-package-refactoring/SKILL.md`

## Status

✅ **RESOLVED** (workaround) - Type assertion allows typecheck to pass. Runtime behavior is correct.
