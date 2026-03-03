import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Payload } from "payload";

/**
 * Format error message with hint if available
 */
function parseError(err: unknown, msg: string): string {
	let formattedMsg = `${msg}`;
	if (err instanceof Error) {
		formattedMsg += ` ${err.message}.`;
		// Check if the error has a hint property
		if ("hint" in err && typeof err.hint === "string") {
			formattedMsg += ` ${err.hint}.`;
		}
	}
	return formattedMsg;
}

/**
 * Escape SQL string value for use in INSERT statements
 */
function escapeSqlValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	if (typeof value === "boolean") {
		return value ? "TRUE" : "FALSE";
	}
	if (typeof value === "number") {
		return String(value);
	}
	if (value instanceof Date) {
		return `'${value.toISOString()}'`;
	}
	if (typeof value === "object") {
		// JSON objects are stored as JSONB/text
		return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
	}
	// String values - escape single quotes
	return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Database dump result
 */
export type DumpResult = {
	success: boolean;
	outputPath?: string;
	error?: string;
};

/**
 * Dump database to SQL file using Drizzle ORM
 * Version-independent solution that works with any PostgreSQL version
 *
 * @param payload - Payload instance to access database connection
 * @param outputPath - Optional path to save the dump file. If not provided, generates a timestamped filename
 * @returns Promise<DumpResult> - Result containing success status, output path, or error
 */
