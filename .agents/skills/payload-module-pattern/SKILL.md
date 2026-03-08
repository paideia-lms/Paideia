---
name: payload-module-pattern
description: Use when creating new resource modules in Payload (CRUD services, API endpoints, tests, seeders). Follows the established pattern from note and pages modules.
---

# Payload Module Creation Pattern

Standard pattern for creating complete resource modules in Paideia with services, API, tests, and seeders.

## Module Structure

```
packages/paideia-backend/src/modules/{module-name}/
├── collections/           # Already exists (collection definition)
├── services/              # CRUD service functions
│   └── {module}-management.ts
├── api/                   # ORPC API endpoints
│   └── {module}-management.ts
├── seeding/               # Seed data and builders
│   ├── {module}-seed-schema.ts
│   ├── {module}-builder.ts
│   ├── predefined-{module}-seed-data.ts
│   └── {module}-management-test-seed-data.ts
├── tests/                 # Test files
│   ├── {module}-management.test.ts
│   ├── {module}-builder.test.ts
│   └── openapi-generation.test.ts
└── index.ts               # Module exports
```

## Quick Reference

| Layer | File Pattern | Purpose |
|-------|-------------|---------|
| Services | `{module}-management.ts` | CRUD operations with Result types |
| API | `{module}-management.ts` | ORPC endpoints with Zod validation |
| Seeding | `{module}-builder.ts` | SeedBuilder implementation |
| Tests | `{module}-management.test.ts` | CRUD + access control tests |
| Tests | `{module}-builder.test.ts` | Seeder functionality tests |
| Tests | `openapi-generation.test.ts` | API spec generation tests |

## Step-by-Step Implementation

### 1. Service Layer

**File**: `services/{module}-management.ts`

**Pattern**:
```typescript
import { Result } from "typescript-result";
import { InvalidArgumentError, transformError, UnknownError } from "../../../errors";
import { stripDepth, type BaseInternalFunctionArgs } from "shared/internal-function-utils";
import { handleTransactionId } from "shared/handle-transaction-id";

// 1. Define argument interfaces
export interface Create{Module}Args extends BaseInternalFunctionArgs {
  data: {
    title: string;
    description?: string;
    createdBy: number;
  };
}

// 2. Implement CRUD functions
export function tryCreate{Module}(args: Create{Module}Args) {
  return Result.try(
    async () => {
      const { payload, data, req, overrideAccess = false } = args;
      
      // Validation
      if (!data.title || data.title.trim().length === 0) {
        throw new InvalidArgumentError("Title cannot be empty");
      }
      
      // Transaction handling
      const transactionInfo = await handleTransactionId(payload, req);
      
      return await transactionInfo.tx(async (txInfo) => {
        const entity = await payload.create({
          collection: "{modules}",
          data: { ...data } as any,  // Type assertion for new fields
          req: txInfo.reqWithTransaction,
          overrideAccess,
          depth: 0,
        }).then(stripDepth<0, "create">());
        
        return entity;
      });
    },
    (error) => transformError(error) ?? new UnknownError("Failed to create {module}", { cause: error })
  );
}
```

**Key Points**:
- Always use `Result.try()` for error handling
- Always use `handleTransactionId()` for transactions
- Use `stripDepth()` for type safety
- Throw `InvalidArgumentError` for validation
- Return `UnknownError` as fallback

### 2. API Layer

**File**: `api/{module}-management.ts`

