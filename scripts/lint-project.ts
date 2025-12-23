#!/usr/bin/env bun

/**
 * Custom project-specific linter
 * Rule-based linter that checks for banned code patterns in files matching specific glob patterns
 * Supports both regex and AST-based pattern matching
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Glob } from "bun";
import * as ts from "typescript";
import { styleText } from "node:util";

/**
 * AST pattern matcher function
 * Receives a TypeScript node and returns true if it matches the pattern
 */
export type ASTPatternMatcher = (node: ts.Node, sourceFile: ts.SourceFile) => boolean;

/**
 * AST pattern fix function
 * Receives a TypeScript node and source file, returns the replacement text or null if fix is not applicable
 */
export type ASTPatternFix = (
	node: ts.Node,
	sourceFile: ts.SourceFile,
) => string | null;

/**
 * AST pattern configuration
 */
export interface ASTPattern {
	name: string;
	matcher: ASTPatternMatcher;
	fix?: ASTPatternFix;
}

export type LintRule =
	| {
			name: string;
			description: string;
			includes: string[]; // glob patterns, supports negation with !
			patterns: RegExp[]; // regex patterns to detect banned code
			mode: "regex";
			level?: "error" | "warning"; // default: "error"
	  }
	| {
			name: string;
			description: string;
			includes: string[]; // glob patterns, supports negation with !
			astPatterns: ASTPattern[]; // AST patterns to detect banned code
			mode: "ast";
			level?: "error" | "warning"; // default: "error"
	  };

// Load linter configuration
interface ConfigModule {
	astPatterns: Record<string, ASTPatternMatcher>;
	rules: LintRule[];
	logLevel?: "error" | "warning"; // default: "error" - only show violations at or above this level
}

let configModule: ConfigModule;

async function loadConfig(): Promise<ConfigModule> {
	try {
		const config = await import("../linter.config");
		if (!config.rules) {
			throw new Error(
				"linter.config.ts must export 'rules' and 'astPatterns'",
			);
		}
		return config as ConfigModule;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (
			errorMessage.includes("Cannot find module") ||
			errorMessage.includes("MODULE_NOT_FOUND")
		) {
			throw new Error(
				"linter.config.ts not found. Please create it in the root directory.",
			);
		}
		throw error;
	}
}

/**
 * Filter violations based on log level
 * Log level "error" shows only errors
 * Log level "warning" shows warnings and errors
 */
function filterViolationsByLogLevel(
	violations: Violation[],
	logLevel: "error" | "warning" = "error",
): Violation[] {
	if (logLevel === "error") {
		return violations.filter((v) => v.level === "error");
	}
	// logLevel === "warning" - show both warnings and errors
	return violations;
}

interface Violation {
	rule: string;
	file: string;
	line: number;
	column: number;
	match: string;
	level: "error" | "warning";
	node?: ts.Node; // Store node for fixing
	astPattern?: ASTPattern; // Store pattern for fixing
}

/**
 * Parse includes array to separate positive and negative patterns
 */
function parsePatterns(includes: string[]): {
	positive: string[];
	negative: string[];
} {
	const positive: string[] = [];
	const negative: string[] = [];

	for (const pattern of includes) {
		if (pattern.startsWith("!")) {
			negative.push(pattern.slice(1));
		} else {
			positive.push(pattern);
		}
	}

	return { positive, negative };
}

/**
 * Check if a file matches any of the glob patterns
 */
function matchesGlob(filePath: string, patterns: string[]): boolean {
	for (const pattern of patterns) {
		const glob = new Glob(pattern);
		if (glob.match(filePath)) {
			return true;
		}
	}
	return false;
}

/**
 * Get all files matching the glob patterns
 */
