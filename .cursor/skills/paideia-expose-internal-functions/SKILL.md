---
name: paideia-expose-internal-functions
description: Add Paideia class methods when app routes call paideia.tryX that doesn't exist. Use when fixing "Property 'tryX' does not exist on type 'Paideia'" errors.
---

# Paideia: Exposing Internal Functions as Class Methods

## When to Use

- App route or server code calls `paideia.tryX(...)` and TypeScript reports: `Property 'tryX' does not exist on type 'Paideia'`
- Migrating routes from direct `payload`/internal imports to using `paideia` for backend operations

## Pattern

Internal `try*` functions live in `packages/paideia-backend/src/internal/` and take `payload` in their args (via `BaseInternalFunctionArgs`). The Paideia class wraps them so callers omit `payload`; Paideia injects it via `withPayload`.

### Step 1: Locate the Internal Function

Search for the function in internal modules:

```bash
# Example: find tryRegisterFirstUser
grep -r "tryRegisterFirstUser" packages/paideia-backend/src/
```

Common locations:

- `internal/user-management.ts` - user, auth, registration
- `internal/activity-module-management.ts` - tryUpdatePageModule, tryUpdateAssignmentModule, etc.
- `internal/quiz-module-management.ts` - tryAddQuizResource, tryToggleQuizType, etc.
- `internal/gradebook-management.ts`, `internal/course-management.ts`, etc.

### Step 2: Add Method to Paideia

In `packages/paideia-backend/src/paideia.ts`:

1. **Import the module** (if not already):

   ```typescript
   import * as quizModuleManagement from "./internal/quiz-module-management";
   ```

2. **Add the method** in the appropriate section (e.g. "Quiz module management"):

   ```typescript
   tryRegisterFirstUser(
     args: Omit<
       Parameters<typeof userManagement.tryRegisterFirstUser>[0],
       "payload"
     >,
   ) {
     return userManagement.tryRegisterFirstUser(this.withPayload(args));
   }
   ```

### Step 3: Update the Route

Remove any direct import of the internal function. Use `paideia.tryX` and omit `payload` from the args:

```typescript
// ❌ Before - direct import, passes payload
const result = await tryUpdateAssignmentModule({
  payload: paideia.getPayload(),
  id: params.moduleId,
  req: requestContext,
});

// ✅ After - paideia method, no payload
const result = await paideia.tryUpdateAssignmentModule({
  id: params.moduleId,
  req: requestContext,
});
```

## Reference

- Paideia class: `packages/paideia-backend/src/paideia.ts`
- Internal modules: `packages/paideia-backend/src/internal/`
- `withPayload` helper: `private withPayload<T>(args) { return { ...args, payload: this.getPayload() }; }`
- Changelog: `changelogs/0099-2026-03-04-paideia-method-additions-and-utils-backend.md`

## Related

- **oRPC/OpenAPI**: For exposing internal functions as REST endpoints, use `.cursor/skills/orpc-expose-internal-functions/SKILL.md` instead.
- **Internal function pattern**: `changelogs/0073-2025-11-27-internal-function-pattern-standardization.md`