export async function dumpDatabase({
	payload,
	outputPath,
}: {
	payload: Payload;
	outputPath?: string;
}): Promise<DumpResult> {
	if (payload.db.name !== "postgres") {
		return {
			success: false,
			error: "Database dump is only supported for PostgreSQL databases",
		};
	}

	try {
		const adapter = payload.db;
		const schemaName = adapter.schemaName || "public";
		const prependSchema = schemaName ? `"${schemaName}".` : "";

		// Ensure paideia_data directory exists
		const dataDir = "paideia_data";
		await mkdir(dataDir, { recursive: true });

		// Generate output path if not provided
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const filename = outputPath || `paideia-dump-${timestamp}.sql`;
		const finalOutputPath = join(dataDir, filename);

		console.log(
			`Starting database dump using Drizzle ORM to ${finalOutputPath}`,
		);

		const sqlParts: string[] = [];

		// Add header comment
		sqlParts.push("-- Paideia Database Dump");
		sqlParts.push(`-- Generated: ${new Date().toISOString()}`);
		sqlParts.push(`-- Database Schema: ${schemaName}`);
		sqlParts.push("");

		// Get all tables in the schema
		const tablesResult = await adapter.execute({
			drizzle: adapter.drizzle as any,
			raw: `
				SELECT table_name 
				FROM information_schema.tables 
				WHERE table_schema = '${schemaName}'
					AND table_type = 'BASE TABLE'
				ORDER BY table_name;
			`,
		});

		const tables = tablesResult.rows as Array<{ table_name: string }>;

		// Process each table
		for (const table of tables) {
			const tableName = table.table_name;
			const fullTableName = `${prependSchema}"${tableName}"`;

			// Get table structure (columns, types, defaults, constraints)
			const columnsResult = await adapter.execute({
				drizzle: adapter.drizzle as any,
				raw: `
					SELECT 
						column_name,
						data_type,
						udt_name,
						is_nullable,
						column_default,
						character_maximum_length
					FROM information_schema.columns
					WHERE table_schema = '${schemaName}'
						AND table_name = '${tableName}'
					ORDER BY ordinal_position;
				`,
			});

			const columns = columnsResult.rows as Array<{
				column_name: string;
				data_type: string;
				udt_name: string;
				is_nullable: string;
				column_default: string | null;
				character_maximum_length: number | null;
			}>;

			// Generate CREATE TABLE statement
			sqlParts.push(`-- Table: ${tableName}`);
			sqlParts.push(`DROP TABLE IF EXISTS ${fullTableName} CASCADE;`);
			sqlParts.push(`CREATE TABLE ${fullTableName} (`);

			const columnDefinitions: string[] = [];
			for (const column of columns) {
				let columnDef = `  "${column.column_name}" `;

				// Map PostgreSQL types
				let type = column.udt_name;
				if (type === "varchar" && column.character_maximum_length) {
					type = `varchar(${column.character_maximum_length})`;
				} else if (type === "bpchar" && column.character_maximum_length) {
					type = `char(${column.character_maximum_length})`;
				} else if (type === "text") {
					type = "text";
				} else if (type === "int4") {
					type = "integer";
				} else if (type === "int8") {
					type = "bigint";
				} else if (type === "bool") {
					type = "boolean";
				} else if (type === "timestamp") {
					type = "timestamp";
				} else if (type === "timestamptz") {
					type = "timestamptz";
				} else if (type === "date") {
					type = "date";
				} else if (type === "numeric") {
					type = "numeric";
				} else if (type === "jsonb") {
					type = "jsonb";
				} else if (type === "json") {
					type = "json";
				} else if (type === "uuid") {
					type = "uuid";
				}

				columnDef += type;

				if (column.is_nullable === "NO") {
					columnDef += " NOT NULL";
				}

				if (column.column_default) {
					// Clean up default value (remove function calls, etc.)
					const defaultValue = column.column_default
						.replace(/::\w+/g, "")
						.trim();
					columnDef += ` DEFAULT ${defaultValue}`;
				}

				columnDefinitions.push(columnDef);
			}

			sqlParts.push(columnDefinitions.join(",\n"));
			sqlParts.push(");");
			sqlParts.push("");

			// Get primary keys
			const pkResult = await adapter.execute({
				drizzle: adapter.drizzle as any,
				raw: `
					SELECT a.attname
					FROM pg_index i
					JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
					WHERE i.indrelid = '${schemaName}.${tableName}'::regclass
						AND i.indisprimary;
				`,
			});

			const primaryKeys = pkResult.rows as Array<{ attname: string }>;
			if (primaryKeys.length > 0) {
				const pkColumns = primaryKeys.map((pk) => `"${pk.attname}"`).join(", ");
				sqlParts.push(
					`ALTER TABLE ${fullTableName} ADD PRIMARY KEY (${pkColumns});`,
				);
			}

			// Get foreign keys
			const fkResult = await adapter.execute({
				drizzle: adapter.drizzle as any,
				raw: `
					SELECT
						tc.constraint_name,
						kcu.column_name,
						ccu.table_name AS foreign_table_name,
						ccu.column_name AS foreign_column_name,
						rc.update_rule,
						rc.delete_rule
					FROM information_schema.table_constraints AS tc
					JOIN information_schema.key_column_usage AS kcu
						ON tc.constraint_name = kcu.constraint_name
						AND tc.table_schema = kcu.table_schema
					JOIN information_schema.constraint_column_usage AS ccu
						ON ccu.constraint_name = tc.constraint_name
						AND ccu.table_schema = tc.table_schema
					LEFT JOIN information_schema.referential_constraints AS rc
						ON tc.constraint_name = rc.constraint_name
					WHERE tc.constraint_type = 'FOREIGN KEY'
						AND tc.table_schema = '${schemaName}'
						AND tc.table_name = '${tableName}';
				`,
			});

			const foreignKeys = fkResult.rows as Array<{
				constraint_name: string;
				column_name: string;
				foreign_table_name: string;
				foreign_column_name: string;
				update_rule: string;
				delete_rule: string;
			}>;

			for (const fk of foreignKeys) {
				const fkTableName = `${prependSchema}"${fk.foreign_table_name}"`;
				const updateRule =
					fk.update_rule !== "NO ACTION" ? ` ON UPDATE ${fk.update_rule}` : "";
				const deleteRule =
					fk.delete_rule !== "NO ACTION" ? ` ON DELETE ${fk.delete_rule}` : "";
				sqlParts.push(
					`ALTER TABLE ${fullTableName} ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES ${fkTableName} ("${fk.foreign_column_name}")${updateRule}${deleteRule};`,
				);
			}

			// Get indexes
			const indexResult = await adapter.execute({
				drizzle: adapter.drizzle as any,
				raw: `
					SELECT
						indexname,
						indexdef
					FROM pg_indexes
					WHERE schemaname = '${schemaName}'
						AND tablename = '${tableName}'
						AND indexname NOT LIKE '%_pkey';
				`,
			});

			const indexes = indexResult.rows as Array<{
				indexname: string;
				indexdef: string;
			}>;

			for (const index of indexes) {
				// Replace table name in index definition to use full table name
				const indexDef = index.indexdef.replace(
					new RegExp(`\\b${schemaName}\\.${tableName}\\b`, "g"),
					fullTableName,
				);
				sqlParts.push(`${indexDef};`);
			}

			sqlParts.push("");

			// Get all data from the table
			// Use first column for ordering, or no ordering if no columns
			const orderBy =
				columns.length > 0 ? `ORDER BY "${columns[0]!.column_name}"` : "";
			const dataResult = await adapter.execute({
				drizzle: adapter.drizzle as any,
				raw: `SELECT * FROM ${fullTableName} ${orderBy};`,
			});

			const rows = dataResult.rows as Array<Record<string, unknown>>;

			if (rows.length > 0) {
				// Generate INSERT statements in batches for better performance
				const batchSize = 1000;
				for (let i = 0; i < rows.length; i += batchSize) {
					const batch = rows.slice(i, i + batchSize);
					const columnNames = columns
						.map((col) => `"${col.column_name}"`)
						.join(", ");

					sqlParts.push(`INSERT INTO ${fullTableName} (${columnNames}) VALUES`);

					const valueRows: string[] = [];
					for (const row of batch) {
						const values = columns
							.map((col) => escapeSqlValue(row[col.column_name]))
							.join(", ");
						valueRows.push(`  (${values})`);
					}

					sqlParts.push(valueRows.join(",\n") + ";");
					sqlParts.push("");
				}
			}
		}

		// Write SQL dump to file
		const sqlContent = sqlParts.join("\n");
		await writeFile(finalOutputPath, sqlContent, "utf-8");

		console.log(`Database dump completed successfully: ${finalOutputPath}`);

		return {
			success: true,
			outputPath: finalOutputPath,
		};
	} catch (err) {
		const errorMessage = parseError(err, "Failed to dump database");
		console.error(errorMessage, err);

		return {
			success: false,
			error: errorMessage,
		};
	}
}
