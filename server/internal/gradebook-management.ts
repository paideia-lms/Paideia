import { GradebookCategories, Gradebooks } from "server/payload.config";
import { MOCK_INFINITY } from "server/utils/type-narrowing";
import { Result } from "typescript-result";
import {
	DuplicateGradebookError,
	GradebookNotFoundError,
	transformError,
	UnknownError,
} from "~/utils/error";
import type { CategoryData, ItemData } from "./utils/build-gradebook-structure";
import { buildCategoryStructure } from "./utils/build-gradebook-structure";
import {
	calculateAdjustedWeights,
	calculateOverallWeights,
} from "./utils/gradebook-weight-calculations";
import { handleTransactionId } from "./utils/handle-transaction-id";
import {
	interceptPayloadError,
	stripDepth,
	type BaseInternalFunctionArgs,
} from "./utils/internal-function-utils";
import { prettifyMarkdown } from "./utils/markdown-prettify";

export interface CreateGradebookArgs extends BaseInternalFunctionArgs {
	courseId: number;
	enabled?: boolean;
}

export interface UpdateGradebookArgs extends BaseInternalFunctionArgs {
	gradebookId: number;
	enabled?: boolean;
}

export interface SearchGradebooksArgs {
	courseId?: number;
	enabled?: boolean;
	limit?: number;
	page?: number;
}

export interface GradebookSetupItem {
	/**
	 *  either category id or item id
	 */
	id: number;
	type:
		| "manual_item"
		| "category"
		| "page"
		| "whiteboard"
		| "assignment"
		| "quiz"
		| "discussion";
	name: string;
	weight: number | null;
	max_grade: number | null;
	min_grade: number | null;
	description: string | null;
	category_id: number | null;
	extra_credit?: boolean; // Extra credit items don't affect weight distribution
	grade_items?: GradebookSetupItem[];
	activityModuleLinkId?: number | null; // Link ID to course-activity-module-links if this item is linked to an activity module
}

export interface GradebookSetupItemWithCalculations extends GradebookSetupItem {
	adjusted_weight: number | null;
	overall_weight: number | null; // Only for leaf items
	weight_explanation: string | null; // Human-readable explanation of overall weight calculation
	auto_weighted_zero?: boolean; // True if category is auto-weighted and should be treated as 0%
	grade_items?: GradebookSetupItemWithCalculations[];
}

export interface GradebookSetup {
	items: GradebookSetupItem[];
	exclude_empty_grades: boolean;
}

export interface GradebookSetupForUI {
	gradebook_id: number;
	course_id: number;
	gradebook_setup: {
		items: GradebookSetupItemWithCalculations[];
		exclude_empty_grades: boolean;
	};
	totals: {
		baseTotal: number;
		extraCreditTotal: number;
		calculatedTotal: number;
		totalMaxGrade: number;
	};
	extraCreditItems: GradebookSetupItemWithCalculations[];
	extraCreditCategories: GradebookSetupItemWithCalculations[];
}

export interface GradebookJsonRepresentation {
	gradebook_id: number;
	course_id: number;
	gradebook_setup: GradebookSetup;
}

/**
 * Creates a new gradebook for a course using Payload local API
 */
export function tryCreateGradebook(args: CreateGradebookArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				courseId,
				enabled = true,

				req,
				overrideAccess = false,
			} = args;

			// Check if course exists
			const course = await payload.findByID({
				collection: "courses",
				id: courseId,
				req,
				overrideAccess,
			});

			if (!course) {
				throw new UnknownError(`Course with ID ${courseId} not found`);
			}

			// Check if gradebook already exists for this course
			const existingGradebook = await payload.find({
				collection: Gradebooks.slug,
				where: {
					course: {
						equals: courseId,
					},
				},
				limit: 1,
				req,
				overrideAccess,
			});

			if (existingGradebook.docs.length > 0) {
				throw new DuplicateGradebookError(
					`Gradebook already exists for course ${courseId}`,
				);
			}

			const transactionInfo = await handleTransactionId(payload, req);

			return await transactionInfo.tx(async (txInfo) => {
				const newGradebook = await payload
					.create({
						collection: Gradebooks.slug,
						data: {
							course: courseId,
							enabled,
						},
						depth: 1,
						req: txInfo.reqWithTransaction,
						overrideAccess,
					})
					.then(stripDepth<1, "create">())
					.catch((error) => {
						interceptPayloadError({
							error,
							functionNamePrefix: "tryCreateGradebook",
							args: { payload, req: txInfo.reqWithTransaction, overrideAccess },
						});
						throw error;
					});

				return newGradebook;
			});
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to create gradebook", {
				cause: error,
			}),
	);
}

