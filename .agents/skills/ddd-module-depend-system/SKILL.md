# DDD Module Dependency System

## Overview

This skill provides guidance for implementing Domain-driven design (DDD) module architecture with clear dependency management, The system is heavily inspired by the blueprint you discussed in the session.

## Key Concepts

1. **PaideiaModuleConstructor Interface**: Defines the contract for all modules must to implement
2. **Dependencies Array**: Explicit declaration of module dependencies
3. **JSDoc Documentation**: Standardized `@upstream` and `@downstream` tags
4. **Topological Sorting**: DAG-based sorting algorithm ensures correct initialization order
5. **Circular Dependency Detection**: Automatic validation prevents circular dependencies

## When to Use this skill

Use this skill when:
- Creating new modules in the DDD architecture
- Refactoring existing modules to implement dependencies
- Debugging module initialization order issues
- Understanding module relationships in the codebase

## Implementation Pattern

### 1. Module Interface (`shared/module-interface.ts`)

```typescript
import type { CollectionConfig, TaskConfig } from "payload";

export interface PaideiaModuleConstructor {
    /** The unique identifier for this module */
    readonly moduleName: string;
    
    /** 
     * Array of moduleNames this module strictly depends on.
     * These dependencies will be initialized/seeded BEFORE this module.
     */
    readonly dependencies: readonly string[];
    
    /** Collections this module provides */
    readonly collections: CollectionConfig[];
    
    /** CLI commands this module provides */
    readonly cli: Record<string, any>;
    
    /** Collections to include in search */
    readonly search: string[];
    
    /** Seed data for this module */
    readonly seedData?: any;
    
    /** Job queues this module provides */
    readonly queues: any[];
    
    /** Background tasks this module provides */
    readonly tasks: TaskConfig[];
    
    /** API endpoints this module provides */
    readonly api?: Record<string, any>;
    
    new (...args: any[]): any;
}

export type PaideiaModule = InstanceType<PaideiaModuleConstructor>;
```

### 2. Topological Sorter (`shared/module-sorter.ts`)

```typescript
import type { PaideiaModuleConstructor } from "./module-interface";

/**
 * Sorts modules in topological order based on dependencies.
 * Throws errors for circular dependencies or missing dependencies.
 * 
 * @param modules - Array of module constructors to * @returns Array of sorted module constructors
 */
export function sortModulesTopologically(modules: PaideiaModuleConstructor[]): PaideiaModuleConstructor[] {
    // Implementation uses Kahn's algorithm for    // ... (see file for full implementation)
}
```

### 3. Module Implementation Pattern

```typescript
/**
 * User Module - Root domain module with * 
 * @upstream None. This is a root domain module.
 * @downstream
 * - `note`: Requires User for the `createdBy` field
 * - `courses`: Requires User for course instructors/creators
 * - `pages`: Requires User for page ownership
 */
export class UserModule {
    public static readonly moduleName = "user" as const;
    public static readonly dependencies = [] as const;
    // ... rest of implementation
}
```

```typescript
/**
 * Note Module - Note-taking feature
 * 
 * @upstream
 * - `user`: Required for the `createdBy` relationship
 * @downstream None. Notes are standalone entities
 */
export class NoteModule {
    public static readonly moduleName = "note" as const;
    public static readonly dependencies = ["user"] as const;
    // ... rest of implementation
}
```

### 4. Usage in Configuration Files

```typescript
import { sortModulesTopologically } from "shared/module-sorter";
import { InfrastructureModule } from "modules/infrastructure";
import { UserModule } from "modules/user";
import { NoteModule } from "modules/note";
import { CoursesModule } from "modules/courses";
import { PagesModule } from "modules/pages";

const allModules = sortModulesTopologically([
    InfrastructureModule,
    UserModule,
    NoteModule,
    CoursesModule,
    PagesModule,
]);

console.log("📦 Module initialization order:", allModules.map(m => m.moduleName).join(" → "));

// Use in configuration
const config = buildConfig({
    collections: allModules.flatMap(m => m.collections),
    jobs: {
        autoRun: allModules.flatMap(m => m.queues),
        tasks: allModules.flatMap(m => m.tasks),
    },
    // ... rest of config
});
```

### 5. Dependency Validation

The system automatically validates dependencies at runtime:
- **Missing dependency**: If Module A depends on Module B, but B is not registered, an error is thrown
- **Circular dependency**: If modules form a cycle ( an error is thrown with the unresolved modules listed

## Testing

```bash
bun test src/shared/module-sorter.test.ts
```

## Benefits

1. **Self-documenting**: Dependencies are visible at the top of files
2. **Type-safe**: TypeScript enforces correct dependency declarations
3. **Automatic validation**: No manual ordering needed
4. **Clear error messages**: Specific guidance when dependencies are wrong
5. **AI-friendly**: Standardized JSDoc helps AI agents understand module relationships

## Example: Adding a new Enrolment Module

```typescript
/**
 * Enrolment Module
 * 
 * @upstream
 * - `courses`: Cannot enroll without an existing course
 * - `user`: Enrolments belong to users
 * @downstream
 * - `gradebook`: Gradebooks are bound to course enrolments
 */
export class EnrolmentModule {
    public static readonly moduleName = "enrolment" as const;
    public static readonly dependencies = ["courses", "user"] as const;
    // ... collections, services, API
}
```

## Common Issues

### Issue: TypeScript loses type information in reduce()

**Problem**: When using `reduce()` to merge CLI commands, type inference loses the resulting type becomes `{}`.

**Solution**: Use explicit typing or create typed objects:

```typescript
// Before: Type lost
const cliRouter = allModules.reduce((acc, mod) => ({ ...acc, ...mod.cli }), {});

// After: Explicit typing
import type { InfrastructureModule, from "modules/infrastructure";
import type { UserModule } from "modules/user";
import type { NoteModule } from "modules/note";
import type { CoursesModule } from "modules/courses";
import type { PagesModule } from "modules/pages";

const allModules: PaideiaModuleConstructor[] = [
    InfrastructureModule,
    UserModule,
    NoteModule,
    CoursesModule,
    PagesModule,
];

type CliRouter = typeof allModules[number]['cli'];

const cliRouter: CliRouter = allModules.reduce((acc, mod) => ({ ...acc, ...mod.cli }), {});
```

## Related Files

- `shared/module-interface.ts` - Interface definition
- `shared/module-sorter.ts` - Topological sorting algorithm
- `shared/index.ts` - Public exports
- Module `index.ts` files - Updated with `moduleName` and `dependencies`

## Next Steps

1. Implement remaining modules using this pattern
2. Run `bun test src/shared/module-sorter.test.ts` to. Update `package.json` scripts to use the sorted modules
8. Consider creating a `generate-modules.ts` script for auto-generation

## References

- Original blueprint provided in the session context
- `shared/module-interface.ts`
- `shared/module-sorter.ts`
- Module index files in `user/`, `note/`, `infrastructure/`, `courses/`, `pages/`