async function getMatchingFiles(
	includes: string[],
): Promise<string[]> {
	const { positive, negative } = parsePatterns(includes);

	if (positive.length === 0) {
		return [];
	}

	// Get all files recursively
	const allFiles = await readdir(".", {
		withFileTypes: true,
		recursive: true,
	}).then((files) =>
		files
			.filter((f) => f.isFile() && (f.name.endsWith(".ts") || f.name.endsWith(".tsx")))
			.map((f) => {
				// Construct relative path
				const relativePath = path.relative(
					process.cwd(),
					`./${f.parentPath}/${f.name}`,
				);
				// Normalize path separators for glob matching
				return relativePath.replace(/\\/g, "/");
			}),
	);

	// Filter files matching positive patterns
	const matchingFiles = allFiles.filter((file) =>
		matchesGlob(file, positive),
	);

	// Filter out files matching negative patterns
	const filteredFiles = matchingFiles.filter(
		(file) => !matchesGlob(file, negative),
	);

	return filteredFiles;
}

/**
 * Get line and column from TypeScript node position
 */
function getLineAndColumn(
	node: ts.Node,
	sourceFile: ts.SourceFile,
): { line: number; column: number } {
	const pos = node.getStart(sourceFile);
	const lineAndChar = sourceFile.getLineAndCharacterOfPosition(pos);
	return {
		line: lineAndChar.line + 1, // 1-indexed
		column: lineAndChar.character + 1, // 1-indexed
	};
}

/**
 * Get text content of a node for display
 */
function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
	return node.getText(sourceFile).trim();
}

/**
 * Find violations using regex patterns
 */
function findRegexViolations(
	filePath: string,
	content: string,
	rule: Extract<LintRule, { mode: "regex" }>,
): Violation[] {
	const violations: Violation[] = [];
	
	if (!rule.patterns || rule.patterns.length === 0) {
		return violations;
	}

	for (const pattern of rule.patterns) {
		const matches = Array.from(content.matchAll(pattern));
		for (const match of matches) {
			if (match.index === undefined) continue;

			// Calculate line and column from match index
			const beforeMatch = content.slice(0, match.index);
			const lineNumber = beforeMatch.split("\n").length;
			const lineStart = beforeMatch.lastIndexOf("\n") + 1;
			const column = match.index - lineStart + 1;

			violations.push({
				rule: rule.name,
				file: filePath,
				line: lineNumber,
				column,
				match: match[0] || "",
				level: rule.level || "error",
			});
		}
	}

	return violations;
}

/**
 * Cache for parsed AST source files to avoid re-parsing
 */
const astCache = new Map<string, ts.SourceFile>();

/**
 * Get or create AST source file (cached)
 */
function getSourceFile(filePath: string, content: string): ts.SourceFile {
	if (!astCache.has(filePath)) {
		const sourceFile = ts.createSourceFile(
			filePath,
			content,
			ts.ScriptTarget.Latest,
			true,
		);
		astCache.set(filePath, sourceFile);
	}
	return astCache.get(filePath)!;
}

/**
 * Find violations using AST patterns
 */
function findASTViolations(
	filePath: string,
	content: string,
	rule: Extract<LintRule, { mode: "ast" }>,
): Violation[] {
	const violations: Violation[] = [];

	if (!rule.astPatterns || rule.astPatterns.length === 0) {
		return violations;
	}

	// Use cached AST source file
	const sourceFile = getSourceFile(filePath, content);

	// Traverse the AST and check for patterns
	function visit(node: ts.Node) {
		// Check each AST pattern
		for (const astPattern of rule.astPatterns!) {
			if (astPattern.matcher(node, sourceFile)) {
				const { line, column } = getLineAndColumn(node, sourceFile);
				const match = getNodeText(node, sourceFile);

				violations.push({
					rule: rule.name,
					file: filePath,
					line,
					column,
					match,
					level: rule.level || "error",
					node,
					astPattern,
				});
			}
		}

		// Continue traversing
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);

	return violations;
}

/**
 * Find violations in a file for a given rule
 */
function findViolations(
	filePath: string,
	content: string,
	rule: LintRule,
): Violation[] {
	if (rule.mode === "regex") {
		return findRegexViolations(filePath, content, rule);
	}

	// rule.mode === "ast"
	try {
		return findASTViolations(filePath, content, rule);
	} catch (error) {
		console.warn(
			`Warning: AST parsing failed for ${filePath}: ${error}`,
		);
		return [];
	}
}

/**
 * Apply fixes to a file
 */
