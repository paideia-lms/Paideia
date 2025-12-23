import type { BasePayload } from "payload";
import * as schema from "src/payload-generated-schema";

/**
 * Recursively finds all media fields in a field definition
 */
function findMediaFields(
	fields: readonly unknown[],
	parentPath = "",
): Array<{ fieldPath: string; isArray: boolean; isNested: boolean }> {
	const mediaFields: Array<{
		fieldPath: string;
		isArray: boolean;
		isNested: boolean;
	}> = [];

	for (const field of fields) {
		if (
			typeof field === "object" &&
			field !== null &&
			"name" in field &&
			"type" in field
		) {
			const fieldDef = field as {
				name: string;
				type: string;
				relationTo?: string | string[];
				fields?: readonly unknown[];
				hasMany?: boolean;
			};

			const currentPath = parentPath
				? `${parentPath}.${fieldDef.name}`
				: fieldDef.name;

			// Check if this is a relationship field to media
			if (
				fieldDef.type === "relationship" &&
				(fieldDef.relationTo === "media" ||
					(Array.isArray(fieldDef.relationTo) &&
						fieldDef.relationTo.includes("media")))
			) {
				mediaFields.push({
					fieldPath: currentPath,
					isArray: fieldDef.hasMany === true,
					isNested: parentPath !== "",
				});
			}

			// Recursively check nested fields (for array fields)
			if (fieldDef.type === "array" && fieldDef.fields) {
				const nestedFields = findMediaFields(fieldDef.fields, currentPath);
				mediaFields.push(...nestedFields);
			}
		}
	}

	return mediaFields;
}
/**
 * Gets all media fields from all collections and globals
 */

export function getAllMediaFields(payload: BasePayload) {
	const allMediaFields: Array<{
		type: "collection" | "global";
		slug: string;
		fieldPath: string;
		isArray: boolean;
		isNested: boolean;
	}> = [];

	// Process collections
	for (const [slug, collection] of Object.entries(payload.collections)) {
		if (collection.config.fields) {
			const mediaFields = findMediaFields(collection.config.fields);
			for (const field of mediaFields) {
				allMediaFields.push({
					type: "collection",
					slug,
					fieldPath: field.fieldPath,
					isArray: field.isArray,
					isNested: field.isNested,
				});
			}
		}
	}

	// Process globals
	for (const global of Object.values(payload.globals.config)) {
		if (global.slug && global.fields) {
			const mediaFields = findMediaFields(global.fields);
			for (const field of mediaFields) {
				allMediaFields.push({
					type: "global",
					slug: global.slug,
					fieldPath: field.fieldPath,
					isArray: field.isArray,
					isNested: field.isNested,
				});
			}
		}
	}

	return allMediaFields;
}
/**
 * Maps media fields to their Drizzle schema table and column references
 */

export function mapMediaFieldsToDrizzle(
	fields: Array<{
		type: "collection" | "global";
		slug: string;
		fieldPath: string;
		isArray: boolean;
		isNested: boolean;
	}>,
) {
	// Convert kebab-case to snake_case for table names
	const slugToTableName = (slug: string): string => {
		return slug.replace(/-/g, "_");
	};

	// Convert camelCase field name to the schema field name
	// e.g., "logoLight" -> "logoLight" (schema field), but DB column is "logo_light_id"
	const fieldPathToSchemaFieldName = (fieldPath: string): string => {
		// Keep camelCase as-is for schema field names
		return fieldPath;
	};

	const mappedFields: Array<{
		type: "collection" | "global";
		slug: string;
		fieldPath: string;
		tableName: string;
		schemaFieldName: string; // Field name in the schema object (e.g., "avatar", "logoLight")
		tableRef: string; // Reference to the schema table (e.g., "users", "appearance_settings")
		columnRef: string; // Reference to the column (e.g., "users.avatar", "appearance_settings.logoLight")
		tableExists: boolean;
		fieldExists: boolean;
		isNested: boolean;
		isArray: boolean;
	}> = [];

	for (const field of fields) {
		let tableName: string;
		let schemaFieldName: string;
		let tableRef: string;
		let columnRef: string;

		if (field.isNested) {
			// Nested fields: e.g., "attachments.file" -> "assignment_submissions_attachments.file"
			const parts = field.fieldPath.split(".");
			const parentField = parts[0]!;
			const nestedField = parts.slice(1).join(".");

			tableName = `${slugToTableName(field.slug)}_${parentField.replace(/-/g, "_")}`;
			schemaFieldName = nestedField; // e.g., "file"
			tableRef = tableName;
			columnRef = `${tableName}.${schemaFieldName}`;
		} else if (field.isArray) {
			// Array fields: use _rels table with mediaID column
			tableName = `${slugToTableName(field.slug)}_rels`;
			schemaFieldName = "mediaID";
			tableRef = tableName;
			columnRef = `${tableName}.${schemaFieldName}`;
		} else {
			// Direct fields: use main table with field name
			tableName = slugToTableName(field.slug);
			schemaFieldName = fieldPathToSchemaFieldName(field.fieldPath);
			tableRef = tableName;
			columnRef = `${tableName}.${schemaFieldName}`;
		}

		// Check if table exists in schema
		const schemaTable = (schema as Record<string, unknown>)[tableRef];
		const tableExists = schemaTable !== undefined;

		// Check if the field exists in the table
		let fieldExists = false;
		if (tableExists && schemaTable) {
			const table = schemaTable as Record<string, unknown>;
			fieldExists = schemaFieldName in table;
		}

		mappedFields.push({
			type: field.type,
			slug: field.slug,
			fieldPath: field.fieldPath,
			tableName,
			schemaFieldName,
			tableRef,
			columnRef,
			tableExists,
			fieldExists,
			isNested: field.isNested,
			isArray: field.isArray,
		});
	}

	return mappedFields.filter((field) => field.tableExists && field.fieldExists);
}
