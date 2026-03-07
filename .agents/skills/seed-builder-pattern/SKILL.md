---
name: seed-builder-pattern
description: Create database seed builders using the SeedBuilder abstract class. Use when implementing new seed data fixtures, refactoring existing seed logic, or when you need to populate test data with transactions and error handling.
---

# SeedBuilder Pattern Guide

**Quick Win Abstraction**: Eliminate boilerplate in database seeding with consistent transaction handling and error wrapping.

---

## When to Use

Use this pattern when:
- Creating new seed data builders (e.g., `courses-builder`, `quizzes-builder`)
- Refactoring existing seed logic to reduce duplication
- Need transaction-safe seeding with proper error handling
- Building test data fixtures

---

## Core Pattern

### Base Class: `SeedBuilder<TInput, TEntity>`

**What it provides**:
- ✅ Automatic transaction handling via `handleTransactionId()`
- ✅ Consistent error transformation with `Result.try()`
- ✅ Default `overrideAccess = true`
- ✅ Iteration over inputs

**What YOU implement**:
- `entityName` - String identifier for error messages
- `seedEntities(inputs, context)` - Domain logic for creating entities

---

## Quick Start

### 1. Define Input/Output Types

```typescript
interface CourseInput {
  title: string;
  instructorEmail: string;
}

interface CourseSeedData {
  courses: CourseInput[];
}
```

### 2. Create Builder Class

```typescript
import { SeedBuilder, type SeedContext } from "../../../shared/seed-builder";
import type { BaseInternalFunctionArgs } from "shared/internal-function-utils";
import { UnknownError } from "../../../errors";

class CoursesSeedBuilder extends SeedBuilder<CourseInput, Course> {
  readonly entityName = "course";
  
  constructor(private usersByEmail: Map<string, User>) {
    super();
  }
  
  protected async seedEntities(
    inputs: CourseInput[],
    context: SeedContext,
  ): Promise<Course[]> {
    const courses: Course[] = [];
    
    for (const input of inputs) {
      const instructor = this.usersByEmail.get(input.instructorEmail);
      if (!instructor) {
        throw new UnknownError(
          `Instructor not found: ${input.instructorEmail}. Seed users first.`
        );
      }
      
      const course = await context.payload.create({
        collection: "courses",
        data: {
          title: input.title,
          instructor: instructor.id,
        },
        req: context.req,
        overrideAccess: context.overrideAccess,
      });
      
      courses.push(course);
    }
    
    return courses;
  }
}
```

### 3. Export Function (Backward Compatible)

```typescript
export interface TrySeedCoursesArgs extends BaseInternalFunctionArgs {
  data: CourseSeedData;
  usersByEmail: Map<string, User>;
}

export interface SeedCoursesResult {
  courses: Course[];
}

export function trySeedCourses(args: TrySeedCoursesArgs) {
  const builder = new CoursesSeedBuilder(args.usersByEmail);
  
  return builder
    .trySeed({
      payload: args.payload,
      req: args.req,
      overrideAccess: args.overrideAccess,
      data: { inputs: args.data.courses },
    })
    .map(courses => ({ courses }));
}
```

---

## SeedContext Interface

```typescript
interface SeedContext {
  payload: BasePayload;
  req: Partial<PayloadRequest>;  // Transaction-aware request
  overrideAccess: boolean;
}
```

**Key points**:
- `req` is the transaction-aware request from `handleTransactionId()`
- All Payload operations should use `context.req` and `context.overrideAccess`
- Don't use `args.req` directly - use `context.req`

---

## Real Examples in Codebase

### 1. NotesSeedBuilder (Simplest)

**File**: `packages/paideia-backend/src/modules/note/seeding/notes-builder.ts`

**Pattern**: Basic entity creation with user lookup

```typescript
class NotesSeedBuilder extends SeedBuilder<NoteInput, Note> {
  protected async seedEntities(inputs, context) {
    for (const input of inputs) {
      const user = this.usersByEmail.get(input.userEmail);
      if (!user) throw new UnknownError(`User not found: ${input.userEmail}`);
      
      const note = await tryCreateNote({
        ...context,
        data: { content: input.content, createdBy: user.id }
      }).getOrThrow();
      
      result.push(note);
    }
    return result;
  }
}
```

### 2. MediaSeedBuilder (File Handling + Custom Result)

**File**: `packages/paideia-backend/src/modules/user/seeding/media-builder.ts`

**Pattern**: File loading + custom result structure

