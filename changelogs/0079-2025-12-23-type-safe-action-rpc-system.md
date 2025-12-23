# Type-Safe Action RPC System

**Date:** December 23, 2025  
**Type:** Infrastructure & Developer Experience  
**Impact:** High - Provides type-safe, end-to-end action handling for React Router with automatic validation, FormData serialization, and client hooks

## Overview

This changelog documents the implementation of a type-safe RPC-like system for React Router actions (`typeCreateActionRpc`) that provides end-to-end type safety from server actions to client hooks. The system includes automatic form data validation using Zod schemas, search params parsing, method validation, and a custom `MyFormData` class that handles complex nested objects, Blobs, and null values.

## Features Added

### 1. Type-Safe Action RPC Factory

**Features**:
- End-to-end type safety from server action to client hook
- Automatic form data validation using Zod schemas
- Search params parsing and validation using nuqs
- HTTP method validation (POST, GET, PATCH, PUT, DELETE)
- Action-based routing via search params
- Type-safe client hooks with submit functions

**Implementation**:
- Created `typeCreateActionRpc<T>()` function in `app/utils/action-utils.ts`
- Returns a factory function that creates action RPCs with configurable options
- Supports optional form data schema, method, search params, and action parameter
- Returns a tuple `[action, hook]` where:
  - `action`: Server-only function that validates and processes requests
  - `hook`: React hook that provides `submit`, `isLoading`, `data`, and `fetcher`

**Configuration Options**:
```typescript
{
  formDataSchema?: z.ZodTypeAny;      // Zod schema for form data validation
  method?: "POST" | "GET" | "PATCH" | "PUT" | "DELETE";  // HTTP method
  searchParams?: ParserMap;            // nuqs parser map for search params
  action?: string;                     // Action identifier (shortcut for search params)
}
```

**Benefits**:
- ✅ Type-safe: Full TypeScript inference from schema to hook
- ✅ Validated: Automatic validation of form data, params, and method
- ✅ Flexible: Supports optional form data, search params, and action routing
- ✅ Consistent: Standardized pattern for all route actions

### 2. MyFormData Class

**Features**:
- Custom FormData implementation that handles complex nested objects
- Automatic serialization of objects to JSON
- Blob extraction and reference system
- Null value preservation
- Deep object traversal for nested structures
- Automatic blob restoration on server side

**Implementation**:
- `MyFormData<T>` extends native `FormData` class
- Constructor accepts a typed object and converts it to FormData
- Extracts Blobs from nested structures and stores them separately with unique references
- Replaces Blobs in object tree with reference strings
- Serializes the cleaned object to JSON for FormData storage
- `convertMyFormDataToObject()` restores the original structure on server side
- Handles explicit null values using `NULL_MARKER`

**Blob Reference System**:
- Uses unique reference IDs with prefix `\0__BLOB_REF__:`
- Blobs stored at root level of FormData with reference IDs as keys
- Object structure stored as JSON with blob references as strings
- Server-side restoration matches references back to actual Blobs
- Handles various edge cases (escaped nulls, normalized keys, etc.)

**Benefits**:
- ✅ Complex data: Supports nested objects, arrays, and Blobs
- ✅ Type-safe: Maintains type information through serialization
- ✅ Efficient: Blobs stored once, referenced in structure
- ✅ Robust: Handles edge cases and normalization issues

### 3. Automatic Validation System

**Features**:
- Form data validation using Zod schemas
- Route params validation using predefined schema
- HTTP method validation
- Search params parsing and validation using nuqs
- Clear error messages with prettified Zod errors

**Implementation**:
- Form data parsed from `MyFormData` and validated against provided Zod schema
- Route params validated against `paramsSchema` for type safety
- HTTP method checked against configured method (defaults to POST)
- Search params parsed using nuqs `createLoader` if provided
- Validation errors return `badRequest` response with prettified error messages

**Validation Flow**:
1. Check HTTP method matches configured method
2. Validate all route params against schema
3. Parse search params if schema provided
4. Parse and validate form data if schema provided
5. Execute action function with validated and typed data

**Benefits**:
- ✅ Early validation: Catches errors before business logic execution
- ✅ Type-safe: TypeScript ensures schema matches usage
- ✅ Clear errors: Prettified Zod errors for better debugging
- ✅ Consistent: Same validation pattern across all actions

### 4. Action-Based Routing

**Features**:
- Action parameter shortcut for search params
- Automatic action merging with search params
- Type-safe action routing in client hooks
- URL generation via action function