/**
 * Updates an existing gradebook using Payload local API
 */
export function tryUpdateGradebook(args: UpdateGradebookArgs) {
	return Result.try(
		async () => {
			const {
				payload,
				gradebookId,
				enabled,
				req,
				overrideAccess = false,
			} = args;

			const updatedGradebook = await payload
				.update({
					collection: Gradebooks.slug,
					id: gradebookId,
					data: { enabled },
					depth: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<1, "update">())
				.catch((error) => {
					interceptPayloadError({
						error,
						functionNamePrefix: "tryUpdateGradebook",
						args: { payload, req, overrideAccess },
					});
					throw error;
				});

			return updatedGradebook;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to update gradebook", {
				cause: error,
			}),
	);
}

export interface GetGradebookByCourseWithDetailsArgs
	extends BaseInternalFunctionArgs {
	courseId: number;
}

/**
 * Gets gradebook by course ID with all details
 */
export function tryGetGradebookByCourseWithDetails(
	args: GetGradebookByCourseWithDetailsArgs,
) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			const gradebook = await payload
				.find({
					collection: Gradebooks.slug,
					where: {
						course: {
							equals: courseId,
						},
					},
					joins: {
						categories: {
							limit: MOCK_INFINITY,
						},
						items: {
							limit: MOCK_INFINITY,
						},
					},
					depth: 2, // Get categories and items with their details
					limit: 1,
					req,
					overrideAccess,
				})
				.then(stripDepth<2, "find">())
				.then((g) => {
					const gradebook = g.docs[0];
					if (!gradebook)
						throw new GradebookNotFoundError(
							`Gradebook not found for course ${courseId}`,
						);

					// type narrowing

					const categories = gradebook.categories?.docs ?? [];

					const items = gradebook.items?.docs ?? [];

					return {
						...gradebook,
						course: gradebook.course,
						categories,
						items,
					};
				});

			return gradebook;
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get gradebook by course with details", {
				cause: error,
			}),
	);
}

/**
 * Formats a number or null as a percentage string
 */
function formatPercentage(value: number | null): string {
	if (value === null) {
		return "-";
	}
	return `${value.toFixed(2)}%`;
}

/**
 * Formats a number or null as a decimal string
 */
function formatNumber(value: number | null): string {
	if (value === null) {
		return "-";
	}
	return value.toFixed(2);
}

/**
 * Gets the type display name for an item
 */
function getTypeDisplayName(type: string): string {
	switch (type) {
		case "manual_item":
			return "Manual";
		case "page":
			return "Page";
		case "whiteboard":
			return "Whiteboard";
		case "assignment":
			return "Assignment";
		case "quiz":
			return "Quiz";
		case "discussion":
			return "Discussion";
		case "category":
			return "Category";
		default:
			return type;
	}
}

/**
 * Recursively calculates the sum of max grades for all leaf items in a category
 */
function calculateCategoryMaxGrade(
	items: GradebookSetupItemWithCalculations[],
): number {
	let sum = 0;
	for (const item of items) {
		if (item.type === "category" && item.grade_items) {
			sum += calculateCategoryMaxGrade(item.grade_items);
		} else {
			sum += item.max_grade ?? 0;
		}
	}
	return sum;
}

/**
 * Recursively builds hierarchical rows for the Grade Summary table
 */