async function applyFixes(
	filePath: string,
	content: string,
	violations: Violation[],
): Promise<{ fixed: boolean; newContent: string }> {
	const fileViolations = violations.filter((v) => v.file === filePath);
	if (fileViolations.length === 0) {
		return { fixed: false, newContent: content };
	}

	// Group violations by their start position (descending) to apply fixes from end to start
	const fixableViolations = fileViolations.filter(
		(v) => v.node && v.astPattern?.fix,
	);

	if (fixableViolations.length === 0) {
		return { fixed: false, newContent: content };
	}

	// Sort by position (descending) to apply fixes from end to start
	fixableViolations.sort((a, b) => {
		const posA = a.node!.getStart();
		const posB = b.node!.getStart();
		return posB - posA;
	});

	let newContent = content;
	const sourceFile = getSourceFile(filePath, content);

	for (const violation of fixableViolations) {
		if (!violation.node || !violation.astPattern?.fix) continue;

		try {
			const replacement = violation.astPattern.fix(violation.node, sourceFile);
			if (replacement !== null) {
				const start = violation.node.getStart();
				const end = violation.node.getEnd();
				newContent =
					newContent.slice(0, start) + replacement + newContent.slice(end);
				// Update source file cache after modification
				astCache.delete(filePath);
			}
		} catch (error) {
			console.warn(
				`Warning: Failed to apply fix for ${filePath} at line ${violation.line}: ${error}`,
			);
		}
	}

	return { fixed: fixableViolations.length > 0, newContent };
}

/**
 * Main linting function
 */
async function lint(
	applyAutoFix = false,
): Promise<{
	violations: Violation[];
	hasErrors: boolean;
	hasWarnings: boolean;
	fixedFiles: string[];
}> {
	let violations: Violation[] = [];

	// Load configuration
	configModule = await loadConfig();
	const { rules, logLevel = "error" } = configModule;

	// Pre-compute matching files for each rule (using Set for O(1) lookup)
	const ruleFileMap = new Map<LintRule, Set<string>>();
	for (const rule of rules) {
		const matchingFiles = await getMatchingFiles(rule.includes);
		ruleFileMap.set(rule, new Set(matchingFiles));
	}

	// Collect all unique files from all rules
	const allFilePaths = new Set<string>();
	for (const files of ruleFileMap.values()) {
		for (const filePath of files) {
			allFilePaths.add(filePath);
		}
	}

	// Read all files in parallel
	const fileContents = await Promise.all(
		Array.from(allFilePaths).map(async (filePath) => {
			try {
				const content = await readFile(filePath, "utf-8");
				return { filePath, content, error: null };
			} catch (error) {
				console.error(`Error reading file ${filePath}: ${error}`);
				return { filePath, content: null, error };
			}
		}),
	);

	// Process each file, checking all applicable rules
	const fileContentMap = new Map<string, string>();
	for (const { filePath, content, error } of fileContents) {
		if (error || !content) continue;
		fileContentMap.set(filePath, content);

		// Check all rules that apply to this file
		for (const rule of rules) {
			const ruleFiles = ruleFileMap.get(rule)!;
			if (ruleFiles.has(filePath)) {
				const fileViolations = findViolations(filePath, content, rule);
				violations.push(...fileViolations);
			}
		}
	}

	// Apply fixes if requested
	const fixedFiles: string[] = [];
	if (applyAutoFix) {
		const { writeFile } = await import("node:fs/promises");
		for (const [filePath, content] of fileContentMap) {
			const { fixed, newContent } = await applyFixes(
				filePath,
				content,
				violations,
			);
			if (fixed) {
				await writeFile(filePath, newContent, "utf-8");
				fixedFiles.push(filePath);
				// Update content map for re-checking violations
				fileContentMap.set(filePath, newContent);
			}
		}

		// Re-check violations after fixes (only if files were fixed)
		if (fixedFiles.length > 0) {
			const newViolations: Violation[] = [];
			for (const [filePath, content] of fileContentMap) {
				for (const rule of rules) {
					const ruleFiles = ruleFileMap.get(rule)!;
					if (ruleFiles.has(filePath)) {
						const fileViolations = findViolations(filePath, content, rule);
						newViolations.push(...fileViolations);
					}
				}
			}
			violations = newViolations;
		}
	}

	// Filter violations based on log level
	const filteredViolations = filterViolationsByLogLevel(violations, logLevel);

	const errors = filteredViolations.filter((v) => v.level === "error");
	const warnings = filteredViolations.filter((v) => v.level === "warning");

	return {
		violations: filteredViolations,
		hasErrors: errors.length > 0,
		hasWarnings: warnings.length > 0,
		fixedFiles,
	};
}