**Pattern**:
```typescript
import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { tryCreate{Module}, tryUpdate{Module}, /* ... */ } from "../services/{module}-management";
import type { OrpcContext } from "../../../orpc/context";

// 1. Define Zod schemas
const createSchema = z.object({
  data: z.object({
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    createdBy: z.coerce.number().int().min(1),
  }),
});

// 2. Create ORPC endpoints
export const create{Module} = os
  .$context<OrpcContext>()
  .route({ method: "POST", path: "/{modules}" })
  .input(createSchema)
  .output(z.any())
  .handler(async ({ input, context }) => {
    const result = await tryCreate{Module}({
      payload: context.payload,
      ...input,
      req: context.req,
      overrideAccess: false,  // Always false for API endpoints
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

**Key Points**:
- Use Zod schemas for validation
- Set `overrideAccess: false` for API endpoints
- Wrap service results in ORPCError
- Use `z.coerce.number()` for ID parameters

### 3. Seeding Layer

**File**: `seeding/{module}-seed-schema.ts`

```typescript
import { z } from "zod";

export const {module}SeedInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  content: z.string().optional(),
  userEmail: z.string().email(),  // Note: z.string().email() not z.email()
});

export const {module}SeedDataSchema = z.object({
  {modules}: z.array({module}SeedInputSchema),
});

export type {Module}SeedInput = z.infer<typeof {module}SeedInputSchema>;
export type {Module}SeedData = z.infer<typeof {module}SeedDataSchema>;
```

**File**: `seeding/{module}-builder.ts`

```typescript
import type { {Module} } from "payload-types";
import type { User } from "payload-types";
import { SeedBuilder, type SeedContext } from "shared/seed-builder";
import { UnknownError } from "../../../errors";
import type { BaseInternalFunctionArgs } from "shared/internal-function-utils";
import { tryCreate{Module} } from "../services/{module}-management";
import type { {Module}SeedData } from "./{module}-seed-schema";

export interface TrySeed{Modules}Args extends BaseInternalFunctionArgs {
  data: {Module}SeedData;
  usersByEmail: Map<string, User>;
}

export interface Seed{Modules}Result {
  {modules}: {Module}[];
}

class {Modules}SeedBuilder extends SeedBuilder<{Module}SeedData["{modules}"][number], {Module}> {
  readonly entityName = "{module}";
  private usersByEmail: Map<string, User>;

  constructor(usersByEmail: Map<string, User>) {
    super();
    this.usersByEmail = usersByEmail;
  }

  protected async seedEntities(
    inputs: {Module}SeedData["{modules}"][number][],
    context: SeedContext,
  ): Promise<{Module}[]> {
    const result: {Module}[] = [];

    for (const input of inputs) {
      const user = this.usersByEmail.get(input.userEmail);
      if (!user) {
        throw new UnknownError(
          `User not found for email: ${input.userEmail}. Seed users first.`
        );
      }

      const entity = await tryCreate{Module}({
        payload: context.payload,
        data: {
          title: input.title,
          description: input.description,
          createdBy: user.id,
        },
        req: context.req,
        overrideAccess: context.overrideAccess,
      }).getOrThrow();

      result.push(entity);
    }

    return result;
  }
}

export function trySeed{Modules}(args: TrySeed{Modules}Args) {
  const builder = new {Modules}SeedBuilder(args.usersByEmail);

  return builder
    .trySeed({
      payload: args.payload,
      req: args.req,
      overrideAccess: args.overrideAccess,
      data: { inputs: args.data.{modules} },
    })
    .map(({modules}) => ({ {modules} }));
}
```

**Key Points**:
- Extend `SeedBuilder<InputType, EntityType>`
- Use `userEmail` for user resolution
- Implement `seedEntities()` method
- Use service functions for creation
- Map result to expected structure

### 4. Test Layer

**File**: `tests/{module}-management.test.ts`

**Pattern**:
```typescript
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getPayload } from "payload";
import { tryCreate{Module}, tryUpdate{Module}, /* ... */ } from "../services/{module}-management";
import { trySeedUsers } from "../../user/seeding/users-builder";
import { trySeedMedia } from "../../user/seeding/media-builder";

