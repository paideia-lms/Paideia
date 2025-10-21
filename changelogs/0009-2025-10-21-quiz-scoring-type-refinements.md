# Changelog 0009 - Quiz Scoring Type Refinements

**Date:** 2025-10-21  
**Type:** Type System Enhancement  
**Status:** Completed

## Summary

Refined quiz scoring configuration types to use proper discriminated unions instead of interfaces with optional fields. This ensures type safety by making certain fields required or forbidden based on the scoring mode, preventing invalid configurations and providing better IDE support.

## Changes Made

### Type System Updates

#### 1. Refined WeightedScoring Type (`app/components/activity-modules-preview/quiz-config.types.ts`)

**Before:**
```typescript
export interface WeightedScoring {
    type: "weighted";
    maxPoints: number;
    mode: "all-or-nothing" | "partial-with-penalty" | "partial-no-penalty";
    pointsPerCorrect?: number;
    penaltyPerIncorrect?: number;
}
```

**After:**
```typescript
export type WeightedScoring =
    | {
        type: "weighted";
        mode: "all-or-nothing";
        maxPoints: number;
    }
    | {
        type: "weighted";
        mode: "partial-with-penalty";
        maxPoints: number;
        pointsPerCorrect: number;
        penaltyPerIncorrect: number;
    }
    | {
        type: "weighted";
        mode: "partial-no-penalty";
        maxPoints: number;
        pointsPerCorrect: number;
    };
```

**Changes:**
- Converted from interface to discriminated union with 3 variants
- `all-or-nothing` mode: Only requires `maxPoints`
- `partial-with-penalty` mode: Requires `pointsPerCorrect` and `penaltyPerIncorrect`
- `partial-no-penalty` mode: Requires `pointsPerCorrect` only

**Benefits:**
- TypeScript enforces correct field presence based on mode
- Cannot create invalid configurations (e.g., `pointsPerCorrect` with "all-or-nothing")
- Better IntelliSense in IDEs - only shows valid fields for selected mode

#### 2. Refined RankingScoring Type (`app/components/activity-modules-preview/quiz-config.types.ts`)

**Before:**
```typescript
export interface RankingScoring {
    type: "ranking";
    maxPoints: number;
    mode: "exact-order" | "partial-order";
    pointsPerCorrectPosition?: number;
}
```

**After:**
```typescript
export type RankingScoring =
    | {
        type: "ranking";
        mode: "exact-order";
        maxPoints: number;
    }
    | {
        type: "ranking";
        mode: "partial-order";
        maxPoints: number;
        pointsPerCorrectPosition: number;
    };
```

**Changes:**
- Converted from interface to discriminated union with 2 variants
- `exact-order` mode: All-or-nothing scoring, only requires `maxPoints`
- `partial-order` mode: Partial credit per position, requires `pointsPerCorrectPosition`

**Benefits:**
- `pointsPerCorrectPosition` is now required for "partial-order" mode
- Cannot accidentally omit required field
- Type system prevents unnecessary fields

#### 3. Updated Helper Functions

**getScoringDescription:**
- Removed optional chaining (`??`) operators
- All field accesses are now guaranteed to be present based on discriminated union
- More confident type narrowing in switch statements

**Example:**
```typescript
// Before
if (scoring.mode === "partial-with-penalty") {
    return `Up to ${scoring.maxPoints} points (${scoring.pointsPerCorrect ?? 1} per correct, -${scoring.penaltyPerIncorrect ?? 1} per incorrect)`;
}

// After
if (scoring.mode === "partial-with-penalty") {
    return `Up to ${scoring.maxPoints} points (${scoring.pointsPerCorrect} per correct, -${scoring.penaltyPerIncorrect} per incorrect)`;
}
```

## Migration Notes

### For Existing Configurations

All existing quiz configurations already comply with the new types. No migration needed.

### For New Configurations

When creating scoring configurations:

**WeightedScoring:**
```typescript
// All-or-nothing
{ type: "weighted", mode: "all-or-nothing", maxPoints: 10 }

// Partial with penalty
{ 
    type: "weighted", 
    mode: "partial-with-penalty", 
    maxPoints: 6,
    pointsPerCorrect: 2,
    penaltyPerIncorrect: 1
}

// Partial without penalty
{ 
    type: "weighted", 
    mode: "partial-no-penalty", 
    maxPoints: 4,
    pointsPerCorrect: 2
}
```

**RankingScoring:**
```typescript
// Exact order required
{ type: "ranking", mode: "exact-order", maxPoints: 4 }

// Partial credit per position
{ 
    type: "ranking", 
    mode: "partial-order", 
    maxPoints: 4,
    pointsPerCorrectPosition: 1
}
```

## Type Safety Improvements

### Compile-Time Validation

TypeScript now catches these errors at compile time:

```typescript
// ❌ Error: Property 'pointsPerCorrect' is missing
const config: WeightedScoring = {
    type: "weighted",
    mode: "partial-with-penalty",
    maxPoints: 10,
    penaltyPerIncorrect: 1
};

// ❌ Error: Property 'pointsPerCorrect' does not exist on type
const config: WeightedScoring = {
    type: "weighted",
    mode: "all-or-nothing",
    maxPoints: 10,
    pointsPerCorrect: 2  // Unnecessary field
};

// ✅ Correct
const config: WeightedScoring = {
    type: "weighted",
    mode: "partial-with-penalty",
    maxPoints: 10,
    pointsPerCorrect: 2,
    penaltyPerIncorrect: 1
};
```

### IntelliSense Improvements

IDEs now provide:
- Context-aware field suggestions based on selected mode
- Immediate error highlighting for missing required fields
- Automatic field completion for the selected variant

## Testing

- ✅ No linter errors in affected files
- ✅ All existing sample configurations remain valid
- ✅ Type narrowing works correctly in helper functions
- ✅ IDE IntelliSense provides correct suggestions

## Related Files

- `app/components/activity-modules-preview/quiz-config.types.ts` - Core type definitions
- `app/components/activity-modules-preview/quiz-preview.tsx` - Sample configurations
- `app/components/activity-module-forms/index.ts` - Type exports

## Related Changelogs

- [0007 - Quiz Preview Component](./0007-2025-10-21-quiz-preview-component.md) - Initial quiz system
- [0008 - Nested Quiz Support](./0008-2025-10-21-nested-quiz-support.md) - Nested quiz feature with grading

## Future Considerations

### Other Scoring Types to Refine

Similar refinements could be applied to:

1. **MatrixScoring** - Could split into variants based on mode:
   ```typescript
   export type MatrixScoring =
       | { type: "matrix"; mode: "all-or-nothing"; maxPoints: number; pointsPerRow: number; }
       | { type: "matrix"; mode: "partial"; maxPoints: number; pointsPerRow: number; };
   ```

2. **PartialMatchScoring** - Could have variants for case-sensitive vs case-insensitive with different defaults

### Additional Type Guards

Could add type guards for narrowing within scoring types:
```typescript
function isWeightedAllOrNothing(scoring: WeightedScoring): scoring is Extract<WeightedScoring, { mode: "all-or-nothing" }> {
    return scoring.mode === "all-or-nothing";
}
```

## Conclusion

These refinements significantly improve the type safety and developer experience of the quiz scoring system. The discriminated union pattern ensures that configurations are always valid at compile time, reducing runtime errors and improving code maintainability.