```typescript
class MediaSeedBuilder extends SeedBuilder<MediaInput, Media> {
  protected async seedEntities(inputs, context) {
    for (const input of inputs) {
      const fileBuffer = await getFileBuffer(input.filePath);
      if (!fileBuffer) throw new UnknownError(`File not found: ${input.filePath}`);
      
      const result = await tryCreateMedia({
        ...context,
        file: fileBuffer,
        filename: input.filename,
      }).getOrThrow();
      
      media.push(result.media);
    }
    return media;
  }
}

// Custom result transformation in export function
export function trySeedMedia(args) {
  return builder.trySeed(...)
    .map(media => {
      const byFilename = new Map(media.map(m => [m.filename, m]));
      const getByFilename = (filename) => {
        const m = byFilename.get(filename);
        if (!m) throw new UnknownError(`Media not found: ${filename}`);
        return m;
      };
      return { media, byFilename, getByFilename };
    });
}
```

### 3. UsersSeedBuilder (Complex Logic)

**File**: `packages/paideia-backend/src/modules/user/seeding/users-builder.ts`

**Pattern**: First-user special logic, DB emptiness check, API key generation

```typescript
class UsersSeedBuilder extends SeedBuilder<UserInput, SeedUserEntry> {
  private dbIsEmpty?: boolean;
  
  protected async seedEntities(inputs, context) {
    // Check DB state
    const existingUsers = await context.payload.find({
      collection: "users",
      limit: 1,
      overrideAccess: true,
      req: context.req,
    });
    this.dbIsEmpty = existingUsers.docs.length === 0;
    
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!;
      
      // First user + DB empty + admin = register first user
      if (i === 0 && this.dbIsEmpty && input.role === "admin") {
        const result = await tryRegisterFirstUser({...context, ...input}).getOrThrow();
        // ... handle API key, token
        continue;
      }
      
      // Regular user creation
      const user = await tryCreateUser({...context, data: input}).getOrThrow();
      // ... update verified, generate API key, login
    }
    
    return result;
  }
}
```

### 4. CoursesSeedBuilder (External ID Resolution)

**File**: `packages/paideia-backend/src/modules/courses/seeding/courses-builder.ts`

**Pattern**: User-friendly email inputs → ID resolution via map

```typescript
class CoursesSeedBuilder extends SeedBuilder<CourseInput, Course> {
  readonly entityName = "course";
  private usersByEmail: Map<string, User>;
  
  constructor(usersByEmail: Map<string, User>) {
    super();
    this.usersByEmail = usersByEmail;
  }
  
  protected async seedEntities(inputs, context) {
    const courses: Course[] = [];
    
    for (const input of inputs) {
      // Resolve email to user ID
      const user = this.usersByEmail.get(input.createdByEmail);
      if (!user) {
        throw new UnknownError(
          `User not found: ${input.createdByEmail}. Seed users first.`
        );
      }
      
      // Use service function (with type cast if needed)
      const course = (await tryCreateCourse({
        payload: context.payload,
        data: {
          title: input.title,
          slug: input.slug,
          description: input.description,
          status: input.status,
          createdBy: user.id,
          thumbnail: input.thumbnailFilename 
            ? this.mediaByFilename?.get(input.thumbnailFilename)?.id 
            : undefined,
        },
        req: context.req,
        overrideAccess: context.overrideAccess,
      }).getOrThrow()) as unknown as Course;
      
      courses.push(course);
    }
    return courses;
  }
}

// Export with result transformation
export function trySeedCourses(args) {
  return builder.trySeed({...})
    .map(courses => {
      const coursesBySlug = new Map(courses.map(c => [c.slug, c]));
      return {
        courses,
        coursesBySlug,
        getCourseBySlug: (slug) => coursesBySlug.get(slug),
      };
    });
}
```

### 5. CourseSectionsSeedBuilder (Hierarchical References)

**File**: `packages/paideia-backend/src/modules/courses/seeding/course-sections-builder.ts`

**Pattern**: Parent-child relationships via title references

```typescript
class CourseSectionsSeedBuilder extends SeedBuilder<SectionInput, CourseSection> {
  readonly entityName = "course-section";
  private coursesBySlug: Map<string, Course>;
  
  protected async seedEntities(inputs, context) {
    const sections: CourseSection[] = [];
    const sectionsByTitle = new Map<string, CourseSection>();
    
    for (const input of inputs) {
      // Resolve course slug to ID
      const course = this.coursesBySlug.get(input.courseSlug);
      if (!course) {
        throw new UnknownError(
          `Course not found: ${input.courseSlug}. Seed courses first.`
        );
      }
      
      // Resolve parent section by title (built incrementally)
      const parentSection = input.parentSectionTitle
        ? sectionsByTitle.get(input.parentSectionTitle)?.id
        : undefined;
      
      const section = (await tryCreateSection({
        ...context,
        data: {
          course: course.id,
          title: input.title,
          description: input.description,
          parentSection,
          contentOrder: input.contentOrder,
        }
      }).getOrThrow()) as unknown as CourseSection;
      
      sections.push(section);
      sectionsByTitle.set(input.title, section);  // Store for child reference
    }
    return sections;
  }
}
```