describe("{Module} Management Functions", async () => {
  const payload = await getPayload({
    key: `test-${Math.random().toString(36).substring(2, 15)}`,
    config: sanitizedConfig,
  });
  
  let testUser: { id: number };
  
  beforeAll(async () => {
    await payload.db.migrateFresh({ forceAcceptWarning: true });
    
    const usersResult = await trySeedUsers({
      payload,
      data: testUserSeedData,
      overrideAccess: true,
      req: undefined,
    }).getOrThrow();
    
    testUser = usersResult.byEmail.get("test@example.com")!.user;
  });
  
  afterAll(async () => {
    await payload.db.migrateFresh({ forceAcceptWarning: true });
  });
  
  // Tests for each CRUD function
  describe("tryCreate{Module}", () => {
    test("should create successfully", async () => {
      const result = await tryCreate{Module}({
        payload,
        data: { title: "Test", createdBy: testUser.id },
        overrideAccess: true,
        req: undefined,
      });
      
      expect(result.ok).toBe(true);
    });
  });
});
```

**Required Test Categories**:
1. CRUD operations (success and failure cases)
2. Validation (empty values, max lengths, whitespace)
3. Pagination and filtering
4. Access control (with and without `overrideAccess`)
5. Non-existent resources
6. Foreign key constraints

### 5. Module Index

**File**: `index.ts`

```typescript
import { {Modules} } from "server/collections";
import { Payload } from "payload";
import {
  Create{Module}Args,
  tryCreate{Module},
  tryUpdate{Module},
  // ... all service functions
} from "./services/{module}-management";
import {
  create{Module},
  update{Module},
  // ... all API endpoints
} from "./api/{module}-management";

export class {Module}Module {
  private readonly payload: Payload;
  
  public static readonly collections = [{Modules}];
  public static readonly api = {
    create{Module},
    update{Module},
    // ... all endpoints
  };
  
  constructor(payload: Payload) {
    this.payload = payload;
  }
  
  create{Module}(args: Omit<Create{Module}Args, "payload">) {
    return tryCreate{Module}({ payload: this.payload, ...args });
  }
  
  // ... instance methods for all services
}
```

## Common Gotchas

### 1. Zod Email Validation
❌ Wrong: `z.email()`  
✅ Correct: `z.string().email()`

### 2. Type Assertions for Create/Update
```typescript
data: { title, description, createdBy } as any  // Required for new fields
```

Payload types may not include newly added fields until type generation runs.

### 3. Depth Handling
- Create/Update: `depth: 0` with `stripDepth<0>()`
- Find: `depth: 1` with `stripDepth<1>()`
- Use type assertion `as any` for test assertions

### 4. Access Control in Tests
- Service functions: `overrideAccess: true` for setup
- API tests: `overrideAccess: false` to test auth

### 5. Transaction Handling
Always use `handleTransactionId()` and `transactionInfo.tx()` for create/update operations.

## Validation Checklist

Before considering module complete, verify:

- [ ] All CRUD functions implemented with Result types
- [ ] Zod schemas use correct syntax (`z.string().email()`)
- [ ] Type assertions for create/update operations
- [ ] Transaction handling in create/update
- [ ] ORPC endpoints with error wrapping
- [ ] SeedBuilder extends base class correctly
- [ ] Seeder uses `userEmail` for resolution
- [ ] Tests cover success, failure, validation, access control
- [ ] Module index exposes all services and API
- [ ] Tests pass (CRUD, seeder, OpenAPI)
- [ ] No TypeScript errors

## References

- SeedBuilder Pattern: `.agents/skills/seed-builder-pattern/SKILL.md`
- Payload Skills: `.agents/skills/payload/SKILL.md`
- Rich text with base64: `.cursor/skills/richtext-content-with-hook/SKILL.md` (for description/content fields)
- Module-to-Package Refactoring: `.cursor/skills/module-package-refactoring/SKILL.md` (when extracting to standalone package)
- Example: `packages/paideia-backend/src/modules/note/`
- Example: `packages/paideia-backend/src/modules/pages/`
- Standalone packages: `packages/module-user/`, `packages/module-infrastructure/`
