import { $ } from "bun";
import { envVars } from "../../env";
import { isPgDumpAvailable } from "../cli-dependencies-check";

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
 * Database dump result
 */
export type DumpResult = {
	success: boolean;
	outputPath?: string;
	error?: string;
};

/**
 * Dump database to SQL file using pg_dump
 * Only works for PostgreSQL databases when pg_dump is installed
 *
 * @param outputPath - Optional path to save the dump file. If not provided, generates a timestamped filename
 * @returns Promise<DumpResult> - Result containing success status, output path, or error
 */
export async function dumpDatabase({
	outputPath,
}: {
	outputPath?: string;
}): Promise<DumpResult> {
	// Check if pg_dump is available
	const pgDumpAvailable = await isPgDumpAvailable();
	if (!pgDumpAvailable) {
		return {
			success: false,
			error:
				"pg_dump is not installed. Please install PostgreSQL client tools to use this feature.",
		};
	}

	// Get connection string from environment variables
	const connectionString = envVars.DATABASE_URL.value;

	if (!connectionString) {
		return {
			success: false,
			error: "DATABASE_URL is not set",
		};
	}

	try {
		// Parse connection string to extract components for pg_dump
		const url = new URL(connectionString);
		const host = url.hostname;
		const port = url.port || "5432";
		const database = url.pathname.slice(1); // Remove leading '/'
		const username = url.username;
		const password = url.password;

		// Generate output path if not provided
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const finalOutputPath = outputPath || `paideia-dump-${timestamp}.sql`;

		console.log(`Starting database dump using pg_dump to ${finalOutputPath}`);

		// Build pg_dump command
		// Note: We use environment variable for password to avoid exposing it in process list
		const env = {
			...process.env,
			PGPASSWORD: password,
		};

		// Execute pg_dump using Bun.spawn for better control
		const proc = Bun.spawn(
			[
				"pg_dump",
				"--host",
				host,
				"--port",
				port,
				"--username",
				username,
				"--dbname",
				database,
				"--file",
				finalOutputPath,
				"--verbose",
				"--no-owner",
				"--no-acl",
				"--format",
				"plain",
			],
			{
				env,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		// Wait for process to complete
		const exitCode = await proc.exited;

		// Read stderr for error output
		const stderr = await new Response(proc.stderr).text();

		if (exitCode !== 0) {
			const errorOutput = stderr || "Unknown error";
			console.error("Failed to dump database:", errorOutput);

			// Check for version mismatch error
			if (
				errorOutput.includes("server version mismatch") ||
				errorOutput.includes("version mismatch")
			) {
				// Extract version information from error
				const versionMatch = errorOutput.match(
					/server version: ([\d.]+).*pg_dump version: ([\d.]+)/i,
				);
				const serverVersion = versionMatch?.[1] || "unknown";
				const clientVersion = versionMatch?.[2] || "unknown";

				return {
					success: false,
					error: `pg_dump version mismatch detected. Server version: ${serverVersion}, pg_dump version: ${clientVersion}. Please install a compatible version of PostgreSQL client tools that matches your server version (${serverVersion}). You may need to upgrade your pg_dump client using: brew upgrade postgresql (on macOS) or apt-get upgrade postgresql-client (on Debian/Ubuntu).`,
				};
			}

			return {
				success: false,
				error: `pg_dump failed: ${errorOutput}`,
			};
		}

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
