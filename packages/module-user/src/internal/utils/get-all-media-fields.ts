import type { BasePayload } from "payload";
import * as schema from "../../payload-generated-schema";

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

			if (fieldDef.type === "array" && fieldDef.fields) {
				const nestedFields = findMediaFields(fieldDef.fields, currentPath);
				mediaFields.push(...nestedFields);
			}
		}
	}

	return mediaFields;
}

export function getAllMediaFields(payload: BasePayload) {
	const allMediaFields: Array<{
		type: "collection" | "global";
		slug: string;
		fieldPath: string;
		isArray: boolean;
		isNested: boolean;
	}> = [];

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

export function mapMediaFieldsToDrizzle(
	fields: Array<{
		type: "collection" | "global";
		slug: string;
		fieldPath: string;
		isArray: boolean;
		isNested: boolean;
	}>,
) {
	const slugToTableName = (slug: string): string =>
		slug.replace(/-/g, "_");

	const fieldPathToSchemaFieldName = (fieldPath: string): string =>
		fieldPath;

	const mappedFields: Array<{
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
	}> = [];

	for (const field of fields) {
		let tableName: string;
		let schemaFieldName: string;
		let tableRef: string;
		let columnRef: string;

		if (field.isNested) {
			const parts = field.fieldPath.split(".");
			const parentField = parts[0]!;
			const nestedField = parts.slice(1).join(".");

			tableName = `${slugToTableName(field.slug)}_${parentField.replace(/-/g, "_")}`;
			schemaFieldName = nestedField;
			tableRef = tableName;
			columnRef = `${tableName}.${schemaFieldName}`;
		} else if (field.isArray) {
			tableName = `${slugToTableName(field.slug)}_rels`;
			schemaFieldName = "mediaID";
			tableRef = tableName;
			columnRef = `${tableName}.${schemaFieldName}`;
		} else {
			tableName = slugToTableName(field.slug);
			schemaFieldName = fieldPathToSchemaFieldName(field.fieldPath);
			tableRef = tableName;
			columnRef = `${tableName}.${schemaFieldName}`;
		}

		const schemaTable = (schema as Record<string, unknown>)[tableRef];
		const tableExists = schemaTable !== undefined;

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