function buildGradeSummaryRows(
	items: GradebookSetupItemWithCalculations[],
	depth: number = 0,
	prefix: string = "",
): string[] {
	const rows: string[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i]!;
		const isLast = i === items.length - 1;
		const isCategory = item.type === "category";
		const hasNestedItems =
			isCategory && item.grade_items && item.grade_items.length > 0;

		// Build the indentation prefix
		let itemPrefix = "";
		if (depth > 0) {
			itemPrefix = prefix + (isLast ? "└─ " : "├─ ");
		}

		// Build item name with extra credit indicator
		let itemName = item.name;
		if (isCategory) {
			itemName = `**${itemName}**`;
		}
		if (item.extra_credit) {
			itemName += ` (EC)`;
		}

		// Format weight
		const weightStr =
			item.adjusted_weight !== null
				? formatPercentage(item.adjusted_weight)
				: "-";

		// Format max grade
		let maxGradeStr: string;
		if (isCategory && hasNestedItems) {
			// For categories, calculate sum of children's max grades
			const categoryMaxGrade = calculateCategoryMaxGrade(
				item.grade_items ?? [],
			);
			maxGradeStr = categoryMaxGrade > 0 ? formatNumber(categoryMaxGrade) : "-";
		} else {
			maxGradeStr = formatNumber(item.max_grade);
		}

		// For now, show placeholder values for grades (can be enhanced later with actual user grades)
		const obtainedStr = "-"; // Placeholder
		const rawPercentStr = "-"; // Placeholder
		const weightedPercentStr =
			item.overall_weight !== null
				? formatPercentage(item.overall_weight)
				: "-";
		const contributionStr =
			item.overall_weight !== null
				? formatPercentage(item.overall_weight)
				: "-";

		rows.push(
			`| ${itemPrefix}${itemName} | ${weightStr} | ${maxGradeStr} | ${obtainedStr} | ${rawPercentStr} | ${weightedPercentStr} | ${contributionStr} |`,
		);

		// Recursively process nested items
		if (hasNestedItems && item.grade_items) {
			const newPrefix = prefix + (isLast ? "   " : "│  ");
			rows.push(
				...buildGradeSummaryRows(item.grade_items, depth + 1, newPrefix),
			);
		}
	}

	return rows;
}

/**
 * Recursively builds flat rows for the Full Grade Breakdown table
 */
function buildFullBreakdownRows(
	items: GradebookSetupItemWithCalculations[],
	depth: number = 0,
): string[] {
	const rows: string[] = [];

	for (const item of items) {
		const isCategory = item.type === "category";
		const indent = "  ".repeat(depth);

		// Build item name
		let itemName = item.name;
		if (isCategory) {
			itemName = `**${itemName}**`;
		} else if (item.extra_credit) {
			itemName = `**${itemName}**`;
		}

		// Format type
		let typeStr = getTypeDisplayName(item.type);
		if (item.extra_credit) {
			typeStr += " (EC)";
		}

		// Format weight (bold for extra credit items)
		const weightStr =
			item.adjusted_weight !== null
				? item.extra_credit
					? `**${formatPercentage(item.adjusted_weight)}**`
					: formatPercentage(item.adjusted_weight)
				: "-";

		// Format max grade
		let maxGradeStr: string;
		if (isCategory && item.grade_items) {
			const categoryMaxGrade = calculateCategoryMaxGrade(item.grade_items);
			maxGradeStr =
				categoryMaxGrade > 0 ? `**${formatNumber(categoryMaxGrade)}**` : "-";
		} else {
			maxGradeStr = formatNumber(item.max_grade);
		}

		// Placeholder values for grades
		const gradeStr =
			isCategory && item.grade_items
				? `**${formatNumber(0)}**` // Category total placeholder
				: "-";
		const percentStr =
			isCategory && item.grade_items
				? `**${formatPercentage(0)}**` // Category percent placeholder
				: item.extra_credit
					? "**-**"
					: "-";
		const weightedGradeStr =
			isCategory && item.grade_items
				? `**${formatNumber(0)}**` // Category weighted placeholder
				: item.extra_credit
					? "**-**"
					: "-";

		rows.push(
			`| ${item.id} | ${indent}${itemName} | ${typeStr} | ${weightStr} | ${maxGradeStr} | ${gradeStr} | ${percentStr} | ${weightedGradeStr} |`,
		);

		// Recursively process nested items
		if (isCategory && item.grade_items) {
			rows.push(...buildFullBreakdownRows(item.grade_items, depth + 1));
		}
	}

	return rows;
}

export interface GetGradebookAllRepresentationsArgs
	extends BaseInternalFunctionArgs {
	courseId: number;
}

