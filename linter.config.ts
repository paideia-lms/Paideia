/**
 * Linter configuration file
 * Contains AST pattern matchers and lint rules
 */

import * as ts from "typescript";
import type { LintRule } from "./scripts/lint-project";

// Define AST pattern matchers
const astPatterns = {
	/**
	 * Matches createLocalReq function calls
	 */
	createLocalReqCall: (node: ts.Node): boolean => {
		if (ts.isCallExpression(node)) {
			const expression = node.expression;
			if (ts.isIdentifier(expression) && expression.text === "createLocalReq") {
				return true;
			}
		}
		return false;
	},

	/**
	 * Matches imports containing createLocalReq
	 */
	createLocalReqImport: (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const importClause = node.importClause;
			if (importClause) {
				// Check named imports
				if (importClause.namedBindings) {
					if (ts.isNamedImports(importClause.namedBindings)) {
						return importClause.namedBindings.elements.some(
							(element) => element.name.text === "createLocalReq",
						);
					}
				}
			}
		}
		return false;
	},

	/**
	 * Matches await payload.find() calls
	 * AST structure: AwaitExpression -> CallExpression -> PropertyAccessExpression
	 */
	awaitPayloadFind: (node: ts.Node): boolean => {
		if (ts.isAwaitExpression(node)) {
			const expression = node.expression;
			// The expression should be a CallExpression
			if (ts.isCallExpression(expression)) {
				const callTarget = expression.expression;
				// The call target should be payload.find
				if (
					ts.isPropertyAccessExpression(callTarget) &&
					ts.isIdentifier(callTarget.expression) &&
					callTarget.expression.text === "payload" &&
					callTarget.name.text === "find"
				) {
					return true;
				}
			}
		}
		return false;
	},

	/**
	 * Matches await payload.findById() calls
	 * AST structure: AwaitExpression -> CallExpression -> PropertyAccessExpression
	 */
	awaitPayloadFindById: (node: ts.Node): boolean => {
		if (ts.isAwaitExpression(node)) {
			const expression = node.expression;
			// The expression should be a CallExpression
			if (ts.isCallExpression(expression)) {
				const callTarget = expression.expression;
				// The call target should be payload.findById
				if (
					ts.isPropertyAccessExpression(callTarget) &&
					ts.isIdentifier(callTarget.expression) &&
					callTarget.expression.text === "payload" &&
					callTarget.name.text === "findById"
				) {
					return true;
				}
			}
		}
		return false;
	},

	/**
	 * Matches parseFormDataWithFallback function calls
	 */
	parseFormDataWithFallbackCall: (node: ts.Node): boolean => {
		if (ts.isCallExpression(node)) {
			const expression = node.expression;
			if (
				ts.isIdentifier(expression) &&
				expression.text === "parseFormDataWithFallback"
			) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Matches imports containing parseFormDataWithFallback
	 */
	parseFormDataWithFallbackImport: (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const importClause = node.importClause;
			if (importClause) {
				// Check named imports
				if (importClause.namedBindings) {
					if (ts.isNamedImports(importClause.namedBindings)) {
						return importClause.namedBindings.elements.some(
							(element) =>
								element.name.text === "parseFormDataWithFallback",
						);
					}
				}
			}
		}
		return false;
	},

	/**
	 * Matches await tryParseFormDataWithMediaUpload() calls
	 * AST structure: AwaitExpression -> CallExpression -> Identifier
	 */
	awaitTryParseFormDataWithMediaUpload: (node: ts.Node): boolean => {
		if (ts.isAwaitExpression(node)) {
			const expression = node.expression;
			// The expression should be a CallExpression
			if (ts.isCallExpression(expression)) {
				const callTarget = expression.expression;
				// The call target should be tryParseFormDataWithMediaUpload
				if (
					ts.isIdentifier(callTarget) &&
					callTarget.text === "tryParseFormDataWithMediaUpload"
				) {
					return true;
				}
			}
		}
		return false;
	},

	/**
	 * Matches imports containing tryParseFormDataWithMediaUpload
	 */
	tryParseFormDataWithMediaUploadImport: (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const importClause = node.importClause;
			if (importClause) {
				// Check named imports
				if (importClause.namedBindings) {
					if (ts.isNamedImports(importClause.namedBindings)) {
						return importClause.namedBindings.elements.some(
							(element) =>
								element.name.text === "tryParseFormDataWithMediaUpload",
						);
					}
				}
			}
		}
		return false;
	},

	/**
	 * Matches export const action declarations
	 * AST structure: VariableStatement -> VariableDeclarationList -> VariableDeclaration
	 */
	exportConstAction: (node: ts.Node): boolean => {
		if (ts.isVariableStatement(node)) {
			// Check if it's exported
			if (
				node.modifiers?.some(
					(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
				)
			) {
				// Check if it declares a const variable named "action"
				const declarationList = node.declarationList;
				if (declarationList.flags & ts.NodeFlags.Const) {
					return declarationList.declarations.some(
						(declaration) =>
							ts.isIdentifier(declaration.name) &&
							declaration.name.text === "action",
					);
				}
			}
		}
		return false;
	},

	/**
	 * Matches imports containing typeCreateActionRpc
	 */
	typeCreateActionRpcImport: (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const importClause = node.importClause;
			if (importClause) {
				// Check named imports
				if (importClause.namedBindings) {
					if (ts.isNamedImports(importClause.namedBindings)) {
						return importClause.namedBindings.elements.some(
							(element) => element.name.text === "typeCreateActionRpc",
						);
					}
				}
			}
		}
		return false;
	},

	/**
	 * Matches export const action when typeCreateActionRpc is not imported
	 * This pattern matcher checks if the file has export const action but lacks the import
	 */
	exportConstActionWithoutImport: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): boolean => {
		// First check if this is export const action
		if (!astPatterns.exportConstAction(node)) {
			return false;
		}

		// If it is export const action, check if typeCreateActionRpc is imported
		// Traverse the source file to find imports
		let hasImport = false;
		function visitForImport(n: ts.Node) {
			if (astPatterns.typeCreateActionRpcImport(n)) {
				hasImport = true;
				return;
			}
			ts.forEachChild(n, visitForImport);
		}

		visitForImport(sourceFile);

		// Return true if export const action exists but import is missing (violation)
		return !hasImport;
	},

	/**
	 * Matches export const functionName = Result.wrap(...) pattern
	 * This is the old pattern that should be replaced with:
	 * export function functionName(args: ArgsType) {
	 *   return Result.try(async () => { ... });
	 * }
	 * AST structure: VariableStatement -> VariableDeclarationList -> VariableDeclaration -> CallExpression -> PropertyAccessExpression
	 */
	resultWrapPattern: (node: ts.Node): boolean => {
		if (ts.isVariableStatement(node)) {
			// Check if it's exported
			if (
				node.modifiers?.some(
					(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
				)
			) {
				const declarationList = node.declarationList;
				// Check if it's a const declaration
				if (declarationList.flags & ts.NodeFlags.Const) {
					// Check if any declaration has Result.wrap as initializer
					return declarationList.declarations.some((declaration) => {
						if (!declaration.initializer) {
							return false;
						}
						// Check if initializer is a CallExpression
						if (ts.isCallExpression(declaration.initializer)) {
							const callExpression = declaration.initializer.expression;
							// Check if it's Result.wrap
							if (ts.isPropertyAccessExpression(callExpression)) {
								return (
									ts.isIdentifier(callExpression.expression) &&
									callExpression.expression.text === "Result" &&
									callExpression.name.text === "wrap"
								);
							}
						}
						return false;
					});
				}
			}
		}
		return false;
	},
};

