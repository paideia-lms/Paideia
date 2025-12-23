# Media Fields Discovery and Drizzle Mapping

**Date:** December 23, 2025  
**Type:** Infrastructure & Media Management  
**Impact:** High - Enables comprehensive media usage tracking across all collections and globals by automatically discovering media relationship fields and mapping them to database schema

## Overview

This changelog documents the implementation of a utility system (`get-all-media-fields.ts`) that automatically discovers all media relationship fields across Payload CMS collections and globals, and maps them to Drizzle ORM schema references. This system enables comprehensive media usage tracking, allowing the system to find all references to a media file across the entire database schema without manual configuration.

## Features Added

### 1. Recursive Media Fields Discovery

**Features**:
- Recursively traverses field definitions to find all media relationship fields
- Supports nested fields within array field types
- Handles both single and array media relationships
- Processes all collections and globals automatically
- Tracks field path, array status, and nesting level

**Implementation**:
- Created `findMediaFields()` function in `server/internal/utils/get-all-media-fields.ts`
- Recursively traverses field definitions starting from root level
- Identifies relationship fields with `relationTo === "media"` or `relationTo.includes("media")`
- Tracks field paths with dot notation (e.g., `"attachments.file"`)
- Marks fields as arrays when `hasMany === true`
- Marks fields as nested when `parentPath !== ""`
- Handles array field types by recursively checking nested fields

**Field Discovery Process**:
1. Iterate through all fields in a collection/global definition
2. Check if field is a relationship type pointing to "media"
3. Record field path, array status, and nesting level
4. For array fields, recursively check nested fields
5. Build complete path using dot notation for nested fields

**Benefits**:
- ✅ Automatic discovery: No manual configuration needed
- ✅ Comprehensive: Finds all media fields across entire schema
- ✅ Nested support: Handles complex nested structures
- ✅ Future-proof: Automatically includes new media fields as they're added

### 2. Collection and Global Processing

**Features**:
- Processes all Payload collections automatically
- Processes all Payload globals automatically
- Distinguishes between collection and global fields
- Returns unified structure with type information

**Implementation**:
- `getAllMediaFields()` function iterates through `payload.collections`
- Iterates through `payload.globals.config`
- Extracts field definitions from collection/global configs
- Calls `findMediaFields()` for each collection/global
- Returns array with `type: "collection" | "global"` distinction

**Return Structure**:
```typescript
Array<{
  type: "collection" | "global";
  slug: string;
  fieldPath: string;
  isArray: boolean;
  isNested: boolean;
}>
```

**Benefits**:
- ✅ Complete coverage: Processes all collections and globals
- ✅ Type distinction: Knows whether field is from collection or global
- ✅ Unified interface: Same structure for all field types

### 3. Drizzle Schema Mapping

**Features**:
- Maps Payload field paths to Drizzle table and column references
- Handles three field types: direct, array, and nested
- Validates table and field existence in generated schema
- Converts kebab-case slugs to snake_case table names
- Provides complete database reference information

**Implementation**:
- Created `mapMediaFieldsToDrizzle()` function
- Takes discovered media fields and maps to Drizzle schema
- Uses generated schema from `src/payload-generated-schema`
- Validates table existence by checking schema object
- Validates field existence by checking table properties
- Filters out non-existent tables/fields

**Field Type Handling**:

**Direct Fields** (e.g., `users.avatar`):
- Table: `users` (slug converted to snake_case)
- Column: `avatar` (field name as-is)
- Reference: `users.avatar`

**Array Fields** (e.g., `notes.contentMedia`):
- Table: `notes_rels` (slug + `_rels` suffix)
- Column: `mediaID`
- Reference: `notes_rels.mediaID`
- Uses relationship table for many-to-many relationships

**Nested Fields** (e.g., `assignment-submissions.attachments.file`):
- Table: `assignment_submissions_attachments` (slug + parent field)
- Column: `file` (nested field name)
- Reference: `assignment_submissions_attachments.file`
- Handles nested structures within array fields

**Mapping Process**:
1. Convert slug to table name (kebab-case → snake_case)
2. Determine table name based on field type (direct/array/nested)
3. Extract schema field name from field path
4. Check if table exists in generated schema
5. Check if field exists in table
6. Build table and column references
7. Filter out non-existent tables/fields

