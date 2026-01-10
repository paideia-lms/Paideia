/**
 * Linter configuration file
 * Contains AST pattern matchers and lint rules
 */

import * as ts from "typescript";
import type { LintRule } from "./scripts/lint-project";

// Cache for multiple hooks check per file
const multipleHooksCache = new Map<
	string,
	{ hasMultiple: boolean; hookCallNodes: ts.Node[] }
>();

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

	/**
	 * Matches imports from "server/utils/permissions"
	 * Permissions should only be imported in context files, not in route files
	 */
	permissionsImport: (node: ts.Node, _sourceFile: ts.SourceFile): boolean => {
		if (ts.isImportDeclaration(node)) {
			const moduleSpecifier = node.moduleSpecifier;
			if (ts.isStringLiteral(moduleSpecifier)) {
				const modulePath = moduleSpecifier.text;
				// Check if the import is from "server/utils/permissions"
				// This handles both absolute imports and relative imports ending with the path
				return (
					modulePath === "server/utils/permissions" ||
					modulePath.endsWith("/server/utils/permissions") ||
					modulePath === "~/server/utils/permissions" ||
					modulePath.endsWith("~/server/utils/permissions")
				);
			}
		}
		return false;
	},

	/**
	 * Matches export const getRouteUrl declarations
	 * Should be export function getRouteUrl instead
	 */
	exportConstGetRouteUrl: (node: ts.Node): boolean => {
		if (ts.isVariableStatement(node)) {
			// Check if it's exported
			if (
				node.modifiers?.some(
					(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
				)
			) {
				// Check if it declares a const variable named "getRouteUrl"
				const declarationList = node.declarationList;
				if (declarationList.flags & ts.NodeFlags.Const) {
					return declarationList.declarations.some(
						(declaration) =>
							ts.isIdentifier(declaration.name) &&
							declaration.name.text === "getRouteUrl",
					);
				}
			}
		}
		return false;
	},

	/**
	 * Matches export function getRouteUrl declarations
	 */
	exportFunctionGetRouteUrl: (node: ts.Node): boolean => {
		if (ts.isFunctionDeclaration(node)) {
			// Check if it's exported
			if (
				node.modifiers?.some(
					(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
				)
			) {
				// Check if function name is "getRouteUrl"
				return (
					node.name !== undefined &&
					ts.isIdentifier(node.name) &&
					node.name.text === "getRouteUrl"
				);
			}
		}
		return false;
	},

	/**
	 * Checks if getRouteUrl is missing as an exported function
	 * This pattern matcher checks the entire source file to see if getRouteUrl exists as export function
	 */
	missingExportFunctionGetRouteUrl: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): boolean => {
		// Only check once per file (on the source file itself)
		if (node !== sourceFile) {
			return false;
		}

		// Traverse the source file to find export function getRouteUrl
		let hasExportFunctionGetRouteUrl = false;
		function visitForExportFunction(n: ts.Node) {
			if (astPatterns.exportFunctionGetRouteUrl(n)) {
				hasExportFunctionGetRouteUrl = true;
				return;
			}
			ts.forEachChild(n, visitForExportFunction);
		}

		visitForExportFunction(sourceFile);

		// Return true if export function getRouteUrl is missing (violation)
		return !hasExportFunctionGetRouteUrl;
	},

	/**
	 * Matches z.any() calls from zod
	 * AST structure: CallExpression -> PropertyAccessExpression (z.any)
	 */
	zAnyCall: (node: ts.Node): boolean => {
		if (ts.isCallExpression(node)) {
			const expression = node.expression;
			if (ts.isPropertyAccessExpression(expression)) {
				// Check if it's z.any
				if (
					ts.isIdentifier(expression.expression) &&
					expression.expression.text === "z" &&
					expression.name.text === "any"
				) {
					return true;
				}
			}
		}
		return false;
	},

	/**
	 * Matches imports of href from "react-router"
	 */
	hrefImport: (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const moduleSpecifier = node.moduleSpecifier;
			if (ts.isStringLiteral(moduleSpecifier)) {
				const modulePath = moduleSpecifier.text;
				// Check if importing from "react-router"
				if (modulePath === "react-router") {
					const importClause = node.importClause;
					if (importClause) {
						// Check named imports
						if (importClause.namedBindings) {
							if (ts.isNamedImports(importClause.namedBindings)) {
								return importClause.namedBindings.elements.some(
									(element) => element.name.text === "href",
								);
							}
						}
					}
				}
			}
		}
		return false;
	},

	/**
	 * Matches any import from "react-router"
	 * This pattern matches any import declaration from "react-router" regardless of what's being imported
	 */
	reactRouterImport: (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const moduleSpecifier = node.moduleSpecifier;
			if (ts.isStringLiteral(moduleSpecifier)) {
				const modulePath = moduleSpecifier.text;
				// Check if importing from "react-router"
				return modulePath === "react-router";
			}
		}
		return false;
	},

	/**
	 * Matches href() function calls
	 */
	hrefCall: (node: ts.Node): boolean => {
		if (ts.isCallExpression(node)) {
			const expression = node.expression;
			if (ts.isIdentifier(expression) && expression.text === "href") {
				return true;
			}
		}
		return false;
	},

	/**
	 * Checks if href call is inside a getRouteUrl function
	 * Traverses up the AST tree to find if we're inside a function named "getRouteUrl"
	 */
	isHrefCallInsideGetRouteUrl: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): boolean => {
		if (!astPatterns.hrefCall(node)) {
			return false;
		}

		// Traverse up the AST tree to find the containing function
		let currentNode: ts.Node | undefined = node;
		while (currentNode) {
			// Check if we're inside a function declaration
			if (ts.isFunctionDeclaration(currentNode)) {
				// Check if the function is named "getRouteUrl"
				if (
					currentNode.name &&
					ts.isIdentifier(currentNode.name) &&
					currentNode.name.text === "getRouteUrl"
				) {
					return true;
				}
			}
			// Check if we're inside a function expression or arrow function
			if (
				ts.isFunctionExpression(currentNode) ||
				ts.isArrowFunction(currentNode)
			) {
				// For function expressions, check if parent is a variable declaration
				// with name "getRouteUrl"
				const parent = currentNode.parent;
				if (parent && ts.isVariableDeclaration(parent)) {
					if (
						ts.isIdentifier(parent.name) &&
						parent.name.text === "getRouteUrl"
					) {
						return true;
					}
				}
			}
			// Move to parent node
			currentNode = currentNode.parent;
			// Stop if we've reached the source file
			if (currentNode === sourceFile) {
				break;
			}
		}

		return false;
	},

	/**
	 * Matches href() calls that are NOT inside getRouteUrl function
	 * This is the violation pattern
	 */
	hrefCallOutsideGetRouteUrl: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): boolean => {
		// Check if this is an href call
		if (!astPatterns.hrefCall(node)) {
			return false;
		}

		// Check if it's inside getRouteUrl - if yes, it's not a violation
		if (astPatterns.isHrefCallInsideGetRouteUrl(node, sourceFile)) {
			return false;
		}

		// It's an href call outside getRouteUrl - violation
		return true;
	},

	/**
	 * Matches export default function declarations (components)
	 */
	exportDefaultFunction: (node: ts.Node): boolean => {
		if (ts.isFunctionDeclaration(node)) {
			// Check if it's exported
			if (
				node.modifiers?.some(
					(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
				)
			) {
				// Check if it's default export
				if (
					node.modifiers?.some(
						(modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
					)
				) {
					return true;
				}
			}
		}
		return false;
	},

	/**
	 * Matches const [loaderFn, useHookName] = createLoaderRpc(...) pattern
	 * Returns the hook name if found, null otherwise
	 */
	loaderHookDeclaration: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): string | null => {
		if (!ts.isVariableStatement(node)) {
			return null;
		}

		const declarationList = node.declarationList;
		if (!(declarationList.flags & ts.NodeFlags.Const)) {
			return null;
		}

		for (const declaration of declarationList.declarations) {
			if (!ts.isArrayBindingPattern(declaration.name)) {
				continue;
			}

			const elements = declaration.name.elements;
			if (elements.length < 2) {
				continue;
			}

			// Second element should be the hook name
			const hookElement = elements[1];
			if (!hookElement || !ts.isBindingElement(hookElement)) {
				continue;
			}

			if (!ts.isIdentifier(hookElement.name)) {
				continue;
			}

			const hookName = hookElement.name.text;

			// Check if initializer is a call to createLoaderRpc
			if (!declaration.initializer) {
				continue;
			}

			if (!ts.isCallExpression(declaration.initializer)) {
				continue;
			}

			const callExpr = declaration.initializer;
			const callTarget = callExpr.expression;

			// Check if it's createLoaderRpc(...) or createXxxLoaderRpc(...)
			if (ts.isIdentifier(callTarget)) {
				const funcName = callTarget.text;
				if (funcName === "createLoaderRpc" || funcName.endsWith("LoaderRpc")) {
					return hookName;
				}
			}

			// Check if it's a method call like createActionRpc(...)
			if (ts.isCallExpression(callTarget)) {
				const innerCallTarget = callTarget.expression;
				if (ts.isIdentifier(innerCallTarget)) {
					const funcName = innerCallTarget.text;
					if (funcName === "createLoaderRpc" || funcName.endsWith("LoaderRpc")) {
						return hookName;
					}
				}
			}
		}

		return null;
	},

	/**
	 * Matches const [actionFn, useHookName] = createActionRpc(...) pattern
	 * Returns the hook name if found, null otherwise
	 */
	actionHookDeclaration: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): string | null => {
		if (!ts.isVariableStatement(node)) {
			return null;
		}

		const declarationList = node.declarationList;
		if (!(declarationList.flags & ts.NodeFlags.Const)) {
			return null;
		}

		for (const declaration of declarationList.declarations) {
			if (!ts.isArrayBindingPattern(declaration.name)) {
				continue;
			}

			const elements = declaration.name.elements;
			if (elements.length < 2) {
				continue;
			}

			// Second element should be the hook name
			const hookElement = elements[1];
			if (!hookElement || !ts.isBindingElement(hookElement)) {
				continue;
			}

			if (!ts.isIdentifier(hookElement.name)) {
				continue;
			}

			const hookName = hookElement.name.text;

			// Check if initializer is a call to createActionRpc
			if (!declaration.initializer) {
				continue;
			}

			if (!ts.isCallExpression(declaration.initializer)) {
				continue;
			}

			const callExpr = declaration.initializer;
			const callTarget = callExpr.expression;

			// Check if it's createActionRpc(...) or createXxxActionRpc(...)
			if (ts.isIdentifier(callTarget)) {
				const funcName = callTarget.text;
				if (funcName === "createActionRpc" || funcName.endsWith("ActionRpc")) {
					return hookName;
				}
			}

			// Check if it's a method call like createActionRpc(...)
			if (ts.isCallExpression(callTarget)) {
				const innerCallTarget = callTarget.expression;
				if (ts.isIdentifier(innerCallTarget)) {
					const funcName = innerCallTarget.text;
					if (funcName === "createActionRpc" || funcName.endsWith("ActionRpc")) {
						return hookName;
					}
				}
			}
		}

		return null;
	},

	/**
	 * Matches hook function calls like useXxx()
	 * Returns the hook name if found, null otherwise
	 */
	hookCall: (node: ts.Node): string | null => {
		if (!ts.isCallExpression(node)) {
			return null;
		}

		const expression = node.expression;
		if (!ts.isIdentifier(expression)) {
			return null;
		}

		const funcName = expression.text;
		// Check if it starts with "use" and has uppercase second letter (React hook convention)
		if (funcName.startsWith("use") && funcName.length > 3) {
			const secondChar = funcName[3];
			if (secondChar && secondChar === secondChar.toUpperCase()) {
				return funcName;
			}
		}

		return null;
	},

	/**
	 * Checks if a hook is imported from a route file
	 * Returns true if the hook is imported from app/routes
	 */
	isHookImportedFromRoute: (
		hookName: string,
		sourceFile: ts.SourceFile,
	): boolean => {
		function visitForImports(n: ts.Node) {
			if (ts.isImportDeclaration(n)) {
				const moduleSpecifier = n.moduleSpecifier;
				if (ts.isStringLiteral(moduleSpecifier)) {
					const modulePath = moduleSpecifier.text;
					// Check if importing from a route file (app/routes or ~/routes)
					if (
						modulePath.startsWith("app/routes/") ||
						modulePath.startsWith("~/routes/") ||
						modulePath.startsWith("../routes/") ||
						modulePath.startsWith("./routes/")
					) {
						const importClause = n.importClause;
						if (importClause) {
							// Check named imports
							if (importClause.namedBindings) {
								if (ts.isNamedImports(importClause.namedBindings)) {
									return importClause.namedBindings.elements.some(
										(element) => {
											const importedName = element.name.text;
											// Check if it's the hook we're looking for
											// Also check for aliases
											const aliasName = element.propertyName
												? element.propertyName.text
												: null;
											return (
												importedName === hookName ||
												aliasName === hookName
											);
										},
									);
								}
							}
						}
					}
				}
			}
			ts.forEachChild(n, visitForImports);
			return false;
		}

		let found = false;
		function visit(n: ts.Node) {
			if (found) return;
			if (ts.isImportDeclaration(n)) {
				const moduleSpecifier = n.moduleSpecifier;
				if (ts.isStringLiteral(moduleSpecifier)) {
					const modulePath = moduleSpecifier.text;
					if (
						modulePath.startsWith("app/routes/") ||
						modulePath.startsWith("~/routes/") ||
						modulePath.startsWith("../routes/") ||
						modulePath.startsWith("./routes/")
					) {
						const importClause = n.importClause;
						if (importClause?.namedBindings) {
							if (ts.isNamedImports(importClause.namedBindings)) {
								if (
									importClause.namedBindings.elements.some(
										(element) => element.name.text === hookName,
									)
								) {
									found = true;
									return;
								}
							}
						}
					}
				}
			}
			ts.forEachChild(n, visit);
		}

		visit(sourceFile);
		return found;
	},

	/**
	 * Checks if a hook name is a loader/action hook
	 * A loader/action hook is one that:
	 * 1. Ends with "Loader" (e.g., useSearchUsersLoader)
	 * 2. Contains "Action" and starts with "use" (e.g., useUpdateUser, useImpersonate)
	 * 3. Contains "Rpc" and starts with "use" (e.g., useUploadLogoRpc)
	 * 4. Is declared in the file via createLoaderRpc/createActionRpc
	 * 5. Is imported from a route file (likely a loader/action hook)
	 */
	isLoaderOrActionHook: (
		hookName: string,
		declaredHooks: Set<string>,
		sourceFile: ts.SourceFile,
	): boolean => {
		// Check if it's a declared hook
		if (declaredHooks.has(hookName)) {
			return true;
		}

		// Check if it's imported from a route file
		if (astPatterns.isHookImportedFromRoute(hookName, sourceFile)) {
			return true;
		}

		// Check naming patterns
		if (hookName.endsWith("Loader")) {
			return true;
		}

		if (hookName.startsWith("use") && hookName.includes("Action")) {
			return true;
		}

		if (hookName.startsWith("use") && hookName.includes("Rpc")) {
			return true;
		}

		// Check for common hook patterns from createActionRpc
		// These hooks typically have names like useXxx where Xxx is an action verb
		// But we need to be careful not to match all React hooks
		// So we'll be conservative and only match if it's in declared hooks or matches specific patterns
		return false;
	},

	/**
	 * Checks if a component uses more than one loader/action hook
	 * This pattern matcher returns true on hook call nodes when there are multiple hooks
	 */
	multipleHooksInComponent: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): boolean => {
		// Only check hook call nodes
		const hookName = astPatterns.hookCall(node);
		if (!hookName) {
			return false;
		}

		// Check if we're inside a default export function (component)
		let insideComponent = false;
		let currentNode: ts.Node | undefined = node;
		while (currentNode && currentNode !== sourceFile) {
			if (ts.isFunctionDeclaration(currentNode)) {
				if (astPatterns.exportDefaultFunction(currentNode)) {
					insideComponent = true;
					break;
				}
			}
			currentNode = currentNode.parent;
		}

		if (!insideComponent) {
			return false;
		}

		// Collect all hook names declared in this file (needed for isLoaderOrActionHook check)
		const declaredHooks = new Set<string>();
		function visitForHookDeclarations(n: ts.Node) {
			const loaderHook = astPatterns.loaderHookDeclaration(n, sourceFile);
			if (loaderHook) {
				declaredHooks.add(loaderHook);
			}

			const actionHook = astPatterns.actionHookDeclaration(n, sourceFile);
			if (actionHook) {
				declaredHooks.add(actionHook);
			}

			ts.forEachChild(n, visitForHookDeclarations);
		}

		visitForHookDeclarations(sourceFile);

		// Check if this is a loader/action hook
		if (
			!astPatterns.isLoaderOrActionHook(hookName, declaredHooks, sourceFile)
		) {
			return false;
		}

		// Use cache to avoid repeated traversals
		const filePath = sourceFile.fileName;
		let cacheEntry = multipleHooksCache.get(filePath);

		if (!cacheEntry) {
			// First time checking this file - do full analysis
			// Find default export function
			let defaultExportFunction: ts.FunctionDeclaration | null = null;
			function findDefaultExport(n: ts.Node) {
				if (
					ts.isFunctionDeclaration(n) &&
					astPatterns.exportDefaultFunction(n)
				) {
					defaultExportFunction = n;
					return;
				}
				ts.forEachChild(n, findDefaultExport);
			}

			findDefaultExport(sourceFile);

			if (!defaultExportFunction) {
				// No default export, cache negative result
				multipleHooksCache.set(filePath, {
					hasMultiple: false,
					hookCallNodes: [],
				});
				return false;
			}

			// Count loader/action hooks in the component
			const loaderActionHooks = new Set<string>();
			const hookCallNodes: ts.Node[] = [];
			function countHooksInComponent(n: ts.Node) {
				const hook = astPatterns.hookCall(n);
				if (hook) {
					if (
						astPatterns.isLoaderOrActionHook(
							hook,
							declaredHooks,
							sourceFile,
						)
					) {
						loaderActionHooks.add(hook);
						hookCallNodes.push(n);
					}
				}
				ts.forEachChild(n, countHooksInComponent);
			}

			countHooksInComponent(defaultExportFunction);

			cacheEntry = {
				hasMultiple: loaderActionHooks.size > 1,
				hookCallNodes,
			};
			multipleHooksCache.set(filePath, cacheEntry);
		}

		// Return true if there are multiple hooks and this is one of the hook call nodes
		// Check if this node is one of the cached hook call nodes by comparing positions
		if (cacheEntry.hasMultiple) {
			const nodePos = node.getStart(sourceFile);
			for (const cachedNode of cacheEntry.hookCallNodes) {
				if (cachedNode.getStart(sourceFile) === nodePos) {
					return true;
				}
			}
		}

		return false;
	},

	/**
	 * Matches useState() calls
	 * Returns true if the node is a useState call
	 */
	useStateCall: (node: ts.Node): boolean => {
		if (!ts.isCallExpression(node)) {
			return false;
		}

		const expression = node.expression;
		if (!ts.isIdentifier(expression)) {
			return false;
		}

		return expression.text === "useState";
	},

	/**
	 * Matches useEffect() calls
	 * Returns true if the node is a useEffect call
	 */
	useEffectCall: (node: ts.Node): boolean => {
		if (!ts.isCallExpression(node)) {
			return false;
		}

		const expression = node.expression;
		if (!ts.isIdentifier(expression)) {
			return false;
		}

		return expression.text === "useEffect";
	},

	/**
	 * Matches useQueryState() calls from nuqs
	 * Returns true if the node is a useQueryState call
	 */
	useQueryStateCall: (node: ts.Node): boolean => {
		if (!ts.isCallExpression(node)) {
			return false;
		}

		const expression = node.expression;
		if (!ts.isIdentifier(expression)) {
			return false;
		}

		return expression.text === "useQueryState";
	},

	/**
	 * Matches imports containing useQueryState from nuqs
	 */
	useQueryStateImport: (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const moduleSpecifier = node.moduleSpecifier;
			if (ts.isStringLiteral(moduleSpecifier)) {
				const modulePath = moduleSpecifier.text;
				// Check if importing from "nuqs"
				if (modulePath === "nuqs") {
					const importClause = node.importClause;
					if (importClause) {
						// Check named imports
						if (importClause.namedBindings) {
							if (ts.isNamedImports(importClause.namedBindings)) {
								return importClause.namedBindings.elements.some(
									(element) => element.name.text === "useQueryState",
								);
							}
						}
					}
				}
			}
		}
		return false;
	},

	/**
	 * Checks if a component uses more than 5 useState hooks
	 * This pattern matcher returns true on useState call nodes when there are more than 5
	 */
	tooManyUseStateHooks: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): boolean => {
		// Only check useState call nodes
		if (!astPatterns.useStateCall(node)) {
			return false;
		}

		// Check if we're inside a default export function (component)
		let insideComponent = false;
		let currentNode: ts.Node | undefined = node;
		while (currentNode && currentNode !== sourceFile) {
			if (ts.isFunctionDeclaration(currentNode)) {
				if (astPatterns.exportDefaultFunction(currentNode)) {
					insideComponent = true;
					break;
				}
			}
			currentNode = currentNode.parent;
		}

		if (!insideComponent) {
			return false;
		}

		// Use cache to avoid repeated traversals
		const filePath = sourceFile.fileName;
		const cacheKey = `${filePath}:useState`;
		let cacheEntry = multipleHooksCache.get(cacheKey);

		if (!cacheEntry) {
			// First time checking this file - do full analysis
			// Find default export function
			let defaultExportFunction: ts.FunctionDeclaration | null = null;
			function findDefaultExport(n: ts.Node) {
				if (
					ts.isFunctionDeclaration(n) &&
					astPatterns.exportDefaultFunction(n)
				) {
					defaultExportFunction = n;
					return;
				}
				ts.forEachChild(n, findDefaultExport);
			}

			findDefaultExport(sourceFile);

			if (!defaultExportFunction) {
				// No default export, cache negative result
				multipleHooksCache.set(cacheKey, {
					hasMultiple: false,
					hookCallNodes: [],
				});
				return false;
			}

			// Count useState hooks in the component
			const useStateCallNodes: ts.Node[] = [];
			function countUseStateInComponent(n: ts.Node) {
				if (astPatterns.useStateCall(n)) {
					useStateCallNodes.push(n);
				}
				ts.forEachChild(n, countUseStateInComponent);
			}

			countUseStateInComponent(defaultExportFunction);

			cacheEntry = {
				hasMultiple: useStateCallNodes.length > 5,
				hookCallNodes: useStateCallNodes,
			};
			multipleHooksCache.set(cacheKey, cacheEntry);
		}

		// Return true if there are more than 5 useState hooks and this is one of them
		// Check if this node is one of the cached useState call nodes by comparing positions
		if (cacheEntry.hasMultiple) {
			const nodePos = node.getStart(sourceFile);
			for (const cachedNode of cacheEntry.hookCallNodes) {
				if (cachedNode.getStart(sourceFile) === nodePos) {
					return true;
				}
			}
		}

		return false;
	},

	/**
	 * Matches rpc.createAction(...) calls
	 * Returns the variable name the action is assigned to, or null
	 */
	rpcCreateActionCall: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): string | null => {
		if (!ts.isCallExpression(node)) {
			return null;
		}

		const expression = node.expression;
		if (
			!ts.isPropertyAccessExpression(expression) ||
			expression.name.text !== "createAction"
		) {
			return null;
		}

		// Check if parent is a variable declaration
		const parent = node.parent;
		if (parent && ts.isVariableDeclaration(parent)) {
			if (ts.isIdentifier(parent.name)) {
				return parent.name.text;
			}
		}

		return null;
	},

	/**
	 * Matches createActionMap({ ... }) calls
	 * Returns the object literal with action mappings
	 */
	createActionMapCall: (node: ts.Node): ts.ObjectLiteralExpression | null => {
		if (!ts.isCallExpression(node)) {
			return null;
		}

		const expression = node.expression;
		if (!ts.isIdentifier(expression) || expression.text !== "createActionMap") {
			return null;
		}

		// Get the first argument (should be the object literal)
		const args = node.arguments;
		if (args.length === 0) {
			return null;
		}

		const firstArg = args[0];
		if (ts.isObjectLiteralExpression(firstArg)) {
			return firstArg;
		}

		return null;
	},

	/**
	 * Checks if all RPC actions are included in createActionMap
	 * Returns true if there's a violation (action not in map)
	 */
	missingActionInMap: (
		node: ts.Node,
		sourceFile: ts.SourceFile,
	): boolean => {
		// Only check on createActionMap calls
		const actionMapObj = astPatterns.createActionMapCall(node);
		if (!actionMapObj) {
			return false;
		}

		// Collect all action variable names from the file
		const actionVariables = new Set<string>();
		function collectActions(n: ts.Node) {
			const actionName = astPatterns.rpcCreateActionCall(n, sourceFile);
			if (actionName) {
				actionVariables.add(actionName);
			}
			ts.forEachChild(n, collectActions);
		}

		collectActions(sourceFile);

		// If no actions found, no violation
		if (actionVariables.size === 0) {
			return false;
		}

		// Extract values from the action map object literal
		const mapValues = new Set<string>();
		for (const property of actionMapObj.properties) {
			if (ts.isPropertyAssignment(property)) {
				const value = property.initializer;
				if (ts.isIdentifier(value)) {
					mapValues.add(value.text);
				}
			}
		}

		// Check if all action variables are in the map
		for (const actionVar of actionVariables) {
			if (!mapValues.has(actionVar)) {
				// Found an action not in the map - violation
				return true;
			}
		}

		return false;
	},
};