---

## Common Patterns

### Dependency Injection

Pass dependencies via constructor:

```typescript
constructor(
  private usersByEmail: Map<string, User>,
  private mediaByFilename: Map<string, Media>,
) {
  super();
}
```

### Error Handling

Use `UnknownError` for seed-specific errors:

```typescript
if (!entity) {
  throw new UnknownError(
    `Entity not found: ${key}. Seed dependencies first.`
  );
}
```

### Custom Result Transformation

Transform array result in export function:

```typescript
export function trySeedX(args) {
  return builder.trySeed(...)
    .map(entities => {
      // Build custom result structure
      const byKey = new Map(entities.map(e => [getKey(e), e]));
      const getByKey = (key) => {
        const e = byKey.get(key);
        if (!e) throw new UnknownError(`Entity not found: ${key}`);
        return e;
      };
      return { entities, byKey, getByKey };
    });
}
```

### Type Incompatibility Workaround

Sometimes Payload service return types don't match exactly (e.g., join fields). Use `as unknown as` cast:

```typescript
const course = (await tryCreateCourse({
  ...context,
  data: { ... }
}).getOrThrow()) as unknown as Course;
```

This is acceptable because the runtime data is correct; the mismatch is due to join field population differences.
```

---

## Best Practices

### ✅ DO

- Keep `seedEntities()` focused on creation logic only
- Use `context.req` for all Payload operations
- Throw `UnknownError` with helpful messages
- Preserve backward-compatible function signatures
- Transform results in export function, not in `seedEntities()`

### ❌ DON'T

- Don't call `handleTransactionId()` yourself (base class handles it)
- Don't wrap in `Result.try()` (base class handles it)
- Don't transform error (base class handles it)
- Don't use `args.req` directly (use `context.req`)
- Don't change existing result interfaces (breaking change)

---

## Migration Checklist

When migrating existing seeders:

- [ ] Create class extending `SeedBuilder<TInput, TEntity>`
- [ ] Move creation loop to `seedEntities()`
- [ ] Replace `args.req` with `context.req`
- [ ] Replace `args.overrideAccess` with `context.overrideAccess`
- [ ] Keep existing export function for backward compatibility
- [ ] Transform `args.data.{entities}` to `{ inputs: args.data.{entities} }`
- [ ] Map result to preserve result structure
- [ ] Test that existing consumers still work

---

## Type Safety

### Generic Parameters

```typescript
class MySeedBuilder extends SeedBuilder<
  MyInput,        // Type of individual input
  MyEntity        // Type of created entity
>
```

### For Complex Results

If you need metadata (tokens, API keys):

```typescript
interface MyEntityEntry {
  entity: MyEntity;
  token?: string;
  metadata?: Record<string, unknown>;
}

class MySeedBuilder extends SeedBuilder<MyInput, MyEntityEntry> {
  protected async seedEntities(inputs, context) {
    // Return entries with metadata
    return entries;
  }
}
```

---

## Testing

Seed builders work with Payload's transaction system:

```typescript
const result = await trySeedCourses({
  payload,
  req,  // Can be undefined - transaction created automatically
  data: { courses: [...] },
  usersByEmail: userMap,
}).getOrThrow();

// On error, transaction rolls back
// On success, transaction commits
```

---

## References

- Base class: `packages/paideia-backend/src/shared/seed-builder.ts`
- Examples: 
  - `packages/paideia-backend/src/modules/note/seeding/notes-builder.ts`
  - `packages/paideia-backend/src/modules/user/seeding/media-builder.ts`
  - `packages/paideia-backend/src/modules/user/seeding/users-builder.ts`
  - `packages/paideia-backend/src/modules/courses/seeding/courses-builder.ts`
  - `packages/paideia-backend/src/modules/courses/seeding/course-sections-builder.ts`
- Related: `packages/paideia-backend/src/shared/internal-function-utils.ts` (BaseInternalFunctionArgs)
- Related: `packages/paideia-backend/src/shared/handle-transaction-id.ts` (Transaction handling)