**Return Structure**:
```typescript
Array<{
  type: "collection" | "global";
  slug: string;
  fieldPath: string;
  tableName: string;
  schemaFieldName: string;
  tableRef: string;
  columnRef: string;
  tableExists: boolean;
  fieldExists: boolean;
  isNested: boolean;
  isArray: boolean;
}>
```

**Benefits**:
- ✅ Database-aware: Maps to actual database schema
- ✅ Type-safe: Validates existence before use
- ✅ Flexible: Handles all field structure types
- ✅ Accurate: Filters out non-existent tables/fields

### 4. Media Usage Tracking Integration

**Features**:
- Enables comprehensive media usage tracking across entire system
- Supports finding all references to a media file
- Handles direct, array, and nested field types
- Generates optimized database queries for each field type
- Combines queries using UNION ALL for efficient execution

**Implementation**:
- Used in `tryFindMediaUsages()` in `server/internal/media-management.ts`
- Gets all media fields: `getAllMediaFields(payload)`
- Maps to Drizzle: `mapMediaFieldsToDrizzle(fields)`
- Filters fields into three categories:
  - Simple fields: Direct relationships on main table
  - Nested fields: Media in nested array structures
  - Array fields: Media in relationship tables
- Generates separate Drizzle queries for each category
- Combines all queries using `UNION ALL` for single execution

**Query Generation**:

**Simple Fields Query**:
```typescript
SELECT 
  'collection-slug' as collection,
  id as documentId,
  'fieldPath' as fieldPath
FROM table_name
WHERE field_path = mediaId
```

**Nested Fields Query**:
```typescript
SELECT 
  'collection-slug' as collection,
  parent_table.id as documentId,
  'parentField.' || join_table._order::text || '.nestedField' as fieldPath
FROM parent_table
INNER JOIN join_table ON parent_table.id = join_table._parentID
WHERE join_table.nested_field = mediaId
```

**Array Fields Query**:
```typescript
SELECT 
  'collection-slug' as collection,
  parent_table.id as documentId,
  'fieldPath.' || join_table.order::text as fieldPath
FROM parent_table
INNER JOIN join_table ON parent_table.id = join_table.parent
WHERE join_table.mediaID = mediaId
  AND join_table.path = 'fieldPath'
```

**Benefits**:
- ✅ Comprehensive: Finds all usages across entire system
- ✅ Efficient: Single combined query execution
- ✅ Accurate: Handles all field structure types
- ✅ Maintainable: Automatically adapts to schema changes

### 5. Schema Validation

**Features**:
- Validates table existence in generated Drizzle schema
- Validates field existence within tables
- Filters out non-existent tables/fields automatically
- Prevents runtime errors from invalid references

**Implementation**:
- Checks if table exists: `schema[tableRef] !== undefined`
- Checks if field exists: `schemaFieldName in table`
- Filters results: `mappedFields.filter((field) => field.tableExists && field.fieldExists)`
- Only returns fields that exist in actual schema

**Validation Process**:
1. Look up table in generated schema object
2. If table exists, check if field exists in table
3. Mark `tableExists` and `fieldExists` flags
4. Filter out any fields with missing tables or fields
5. Return only valid, queryable fields

**Benefits**:
- ✅ Error prevention: Catches invalid references early
- ✅ Schema-aware: Only uses fields that actually exist
- ✅ Robust: Handles schema changes gracefully
- ✅ Type-safe: Works with generated TypeScript schema

## Technical Details

### Field Discovery Algorithm

1. **Root Level Traversal**: Start with collection/global root fields
2. **Field Type Check**: Identify relationship fields with `type === "relationship"`
3. **Media Relationship Check**: Verify `relationTo === "media"` or includes "media"
4. **Path Building**: Build field path using dot notation
5. **Array Detection**: Check `hasMany === true` for array relationships
6. **Nesting Detection**: Track if field is nested (`parentPath !== ""`)
7. **Recursive Processing**: For array fields, recursively process nested fields
8. **Result Collection**: Collect all discovered media fields

### Drizzle Mapping Algorithm

1. **Slug Conversion**: Convert kebab-case slug to snake_case table name
2. **Field Type Detection**: Determine if field is direct, array, or nested
3. **Table Name Resolution**:
   - Direct: `slugToTableName(slug)`
   - Array: `${slugToTableName(slug)}_rels`
   - Nested: `${slugToTableName(slug)}_${parentField}`