// Log level configuration
// "error" - only show errors
// "warning" - show warnings and errors
export const logLevel: "error" | "warning" = "warning";

// Define lint rules
export const rules: LintRule[] = [
	{
		name: "Ban createLocalReq in routes",
		description: "createLocalReq should not be used in route files (except root.tsx)",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "createLocalReq function call",
				matcher: astPatterns.createLocalReqCall,
			},
			{
				name: "createLocalReq import",
				matcher: astPatterns.createLocalReqImport,
			},
		],
	},
	{
		name: "Ban await payload.find/findById in routes",
		description: "await payload.find and await payload.findById should not be used in route files (except root.tsx)",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "await payload.find() call",
				matcher: astPatterns.awaitPayloadFind,
			},
			{
				name: "await payload.findById() call",
				matcher: astPatterns.awaitPayloadFindById,
			},
		],
	},
	{
		name: "Warn parseFormDataWithFallback in routes",
		description: "parseFormDataWithFallback should be avoided in route files (except root.tsx)",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		level: "warning", // Warning level instead of error
		astPatterns: [
			{
				name: "parseFormDataWithFallback function call",
				matcher: astPatterns.parseFormDataWithFallbackCall,
			},
			{
				name: "parseFormDataWithFallback import",
				matcher: astPatterns.parseFormDataWithFallbackImport,
			},
		],
	},
	{
		name: "Warn tryParseFormDataWithMediaUpload in routes",
		description: "tryParseFormDataWithMediaUpload should be avoided in route files (except root.tsx)",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		level: "warning", // Warning level instead of error
		astPatterns: [
			{
				name: "await tryParseFormDataWithMediaUpload() call",
				matcher: astPatterns.awaitTryParseFormDataWithMediaUpload,
			},
			{
				name: "tryParseFormDataWithMediaUpload import",
				matcher: astPatterns.tryParseFormDataWithMediaUploadImport,
			},
		],
	},
	{
		name: "Require typeCreateActionRpc import when using export const action",
		description: "Files with export const action must import typeCreateActionRpc (multi-action pattern requirement)",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "export const action without typeCreateActionRpc import",
				matcher: astPatterns.exportConstActionWithoutImport,
			},
		],
	},
	{
		name: "Ban Result.wrap pattern in internal functions",
		description: "Internal functions should use 'export function name(args) { return Result.try(...) }' instead of 'export const name = Result.wrap(...)'",
		includes: ["server/**/*.ts"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "export const functionName = Result.wrap(...) pattern",
				matcher: astPatterns.resultWrapPattern,
			},
		],
	},
];