**Implementation**:
- `action` parameter is a shortcut for `{ action: parseAsStringEnum([action]).withDefault(action) }`
- Merged with `searchParams` if both provided
- Action value automatically included in search params when submitting
- Client hook `submit` function accepts optional `searchParams` that merge with action
- Action URL generated via `options.action()` function

**Usage Pattern**:
```typescript
const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createDeleteActionRpc = createActionRpc({
  formDataSchema: z.object({ id: z.coerce.number() }),
  method: "POST",
  action: Action.Delete,  // Shortcut for action in search params
});

const [deleteAction, useDelete] = createDeleteActionRpc(
  serverOnly$(async ({ formData }) => {
    // formData is typed from schema
    // ...
  })!,
  {
    action: ({ params, searchParams }) => 
      getRouteUrl({ action: searchParams.action }, params.id),
  },
);
```

**Benefits**:
- ✅ Convenient: Action parameter simplifies common pattern
- ✅ Type-safe: Action value is part of search params type
- ✅ Flexible: Can combine with other search params
- ✅ Consistent: Standard pattern for action routing

### 5. Client Hook System

**Features**:
- React hook that provides submit function
- Loading state tracking
- Access to fetcher data
- Type-safe submit function with optional parameters
- Automatic FormData conversion using MyFormData

**Implementation**:
- Hook uses `useFetcher<ReturnType<A>>()` from React Router
- `submit` function accepts optional `values`, `searchParams`, and `params`
- Automatically converts values to `MyFormData` for submission
- Sets correct HTTP method and content type
- Returns `{ submit, isLoading, data, fetcher }`

**Hook Return Type**:
```typescript
{
  submit: (args?: {
    values?: z.infer<FormDataSchema>;
    searchParams?: OtherSearchParams;
    params?: Params;
  }) => Promise<void>;
  isLoading: boolean;
  data: ReturnType<A> | undefined;
  fetcher: FetcherWithComponents<ReturnType<A>>;
}
```

**Benefits**:
- ✅ Type-safe: Submit function types inferred from schema
- ✅ Convenient: Loading state and data automatically available
- ✅ Flexible: Optional parameters for values, search params, and params
- ✅ Consistent: Same pattern across all actions

### 6. Type System Architecture

**Features**:
- Complex type inference for form data, search params, and params
- Preserves optional params based on route definition
- Union to intersection type transformations
- Conditional types for optional properties
- Type-safe discriminated unions

**Implementation**:
- `PreserveOptionalParams<T>` preserves optional route params
- `OptionalIfEmpty<T, Key>` makes properties optional if type is empty
- `SearchParamsType` computed from action and search params schemas
- `ArgsWithFormData` conditionally includes form data type
- Full type inference from configuration to hook return type

**Type Flow**:
1. Route `ActionArgs` type provides base context
2. Form data schema infers `FormDataSchema` type
3. Search params schema infers `SearchParamsType`
4. Action parameter merges with search params type
5. Server action receives fully typed args
6. Client hook receives typed submit function

**Benefits**:
- ✅ Full type safety: No `any` types, all inferred
- ✅ IntelliSense: Autocomplete for all parameters
- ✅ Compile-time errors: Catches type mismatches early
- ✅ Self-documenting: Types serve as documentation

## Technical Details

### FormData Serialization Process

1. **Object Traversal**: Recursively traverses input object
2. **Blob Extraction**: Finds all Blob instances and extracts them
3. **Reference Generation**: Creates unique reference IDs for each Blob
4. **Blob Storage**: Stores Blobs at FormData root with reference IDs as keys
5. **Structure Serialization**: Replaces Blobs in object tree with reference strings
6. **JSON Stringification**: Serializes cleaned object to JSON string
7. **FormData Append**: Appends JSON string to FormData with original key

### FormData Deserialization Process

1. **Entry Iteration**: Iterates over all FormData entries
2. **JSON Parsing**: Parses JSON strings back to objects
3. **Null Handling**: Converts `NULL_MARKER` strings back to `null`
4. **Blob Restoration**: Recursively finds blob references and restores Blobs
5. **Type Preservation**: Maintains original structure and types

### Action Execution Flow

1. **Method Validation**: Checks HTTP method matches configuration
2. **Params Validation**: Validates route params against schema
3. **Search Params Parsing**: Parses search params if schema provided
4. **FormData Parsing**: Converts FormData to object using `convertMyFormDataToObject`
5. **FormData Validation**: Validates parsed form data against Zod schema
6. **Action Execution**: Calls action function with validated, typed arguments
7. **Response Return**: Returns action function result