/**
 * Fix function for Result.wrap pattern
 * Transforms: export const name = Result.wrap(async (args: Type) => { ... }, errorHandler)
 * To: export function name(args: Type) { return Result.try(async () => { ... }, errorHandler); }
 */
const resultWrapFix: (
	node: ts.Node,
	sourceFile: ts.SourceFile,
) => string | null = (node, sourceFile) => {
	if (!ts.isVariableStatement(node)) {
		return null;
	}

	const declarationList = node.declarationList;
	if (!(declarationList.flags & ts.NodeFlags.Const)) {
		return null;
	}

	// Find the declaration with Result.wrap
	for (const declaration of declarationList.declarations) {
		if (!declaration.initializer || !ts.isCallExpression(declaration.initializer)) {
			continue;
		}

		const callExpr = declaration.initializer;
		const callTarget = callExpr.expression;

		if (
			!ts.isPropertyAccessExpression(callTarget) ||
			!ts.isIdentifier(callTarget.expression) ||
			callTarget.expression.text !== "Result" ||
			callTarget.name.text !== "wrap"
		) {
			continue;
		}

		// Get function name
		if (!ts.isIdentifier(declaration.name)) {
			continue;
		}
		const functionName = declaration.name.text;

		// Get arguments to Result.wrap
		const args = callExpr.arguments;
		if (args.length === 0) {
			continue;
		}

		// First argument should be the async function
		const asyncFunction = args[0];
		if (
			!asyncFunction ||
			(!ts.isArrowFunction(asyncFunction) && !ts.isFunctionExpression(asyncFunction))
		) {
			continue;
		}

		// Extract parameters
		const parameters = asyncFunction.parameters;
		if (parameters.length !== 1) {
			continue;
		}

		const param = parameters[0];
		if (!param) {
			continue;
		}

		const paramName = ts.isIdentifier(param.name) ? param.name.text : null;
		const paramType = param.type ? param.type.getText(sourceFile) : null;

		if (!paramName) {
			continue;
		}

		// Build parameter string
		const paramString = paramType
			? `${paramName}: ${paramType}`
			: paramName;

		// Extract function body
		const body = asyncFunction.body;
		if (!body) {
			continue;
		}

		// Get body text - if it's a block, get the content; if it's an expression, wrap it
		let bodyText: string;
		if (ts.isBlock(body)) {
			// Get the content inside the block (without the braces)
			// Find the position after the opening brace and before the closing brace
			const bodyStart = body.getStart(sourceFile);
			const bodyEnd = body.getEnd();
			const openBracePos = sourceFile.text.indexOf("{", bodyStart);
			const closeBracePos = sourceFile.text.lastIndexOf("}", bodyEnd - 1);
			
			if (openBracePos !== -1 && closeBracePos !== -1 && closeBracePos > openBracePos) {
				// Extract content between braces, preserving formatting
				bodyText = sourceFile.text.slice(openBracePos + 1, closeBracePos).trim();
			} else {
				bodyText = "";
			}
		} else {
			// Expression body - convert to return statement
			bodyText = `return ${body.getText(sourceFile)};`;
		}

		// Get error handler (second argument, if present)
		const errorHandler = args.length > 1 && args[1] ? args[1].getText(sourceFile) : null;

		// Build the new function
		let newFunction = `export function ${functionName}(${paramString}) {\n\treturn Result.try(\n\t\tasync () => {\n`;
		
		// Add body with proper indentation
		if (bodyText) {
			const bodyLines = bodyText.split("\n");
			for (const line of bodyLines) {
				if (line.trim()) {
					// Add one more level of indentation (3 tabs total)
					newFunction += `\t\t\t${line}\n`;
				} else {
					// Preserve empty lines
					newFunction += "\n";
				}
			}
		}
		
		newFunction += `\t\t}`;
		
		if (errorHandler) {
			newFunction += `,\n\t\t${errorHandler}`;
		}
		
		newFunction += `\n\t);\n}`;

		return newFunction;
	}

	return null;
};