/**
 * Format and print violations
 */
async function printViolations(violations: Violation[]): Promise<void> {
	if (violations.length === 0) {
		console.log("✅ No lint violations found.");
		return;
	}

	const errors = violations.filter((v) => v.level === "error");
	const warnings = violations.filter((v) => v.level === "warning");

	// Print errors
	if (errors.length > 0) {
		console.error("❌ Lint errors found:\n");
		await printViolationsByLevel(errors);
	}

	// Print warnings
	if (warnings.length > 0) {
		console.warn("⚠️  Lint warnings found:\n");
		await printViolationsByLevel(warnings);
	}
}

/**
 * Print violations grouped by rule and file
 */
async function printViolationsByLevel(violations: Violation[]): Promise<void> {
	if (violations.length === 0) return;

	// Determine the level from the violations (all should be the same level)
	const level = violations[0]?.level || "error";
	const isWarning = level === "warning";

	// Group violations by rule and file
	const grouped = new Map<string, Map<string, Violation[]>>();

	for (const violation of violations) {
		if (!grouped.has(violation.rule)) {
			grouped.set(violation.rule, new Map());
		}
		const ruleMap = grouped.get(violation.rule)!;
		if (!ruleMap.has(violation.file)) {
			ruleMap.set(violation.file, []);
		}
		ruleMap.get(violation.file)!.push(violation);
	}

	// Print grouped violations
	for (const [ruleName, fileMap] of grouped) {
		const prefix = isWarning ? "⚠️" : "❌";
		const ruleText = `${prefix} Rule: ${ruleName}`;
		
		if (isWarning) {
			console.warn(styleText("yellow", ruleText));
		} else {
			console.error(ruleText);
		}
		
		for (const [file, fileViolations] of fileMap) {
			const fileText = `File: ${file}`;
			
			if (isWarning) {
				console.warn(styleText("yellow", fileText));
			} else {
				console.error(fileText);
			}
			
			// Read file content to show actual lines
			try {
				const content = await readFile(file, "utf-8");
				const lines = content.split("\n");
				
				for (const violation of fileViolations) {
					const lineContent = lines[violation.line - 1] || "";
					const lineText = `  Line ${violation.line}: ${lineContent.trim()}`;
					
					if (isWarning) {
						console.warn(styleText("yellow", lineText));
					} else {
						console.error(lineText);
					}
				}
			} catch (error) {
				// Fallback if file can't be read
				for (const violation of fileViolations) {
					const fallbackText = `  Line ${violation.line}, Column ${violation.column}: ${violation.match}`;
					
					if (isWarning) {
						console.warn(styleText("yellow", fallbackText));
					} else {
						console.error(fallbackText);
					}
				}
			}
			
			if (isWarning) {
				console.warn("");
			} else {
				console.error("");
			}
		}
	}
}

// Main execution
if (import.meta.main) {
	const applyAutoFix = process.argv.includes("--fix");
	
	if (applyAutoFix) {
		console.log("🔧 Auto-fix mode enabled\n");
	}

	const startTime = performance.now();
	const result = await lint(applyAutoFix);
	const lintTime = performance.now() - startTime;
	
	if (result.fixedFiles.length > 0) {
		console.log(`✅ Auto-fixed ${result.fixedFiles.length} file(s):`);
		for (const file of result.fixedFiles) {
			console.log(`   - ${file}`);
		}
		console.log("");
	}
	
	await printViolations(result.violations);
	
	const totalTime = performance.now() - startTime;
	console.log(`\n⏱️  Linting completed in ${totalTime.toFixed(2)}ms (lint: ${lintTime.toFixed(2)}ms, print: ${(totalTime - lintTime).toFixed(2)}ms)`);
	
	// Only exit with error code if there are actual errors (not just warnings)
	process.exit(result.hasErrors ? 1 : 0);
}