### Client Submission Flow

1. **Hook Call**: Component calls `submit()` with optional values
2. **FormData Creation**: Converts values to `MyFormData` instance
3. **URL Generation**: Generates action URL using `options.action()` function
4. **Fetcher Submit**: Submits FormData using React Router `fetcher.submit()`
5. **Loading State**: Hook automatically tracks loading state
6. **Data Access**: Action response available via `data` property

## Files Changed

### New Files
- `app/utils/action-utils.ts` - Main action RPC system with MyFormData and typeCreateActionRpc

### Modified Files
- All route files using the action RPC system (e.g., `app/routes/course/module.$id.submissions/route.tsx`)

## Usage

### Basic Action RPC

**Server Side**:
```typescript
const createActionRpc = typeCreateActionRpc<Route.ActionArgs>();

const createDeleteActionRpc = createActionRpc({
  formDataSchema: z.object({
    submissionId: z.coerce.number(),
  }),
  method: "POST",
  action: Action.DeleteSubmission,
});

const [deleteAction, useDeleteSubmission] = createDeleteActionRpc(
  serverOnly$(async ({ context, formData, params }) => {
    // formData is typed: { submissionId: number }
    // params is typed from Route.ActionArgs
    // ...
    return ok({ success: true });
  })!,
  {
    action: ({ params, searchParams }) =>
      getRouteUrl(
        { action: searchParams.action },
        Number(params.moduleLinkId),
      ),
  },
);
```

**Client Side**:
```typescript
const { submit, isLoading } = useDeleteSubmission();

// Submit with values
await submit({
  values: { submissionId: 123 },
  params: { moduleLinkId: 456 },
});
```

### Action with Search Params

```typescript
const createReplyActionRpc = createActionRpc({
  formDataSchema: z.object({
    content: z.string().min(1),
    parentThread: z.coerce.number(),
  }),
  method: "POST",
  action: DiscussionActions.REPLY,
  searchParams: {
    replyTo: parseAsStringServer.withDefault("thread"),
  },
});
```

### Action without Form Data

```typescript
const createStartAttemptActionRpc = createActionRpc({
  method: "POST",
  action: QuizActions.START_ATTEMPT,
});
```

### Action with Complex Form Data (Blobs)

```typescript
const createSubmitAssignmentActionRpc = createActionRpc({
  formDataSchema: z.object({
    textContent: z.string().nullish(),
    files: z.file().array(),  // Blobs supported via MyFormData
  }),
  method: "POST",
  action: AssignmentActions.SUBMIT_ASSIGNMENT,
});
```

### Multiple Actions in One Route

```typescript
const actionMap = {
  [Action.DeleteSubmission]: deleteAction,
  [Action.GradeSubmission]: gradeAction,
  [Action.ReleaseGrade]: releaseAction,
};

export const action = async (args: Route.ActionArgs) => {
  const { request } = args;
  const { action: actionType } = loadSearchParams(request);
  
  if (!actionType || !(actionType in actionMap)) {
    return badRequest({ error: "Action is required" });
  }
  
  return actionMap[actionType](args);
};
```

## Impact

### Positive Impacts

- **Type Safety**: End-to-end type safety eliminates runtime type errors
- **Developer Experience**: IntelliSense and autocomplete for all parameters
- **Code Quality**: Automatic validation prevents invalid data from reaching business logic
- **Consistency**: Standardized pattern across all route actions
- **Maintainability**: Centralized action handling logic reduces duplication

### Developer Experience

- **IntelliSense**: Full autocomplete for form data, params, and search params
- **Error Messages**: Clear, prettified validation errors
- **Loading States**: Automatic loading state tracking
- **Type Inference**: No manual type annotations needed
- **Flexibility**: Supports simple and complex use cases

### Performance

- **Efficient Serialization**: Blobs stored once, referenced in structure
- **Parallel Processing**: FormData parsing and validation can be optimized
- **Type Safety**: Compile-time checks prevent runtime errors

## Related Changes

This system builds upon existing infrastructure:
- Uses React Router's `useFetcher` and action system
- Integrates with nuqs for search params parsing
- Uses Zod for form data validation
- Leverages TypeScript's advanced type system
- Works with existing `serverOnly$` macro for server-only code

The action RPC system complements existing patterns:
- **React Router Actions**: Provides type-safe wrapper around native actions
- **Zod Validation**: Integrates Zod schemas for form data validation
- **nuqs**: Uses nuqs parsers for search params
- **Type Safety**: Extends TypeScript's type system for end-to-end safety