// Define lint rules
export const rules: LintRule[] = [
	// {
	// 	name: "Ban createLocalReq in routes",
	// 	description: "createLocalReq should not be used in route files (except root.tsx)",
	// 	includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
	// 	mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
	// 	astPatterns: [
	// 		{
	// 			name: "createLocalReq function call",
	// 			matcher: astPatterns.createLocalReqCall,
	// 		},
	// 		{
	// 			name: "createLocalReq import",
	// 			matcher: astPatterns.createLocalReqImport,
	// 		},
	// 	],
	// },
	{
		name: "Ban await payload.find/findById in routes",
		description: "await payload.find and await payload.findById should not be used in route files (except root.tsx)",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx", "!app/routes/**/components/**/*.tsx"],
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
				fix: resultWrapFix,
			},
		],
	},
	{
		name: "Ban permissions import in routes",
		description: "Permissions should only be imported in context files, not in route files. Use permissions from context data instead.",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		level: "warning", // Warning level instead of error
		astPatterns: [
			{
				name: "import from server/utils/permissions",
				matcher: astPatterns.permissionsImport,
			},
		],
	},
	// {
	// 	name: "Require export function getRouteUrl in routes",
	// 	description: "Every route file must export a getRouteUrl function using 'export function getRouteUrl(...)'",
	// 	includes: ["app/routes/**/*.tsx", "!app/root.tsx", "!app/routes/**/components/**/*.tsx"],
	// 	mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
	// 	astPatterns: [
	// 		{
	// 			name: "missing export function getRouteUrl",
	// 			matcher: astPatterns.missingExportFunctionGetRouteUrl,
	// 		},
	// 	],
	// },
	{
		name: "Ban export const getRouteUrl in routes",
		description: "getRouteUrl must be exported as 'export function getRouteUrl(...)' not 'export const getRouteUrl = ...'",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx", "!app/routes/**/components/**/*.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "export const getRouteUrl declaration",
				matcher: astPatterns.exportConstGetRouteUrl,
			},
		],
	},
	// {
	// 	name: "Ban href from react-router outside getRouteUrl",
	// 	description: "href from react-router should only be used inside getRouteUrl functions. Use getRouteUrl() instead of directly calling href().",
	// 	includes: ["app/**/*.tsx"],
	// 	mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
	// 	astPatterns: [
	// 		{
	// 			name: "href() call outside getRouteUrl function",
	// 			matcher: astPatterns.hrefCallOutsideGetRouteUrl,
	// 		},
	// 	],
	// },
	{
		name: "Limit component to one loader/action hook",
		description: "Each component can only use 1 loader hook or action hook. If there are more hooks, the component should be broken down into smaller components.",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "multiple loader/action hooks in component",
				matcher: astPatterns.multipleHooksInComponent,
			},
		],
	},
	{
		name: "Limit component to 5 useState hooks",
		description: "Each component should use at most 5 useState hooks. If there are more, the component should be broken down into smaller components or use useReducer/other state management.",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "more than 5 useState hooks in component",
				matcher: astPatterns.tooManyUseStateHooks,
			},
		],
	},
	{
		name: "Warn useEffect usage in TSX files",
		description: "useEffect usage will affect performance and readability. Consider using React Router's built-in data loading mechanisms (loaders, actions) or other React patterns instead.",
		includes: ["app/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		level: "warning", // Warning level instead of error
		astPatterns: [
			{
				name: "useEffect() call",
				matcher: astPatterns.useEffectCall,
			},
		],
	},
	{
		name: "Ban useQueryState from nuqs",
		description: "useQueryState from nuqs should not be used directly. Use useNuqsSearchParams from app/utils/search-params-utils.ts instead.",
		includes: ["app/**/*.tsx", "app/**/*.ts"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "useQueryState() call",
				matcher: astPatterns.useQueryStateCall,
			},
			{
				name: "useQueryState import from nuqs",
				matcher: astPatterns.useQueryStateImport,
			},
		],
	},
	{
		name: "Ban react-router imports in server/internal",
		description: "react-router should not be imported in server/internal files. Server-side code should not depend on React Router.",
		includes: ["server/internal/**/*.ts", "!server/internal/**/*.test.ts", "!server/internal/**/*.spec.ts"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "import from react-router",
				matcher: astPatterns.reactRouterImport,
			},
		],
	},
	{
		name: "Ban z.any() usage",
		description: "z.any() is strictly banned. Use discriminated unions, z.or(), or z.custom() with proper types instead.",
		includes: ["app/**/*.ts", "app/**/*.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "z.any() call",
				matcher: astPatterns.zAnyCall,
			},
		],
	},
	{
		name: "Require all RPC actions in createActionMap",
		description: "All RPC actions created with rpc.createAction() must be included in the createActionMap. Missing actions will cause 'Action is required' errors.",
		includes: ["app/routes/**/*.tsx", "!app/root.tsx"],
		mode: "ast", // Use AST for more accurate detection (ignores comments/strings)
		astPatterns: [
			{
				name: "RPC action missing from createActionMap",
				matcher: astPatterns.missingActionInMap,
			},
		],
	},
];