4. **Field Name Extraction**: Extract schema field name from field path
5. **Schema Lookup**: Check table existence in generated schema
6. **Field Validation**: Check field existence in table
7. **Reference Building**: Build `tableRef` and `columnRef` strings
8. **Filtering**: Return only fields with existing tables and fields

### Usage in Media Management

The discovered and mapped fields are used in `tryFindMediaUsages()` to:

1. **Get All Fields**: `getAllMediaFields(payload)` discovers all media fields
2. **Map to Drizzle**: `mapMediaFieldsToDrizzle(fields)` maps to database schema
3. **Categorize Fields**: Filter into simple, nested, and array categories
4. **Generate Queries**: Create Drizzle queries for each category
5. **Combine Queries**: Use `UNION ALL` to combine all queries
6. **Execute**: Run single combined query to find all usages
7. **Return Results**: Return collection, document ID, and field path for each usage

## Files Changed

### New Files
- `server/internal/utils/get-all-media-fields.ts` - Media fields discovery and Drizzle mapping utilities

### Modified Files
- `server/internal/media-management.ts` - Uses `getAllMediaFields` and `mapMediaFieldsToDrizzle` in `tryFindMediaUsages`

## Usage

### Basic Usage

```typescript
import { getAllMediaFields, mapMediaFieldsToDrizzle } from "server/internal/utils/get-all-media-fields";

// Discover all media fields
const mediaFields = getAllMediaFields(payload);

// Map to Drizzle schema
const drizzleFields = mapMediaFieldsToDrizzle(mediaFields);

// Use in queries
for (const field of drizzleFields) {
  // field.tableRef - table name in schema
  // field.columnRef - column reference
  // field.fieldPath - original field path
  // field.isArray - whether field is an array
  // field.isNested - whether field is nested
}
```

### Usage in Media Management

```typescript
// In tryFindMediaUsages()
const drizzleFields = mapMediaFieldsToDrizzle(getAllMediaFields(payload));

// Filter by field type
const simpleFields = drizzleFields.filter(
  (field) => !field.isArray && !field.isNested
);

const nestedFields = drizzleFields.filter(
  (field) => field.isNested
);

const arrayFields = drizzleFields.filter(
  (field) => field.isArray && !field.isNested
);

// Generate queries for each type
const queries = [
  ...simpleFields.map(generateSimpleQuery),
  ...nestedFields.map(generateNestedQuery),
  ...arrayFields.map(generateArrayQuery),
];

// Combine and execute
const combinedQuery = queries.reduce((acc, q) => acc.unionAll(q));
const results = await combinedQuery;
```

## Impact

### Positive Impacts

- **Comprehensive Tracking**: Enables finding all media usages across entire system
- **Automatic Discovery**: No manual configuration needed for new media fields
- **Schema Awareness**: Automatically adapts to schema changes
- **Efficient Queries**: Generates optimized database queries
- **Type Safety**: Works with generated TypeScript schema

### Media Management Benefits

- **Usage Validation**: Prevents deletion of media files in use
- **Complete Coverage**: Finds usages in all collections and globals
- **Nested Support**: Handles complex nested field structures
- **Performance**: Single combined query instead of multiple queries
- **Maintainability**: Automatically includes new fields as schema evolves

### Developer Experience

- **Zero Configuration**: Works automatically with existing schema
- **Type-Safe**: Uses generated TypeScript schema
- **Clear Structure**: Well-organized field information
- **Error Prevention**: Validates schema existence before use

## Related Changes

This utility is used in:
- **Media Usage Tracking**: `tryFindMediaUsages()` uses it to find all media references
- **Media Deletion**: Prevents deletion of media files that are in use
- **Media Management**: Enables comprehensive media lifecycle management

The system builds upon:
- **Payload CMS**: Uses Payload's collection and global field definitions
- **Drizzle ORM**: Maps to generated Drizzle schema for database queries
- **TypeScript**: Leverages generated types for type safety

## Future Enhancements

Potential improvements for future iterations:
- Cache discovered fields for performance
- Support for custom field types
- Field usage statistics and analytics
- Batch media usage queries
- Field dependency tracking
- Schema change detection and updates