export interface GradebookAllRepresentations {
	json: GradebookJsonRepresentation;
	yaml: string;
	markdown: string;
	ui: GradebookSetupForUI;
}

/**
 * Gets all gradebook representations (JSON, YAML, Markdown, UI) in a single call
 * This is more efficient than calling each function separately as it only fetches data once
 */
export function tryGetGradebookAllRepresentations(
	args: GetGradebookAllRepresentationsArgs,
) {
	return Result.try(
		async () => {
			const { payload, courseId, req, overrideAccess = false } = args;

			const gradebookId = courseId;

			// Get all categories for this gradebook (depth 0 to avoid deep nesting)
			const categoriesPromise = payload
				.find({
					collection: GradebookCategories.slug,
					where: {
						gradebook: {
							equals: gradebookId,
						},
					},
					depth: 0,
					joins: {
						subcategories: {
							limit: MOCK_INFINITY,
						},
						items: {
							limit: MOCK_INFINITY,
						},
					},
					pagination: false,
					sort: "sortOrder",
					req,
					overrideAccess,
				})
				.then(stripDepth<0, "find">())
				.then((c) => {
					const categories = c.docs;

					return categories.map((category) => {
						const parent = category.parent;
						const subcategories = category.subcategories?.docs ?? [];
						const items = category.items?.docs ?? [];

						const result = {
							...category,
							gradebook: gradebookId,
							parent,
							subcategories: subcategories,
							items: items,
						};
						return result;
					});
				});

			// Get all items for this gradebook (depth 0 to avoid deep nesting)
			const itemsPromise = payload
				.find({
					collection: "gradebook-items",
					where: {
						gradebook: {
							equals: gradebookId,
						},
					},
					joins: {
						// ! we don't need user grades
						userGrades: false,
					},
					depth: 0,
					pagination: false,
					sort: "sortOrder",
					req,
					overrideAccess,
				})
				.then(stripDepth<0, "find">())
				.then((i) => {
					const items = i.docs;
					return items.map((item) => {
						// type narrowing
						const category = item.category;

						const activityModule = item.activityModule;

						// ! we don't have user grades for now
						const userGrades = undefined;

						const type = item.activityModuleType;

						const activityModuleName = item.activityModuleName;

						const result = {
							...item,
							category: category,
							gradebook: gradebookId,
							activityModule: activityModule,
							userGrades: userGrades,
							activityModuleType: type ?? null,
							activityModuleName: activityModuleName ?? null,
						};
						return result;
					});
				});

			// Wait for both queries to complete
			const [categoriesData, itemsData] = await Promise.all([
				categoriesPromise,
				itemsPromise,
			]);

			// Map categories to CategoryData type
			const categories = categoriesData.map((category) => ({
				id: category.id,
				gradebook: category.gradebook,
				parent: category.parent ?? null,
				name: category.name,
				weight: category.weight ?? null,
				extraCredit: category.extraCredit ?? false,
				subcategories: category.subcategories,
				items: category.items,
			})) satisfies CategoryData[];

			// Map items to ItemData type
			const items = itemsData.map((item) => ({
				id: item.id,
				gradebook: item.gradebook,
				category: item.category ?? null,
				name: item.name,
				description: item.description ?? null,
				activityModuleType: item.activityModuleType,
				activityModuleName: item.activityModuleName,
				activityModuleLinkId: item.activityModule ?? null,
				weight: item.weight ?? null,
				maxGrade: item.maxGrade,
				minGrade: item.minGrade ?? null,
				extraCredit: item.extraCredit ?? false,
			})) satisfies ItemData[];

			// Build the structure recursively
			const setupItems: GradebookSetupItem[] = [];

			// Process root-level items (items without a category)
			const rootItems = items.filter((item) => !item.category);
			for (const item of rootItems) {
				setupItems.push({
					id: item.id,
					type: (item.activityModuleType ?? "manual_item") as
						| "manual_item"
						| "category"
						| "page"
						| "whiteboard"
						| "assignment"
						| "quiz"
						| "discussion",
					name: item.activityModuleName ?? item.name,
					weight: item.weight ?? null,
					max_grade: item.maxGrade ?? null,
					min_grade: item.minGrade ?? null,
					description: item.description ?? null,
					category_id: null, // Root items don't have a category
					extra_credit: item.extraCredit ?? false,
					activityModuleLinkId: item.activityModuleLinkId ?? null,
				});
			}

			// Process root categories (categories without a parent) recursively
			// Note: buildCategoryStructure(null) only processes categories, not items,
			// because root items are handled separately above
			const rootCategoryStructures = buildCategoryStructure(
				null,
				categories,
				items,
			);
			setupItems.push(...rootCategoryStructures);

			// Build JSON representation
			const jsonData: GradebookJsonRepresentation = {
				gradebook_id: gradebookId,
				course_id: courseId,
				gradebook_setup: {
					items: setupItems,
					exclude_empty_grades: true, // You can make this configurable if needed
				},
			};

			// Calculate adjusted weights for UI
			const itemsWithAdjusted = calculateAdjustedWeights(
				jsonData.gradebook_setup.items,
			);

			// Calculate overall weights and get totals
			const totals = calculateOverallWeights(
				itemsWithAdjusted as GradebookSetupItemWithCalculations[],
			);

			// Build UI representation
			const uiData: GradebookSetupForUI = {
				gradebook_id: jsonData.gradebook_id,
				course_id: jsonData.course_id,
				gradebook_setup: {
					items: itemsWithAdjusted as GradebookSetupItemWithCalculations[],
					exclude_empty_grades: jsonData.gradebook_setup.exclude_empty_grades,
				},
				totals: {
					baseTotal: totals.baseTotal,
					extraCreditTotal: totals.extraCreditTotal,
					calculatedTotal: totals.calculatedTotal,
					totalMaxGrade: totals.totalMaxGrade,
				},
				extraCreditItems: totals.extraCreditItems,
				extraCreditCategories: totals.extraCreditCategories,
			};

			// Convert JSON to YAML using Bun.YAML.stringify
			// Create a modified version without gradebook_id since it's the same as course_id
			const yamlData = {
				...jsonData,
				gradebook_id: undefined,
			};
			// Remove undefined property
			delete (yamlData as { gradebook_id?: number }).gradebook_id;

			const yamlString = Bun.YAML?.stringify(yamlData, null, 2);
			if (!yamlString) {
				throw new UnknownError("Bun.YAML is not available");
			}

			// Build Markdown representation
			const header = `# Grade Report

			**Course ID:** ${uiData.course_id}

			## Grade Summary

			| Category/Path              | Weight | Max Grade | Obtained | Raw %  | Weighted % | Contribution |
			|----------------------------|--------|-----------|----------|--------|------------|--------------|`;

			// Build grade summary rows
			const summaryRows = buildGradeSummaryRows(uiData.gradebook_setup.items);
			const summarySection = [header, ...summaryRows].join("\n");

			// Build full breakdown header
			const breakdownHeader = `
			## Full Grade Breakdown

			| ID | Item Name              | Type         | Weight | Max Grade | Grade | %     | Weighted Grade |
			|----|------------------------|--------------|--------|-----------|-------|-------|----------------|`;

			// Build full breakdown rows
			const breakdownRows = buildFullBreakdownRows(
				uiData.gradebook_setup.items,
			);
			const breakdownSection = [breakdownHeader, ...breakdownRows].join("\n");

			// Build totals section
			const totalsSection = `
			**Current Course Total: ${formatNumber(0)} / ${formatNumber(uiData.totals.totalMaxGrade)} (${formatPercentage(0)})**

			**Gradebook Settings:**

			| Setting                  | Value          |
			|--------------------------|----------------|
			| Exclude empty grades     | ${uiData.gradebook_setup.exclude_empty_grades ? "Yes" : "No"}            |
			| Show weight              | Yes            |
			| Show contribution        | Yes            |
			| Show range               | Yes            |

			**(EC) = Extra Credit**`;

			// Combine all sections
			const rawMarkdown = [
				summarySection,
				breakdownSection,
				totalsSection,
			].join("\n");

			// Prettify the markdown using remark
			const markdown = prettifyMarkdown(rawMarkdown);

			return {
				json: jsonData,
				yaml: yamlString,
				markdown,
				ui: uiData,
			};
		},
		(error) =>
			transformError(error) ??
			new UnknownError("Failed to get gradebook all representations", {
				cause: error,
			}),
	);
}
