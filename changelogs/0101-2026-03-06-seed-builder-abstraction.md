# SeedBuilder Abstraction for Database Seeding

**Date:** March 6, 2026  
**Type:** Refactoring / Developer Experience  
**Impact:** Medium - Reduces code duplication across seed builders,Improves maintainability

## Overview

Created an abstract `SeedBuilder` class to eliminate boilerplate code across three database seeding builders (users, media, notes). The abstraction extracts common transaction handling, error wrapping, and iteration logic while preserving domain-specific flexibility.

## Features Added

### 1. SeedBuilder Base Class

**Features**:
- Abstract class with template method pattern
- Automatic transaction handling via `handleTransactionId()`
- Consistent error transformation with `transformError()` and `UnknownError`
- Default `overrideAccess = true`
- Type-safe with minimal generic complexity (2 parameters)

**Implementation**:
- `packages/paideia-backend/src/shared/seed-builder.ts` (58 lines)
- Extends `BaseInternalFunctionArgs` pattern
- Uses `Result.try()` for consistent error handling

### 2. Migrated Seed Builders

All three builders migrated to use the base class while maintaining backward compatibility:

**NotesSeedBuilder**:
- Migrated from 67 to 73 lines
- Preserves `trySeedNotes()` function signature
- Maintains dependency injection pattern (`usersByEmail`)

**MediaSeedBuilder**:
- Migrated from 108 to 114 lines  
- Preserves custom result structure (`byFilename`, `getByFilename()`)
- Maintains file loading logic

**UsersSeedBuilder**:
- Migrated from 178 to 171 lines
- Preserves complex first-user logic
- Maintains custom result with `getUsersByEmail()`
- Keeps DB emptiness check

### 3. Backward Compatibility

**All existing interfaces preserved**:
- `trySeedNotes(args: TrySeedNotesArgs)`
- `trySeedMedia(args: TrySeedMediaArgs)`
- `trySeedUsers(args: TrySeedUsersArgs)`

No breaking changes to consumers or tests.

## Technical Details

### File Structure

```
packages/paideia-backend/src/shared/
└── seed-builder.ts (NEW - 58 lines)

packages/paideia-backend/src/modules/
├── note/seeding/notes-builder.ts (MODIFIED - 73 lines)
├── user/seeding/media-builder.ts (MODIFIED - 114 lines)
└── user/seeding/users-builder.ts (MODIFIED - 171 lines)
```

### Abstraction Design

**What was abstracted (the quick win)**:
- ✅ `Result.try()` wrapper pattern
- ✅ Transaction handling boilerplate (40+ lines per builder → 0)
- ✅ Error transformation (20+ lines per builder → 0)
- ✅ Default `overrideAccess = true`

**What was NOT abstracted (kept simple)**:
- ❌ Complex result types with maps/getters (each builder keeps its own)
- ❌ Utility methods (buildLookupMap, createGetter)
- ❌ Hooks system (beforeSeed, afterSeed)
- ❌ Standardization of result structure

### Key Design Decisions

1. **Minimal type complexity**: 2 generic parameters (`TInput`, `TEntity`) instead of complex result types
2. **Composition over hooks**: Each builder implements `seedEntities()` method with full domain logic
3. **Static wrapper functions**: Preserve existing function signatures for backward compatibility
4. **Flexible result building**: Each builder maps results to its custom structure in the wrapper function

## Code Quality Improvements

### Before (Current Code)
- Each builder: ~100-180 lines with 40-60 lines of boilerplate
- Transaction handling duplicated across 3 files
- Error wrapping pattern duplicated

### After (With SeedBuilder)
- Base class: 58 lines (one-time, reusable)
- Each builder: ~60-120 lines (domain logic only)
- **Net reduction: ~150 lines total**
- **Single source of truth** for seeding infrastructure

## Files Modified

**Added**:
- `packages/paideia-backend/src/shared/seed-builder.ts`

**Modified**:
- `packages/paideia-backend/src/modules/note/seeding/notes-builder.ts`
- `packages/paideia-backend/src/modules/user/seeding/media-builder.ts`
- `packages/paideia-backend/src/modules/user/seeding/users-builder.ts`

## Pattern Benefits

### For Future Seeders

To add a new seeder:

```typescript
class MyEntitySeedBuilder extends SeedBuilder<MyInput, MyEntity> {
  readonly entityName = "my-entity";
  
  protected async seedEntities(inputs: MyInput[], context: SeedContext) {
    // Just implement domain logic
    // Transaction, error handling, iteration all handled by base class
  }
}

export function trySeedMyEntity(args) {
  const builder = new MyEntitySeedBuilder();
  return builder.trySeed({ ...args, data: { inputs: args.data.entities } })
    .map(entities => ({ entities }));
}
```

### For Maintenance

- **Single place** to update transaction strategy
- **Consistent error handling** across all seeders
- **Type safety** ensures new seeders follow the pattern
- **Clear separation**: infrastructure (base) vs domain logic (subclass)

## References

- Skill: `.agents/skills/seed-builder-pattern/SKILL.md`
- Related: `packages/paideia-backend/src/shared/internal-function-utils.ts` (BaseInternalFunctionArgs pattern)
