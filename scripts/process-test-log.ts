#!/usr/bin/env bun

/**
 * Script to clean test log files by removing unwanted lines:
 * - Migration-related INFO messages (Dropping database, Reading migration files, Migrating:, Migrated:, Done.)
 * - Email-related warnings/info (No email adapter provided, Email attempted without being configured)
 * - Bucket-related messages (Bucket is already empty)
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const logFile = process.argv[2];

if (!logFile) {
	console.error("Usage: bun scripts/clean-test-log.ts <log-file-path>");
	process.exit(1);
}

const patternsToRemove = [
	// Migration-related patterns
	/Dropping database/,
	/Reading migration files/,
	/Migrating:/,
	/Migrated:/,
	/^\s*Done\.\s*$/,
	// ANSI-encoded "Done." messages (e.g., [11:29:33] [32mINFO[39m: [36mDone.[39m)
	/\[32mINFO\[39m:\s*\[36mDone\.\[39m/,
	// Email-related patterns
	/No email adapter provided/,
	/Email attempted without being configured/,
	// Bucket-related patterns
	/Bucket is already empty/,
];

const patternsToKeep = [
	// Test header
	/^bun test/,
	// Test file names (e.g., "app/utils/fill-in-the-blank-utils.test.ts:")
	/^[a-zA-Z0-9_/\\-]+\.test\.ts:/,
	// Test results (pass/fail)
	/^\(pass\)/,
	/^\(fail\)/,
	// Line numbers with code (e.g., "629 |")
	/^\s*\d+\s+\|/,
	// Expected/Received error messages
	/^Expected:/,
	/^Received:/,
	// Timeout messages
	/^\s*\^\s+this test timed out after/,
	// Error messages (error: at start of line)
	/^error:/,
	// TypeError and other error types
	/^TypeError:/,
	// Stack trace lines (starting with "at")
	/^\s+at /,
	// Error markers (^ pointing to error location)
	/^\s*\^/,
	// Test summary section header (e.g., "53 tests failed:")
	/^\s*\d+\s+tests?\s+(failed|passed|errors?):/,
	// Test summary lines (numbers at start of line with pass/fail/errors/expect)
	/^\s+\d+\s+(pass|fail|errors?|expect\(\) calls?)/,
	// Final summary line
	/^Ran \d+ tests/,
	// Empty lines (keep for readability)
	/^\s*$/,
];

async function cleanLogFile(filePath: string) {
	try {
		const content = await readFile(filePath, "utf-8");

		// Check if log file is already processed
		if (content.includes("✅ False alarms") || content.includes("❌ Real failures")) {
			console.error(
				`\n⚠️  This log file has already been processed.\n` +
					`Please generate a new log file before processing.\n` +
					`Run: bun test > tests/reports/YYYY-MM-DD.log`,
			);
			process.exit(1);
		}

		const lines = content.split("\n");

		const cleanedLines = lines.filter((line) => {
			// First, remove lines that match patternsToRemove
			if (patternsToRemove.some((pattern) => pattern.test(line))) {
				return false;
			}

			// Then, only keep lines that match patternsToKeep
			return patternsToKeep.some((pattern) => pattern.test(line));
		});

		const cleanedContent = cleanedLines.join("\n");
		await writeFile(filePath, cleanedContent, "utf-8");

		const removedCount = lines.length - cleanedLines.length;
		console.log(
			`Cleaned log file: ${filePath}\nRemoved ${removedCount} line(s)`,
		);

		// Read the cleaned file and extract failed test files
		const cleanedFileContent = await readFile(filePath, "utf-8");
		const failedTestFiles = extractFailedTestFiles(cleanedFileContent);

		if (failedTestFiles.length > 0) {
			console.log(`\nFound ${failedTestFiles.length} failed test file(s). Re-running tests...\n`);
			const { realFailures, falseAlarms } = await verifyFailedTests(failedTestFiles);

			if (falseAlarms.length > 0) {
				console.log(`\n✅ False alarms (${falseAlarms.length}):`);
				for (const file of falseAlarms) {
					console.log(`  - ${file}`);
				}
			}

			if (realFailures.length > 0) {
				console.log(`\n❌ Real failures (${realFailures.length}):`);
				for (const file of realFailures) {
					console.log(`  - ${file}`);
				}
			} else {
				console.log(`\n✅ All tests are passing now! No real failures.`);
			}

			// Append summary to log file
			await appendSummaryToLog(filePath, falseAlarms, realFailures);
		} else {
			console.log("\n✅ No failed test files found.");
		}
	} catch (error) {
		console.error(`Error cleaning log file: ${error}`);
		process.exit(1);
	}
}

function extractFailedTestFiles(content: string): string[] {
	const lines = content.split("\n");
	const failedFiles = new Set<string>();
	let currentTestFile: string | null = null;
	let hasFailures = false;

	for (const line of lines) {
		// Check if line is a test file name
		const testFileMatch = line.match(/^([a-zA-Z0-9_/\\-]+\.test\.ts):/);
		if (testFileMatch) {
			// Save previous file if it had failures
			if (currentTestFile !== null && hasFailures) {
				failedFiles.add(currentTestFile);
			}
			// Start tracking new file
			currentTestFile = testFileMatch[1] ?? null;
			hasFailures = false;
			continue;
		}

		// Check if line is a failed test
		if (line.startsWith("(fail)")) {
			hasFailures = true;
		}
	}

	// Don't forget the last file
	if (currentTestFile !== null && hasFailures) {
		failedFiles.add(currentTestFile);
	}

	return Array.from(failedFiles).sort();
}

async function appendSummaryToLog(
	filePath: string,
	falseAlarms: string[],
	realFailures: string[],
): Promise<void> {
	const summary: string[] = [];
	summary.push("");
	summary.push("=".repeat(60));
	summary.push("Test Verification Summary");
	summary.push("=".repeat(60));
	summary.push("");

	if (falseAlarms.length > 0) {
		summary.push(`✅ False alarms (${falseAlarms.length}):`);
		for (const file of falseAlarms) {
			summary.push(`  - ${file}`);
		}
		summary.push("");
	}

	if (realFailures.length > 0) {
		summary.push(`❌ Real failures (${realFailures.length}):`);
		for (const file of realFailures) {
			summary.push(`  - ${file}`);
		}
		summary.push("");
	}

	const summaryText = summary.join("\n");
	const currentContent = await readFile(filePath, "utf-8");
	await writeFile(filePath, `${currentContent}\n${summaryText}`, "utf-8");
}

async function verifyFailedTests(testFiles: string[]): Promise<{
	realFailures: string[];
	falseAlarms: string[];
}> {
	const realFailures: string[] = [];
	const falseAlarms: string[] = [];

	for (const testFile of testFiles) {
		console.log(`Testing ${testFile}...`);
		const passed = await runTest(testFile);

		if (passed) {
			falseAlarms.push(testFile);
			console.log(`  ✅ Passed (false alarm)`);
		} else {
			realFailures.push(testFile);
			console.log(`  ❌ Failed`);
		}
	}

	return { realFailures, falseAlarms };
}

function runTest(testFile: string): Promise<boolean> {
	return new Promise((resolve) => {
		const bunProcess = spawn("bun", ["test", testFile], {
			stdio: "pipe",
			shell: false,
		});

		let stdout = "";
		let stderr = "";

		bunProcess.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		bunProcess.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		bunProcess.on("close", (code) => {
			// Test passes if exit code is 0
			resolve(code === 0);
		});

		bunProcess.on("error", (error) => {
			console.error(`  Error running test: ${error.message}`);
			resolve(false);
		});
	});
}

cleanLogFile(logFile);

